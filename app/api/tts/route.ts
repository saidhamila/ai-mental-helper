// mental-health-ai/app/api/tts/route.ts
import { NextResponse } from 'next/server';
import { ElevenLabsClient } from "elevenlabs";
import fs from "fs/promises";
import path from "path";
import { PassThrough } from 'stream';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { nvidiaConfig } from '@/lib/nvidia-config';
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator
// Ensure the public audio directory exists
const audioDir = path.join(process.cwd(), 'public', 'audio');
const PROTO_DIR = path.join(process.cwd(), 'Audio2Face-3D-Samples', 'proto', 'protobuf_files');
const PROTO_FILE = path.join(PROTO_DIR, 'nvidia_ace.services.a2f_controller.v1.proto'); // Use Controller service proto
const ensureAudioDirExists = async () => {
  try {
    await fs.access(audioDir);
  } catch (error) {
    // Directory doesn't exist, create it
    try {
      await fs.mkdir(audioDir, { recursive: true });
      console.log(`Created audio directory: ${audioDir}`);
    } catch (mkdirError) {
      console.error(`Error creating audio directory: ${audioDir}`, mkdirError);
      throw new Error('Failed to create audio directory'); // Re-throw to signal failure
    }
  }
};
// --- gRPC Setup ---
// Load Proto Definitions
const packageDefinition = protoLoader.loadSync(PROTO_FILE, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_DIR] // Important for resolving imports within protos
});
// Access the A2FControllerService definition
const loadedProto = grpc.loadPackageDefinition(packageDefinition) as any;
// Adjust path based on potential package structure in the controller proto
const controllerServiceDef = loadedProto?.nvidia_ace?.services?.a2f_controller?.v1;

// Check if the service definition object and the service constructor exist
if (!controllerServiceDef || typeof controllerServiceDef.A2FControllerService !== 'function') {
  console.error("Failed to access A2F gRPC service constructor (A2FControllerService) within nvidia_ace.services.a2f_controller.v1");
  console.log("Loaded package definition structure:", loadedProto);
  console.log("Contents of nvidia_ace.services.a2f_controller.v1:", controllerServiceDef);
  throw new Error("Failed to load A2F Controller gRPC service definition.");
}
// Get the service constructor
const A2FControllerServiceClient = controllerServiceDef.A2FControllerService;

// Create gRPC Client (do this once, potentially outside the handler if performance is critical)
// For simplicity, creating it per request here.
const createA2fClient = () => {
  const sslCreds = grpc.credentials.createSsl();
  const metadata = new grpc.Metadata();
  metadata.set('authorization', `Bearer ${nvidiaConfig.apiKey}`);
  // Assuming 'claire' model for now, adjust as needed
  // Cast the key type to satisfy TypeScript
  const modelKey = nvidiaConfig.defaultModel as keyof typeof nvidiaConfig.functionIds;
  metadata.set('function-id', nvidiaConfig.functionIds[modelKey]);

  const callCreds = grpc.credentials.createFromMetadataGenerator((_params, callback) => {
    callback(null, metadata);
  });

  const combinedCreds = grpc.credentials.combineChannelCredentials(sslCreds, callCreds);

  // Use the loaded service definition
  return new A2FControllerServiceClient(nvidiaConfig.grpcEndpoint, combinedCreds); // Use Controller service client
};
// --- End gRPC Setup ---

export async function POST(request: Request) {
  try {
    await ensureAudioDirExists(); // Make sure the directory exists before proceeding

    // Read text, apiKey, and voiceId from request body
    const { text, apiKey, voiceId = '2Lb1en5ujrODDIqmp7F3' } = await request.json();
 
    // Validate text and API key from request
    if (!text || !apiKey) {
       return NextResponse.json({ error: 'Text and API key are required' }, { status: 400 });
     }
 
 
    // Initialize client with key from request body
    const elevenlabs = new ElevenLabsClient({ apiKey });

    console.log(`Generating TTS for text: "${text.substring(0, 50)}..." using Voice ID: ${voiceId}`); // Log voiceId

    // Generate audio stream and request visemes
    const audioStream = await elevenlabs.generate({
      stream: true,
      voice: voiceId, // Use voiceId from request body (or default)
      text,
      model_id: 'eleven_multilingual_v2',
      // Request only audio
      output_format: 'mp3_44100_128', // Use an audio-only format
    });

    // --- Handling Audio Stream ---
    const audioChunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      audioChunks.push(chunk);
    }


    const audioBuffer = Buffer.concat(audioChunks);

    if (audioBuffer.length === 0) {
        console.error("TTS Error: No audio data received.");
        return NextResponse.json({ error: 'TTS generation failed: No audio data received.' }, { status: 500 });
    }
    // Note: Viseme handling removed as we are integrating A2F

    // --- Save Audio File ---
    const timestamp = Date.now();
    const fileName = `tts_audio_${timestamp}.mp3`;
    const filePath = path.join(audioDir, fileName);
    const publicUrl = `/audio/${fileName}`; // URL path relative to the public folder

    await fs.writeFile(filePath, audioBuffer);
    console.log(`Audio saved to: ${filePath}`);
    console.log(`Public URL: ${publicUrl}`);

    // --- NVIDIA Audio2Face Call ---
    let animationData: any = null; // Initialize animationData
    try {
      console.log("Connecting to NVIDIA A2F gRPC service...");
      const a2fClient = createA2fClient();
      console.log("A2F Client created. Preparing request...");

      // ASSUMPTION: Method is PushAudioStream, request structure needs audio_data and config.
      // The actual method might be unary or streaming, adjust call accordingly.
      // This example assumes a client streaming approach where we send audio chunks.

      // ASSUMPTION: The method name is likely related to the service name, e.g., pushAudioStream or similar.
      // Check the actual methods available on a2fClient if this fails.
      // Let's assume 'pushAudioStream' based on previous attempts.
      // Call the bidirectional streaming method 'processAudioStream'
      const call = a2fClient.processAudioStream(); // No initial callback needed here

      // Handle incoming data from the server stream
      let blendshapeNames: string[] = [];
      let blendshapeWeightsTimecourse: any[] = []; // To store { time_code, values }

      call.on('data', (dataChunk: any) => {
        // console.log('A2F gRPC Stream Data Received:', dataChunk); // Log raw chunk if needed

        if (dataChunk.stream_part === 'animation_data_stream_header' && dataChunk.animation_data_stream_header?.skel_animation_header?.blend_shapes) {
          blendshapeNames = dataChunk.animation_data_stream_header.skel_animation_header.blend_shapes;
          console.log(`A2F Received Blendshape Names (${blendshapeNames.length}):`, blendshapeNames);
        } else if (dataChunk.stream_part === 'animation_data' && dataChunk.animation_data?.skel_animation?.blend_shape_weights) {
          // Add the array of { time_code, values } objects to our accumulator
          blendshapeWeightsTimecourse.push(...dataChunk.animation_data.skel_animation.blend_shape_weights);
          // console.log(`A2F Received ${dataChunk.animation_data.skel_animation.blend_shape_weights.length} blendshape weight frames.`);
        } else if (dataChunk.stream_part === 'status') {
           console.log('A2F Received Status:', dataChunk.status);
        } else if (dataChunk.stream_part === 'event') {
           console.log('A2F Received Event:', dataChunk.event);
        }
      });

      // --- Send Header Message First ---
      const requestId = uuidv4();
      const streamId = uuidv4(); // Ideally, reuse streamId for a user session
      const targetObjectId = "EmmaAvatar"; // Or get from config/request

      console.log(`Sending A2F Header: ReqID=${requestId}, StreamID=${streamId}`);
      call.write({
        // stream_part oneof field:
        audio_stream_header: {
          animation_ids: {
            request_id: requestId,
            stream_id: streamId,
            target_object_id: targetObjectId,
          },
          audio_header: {
            // Assuming MP3 from ElevenLabs is 44.1kHz, 16-bit PCM equivalent after decoding?
            // A2F might prefer raw PCM. If MP3 causes issues, conversion might be needed.
            // For now, assume server handles MP3 or expects these common values.
            audio_format: 0, // AUDIO_FORMAT_PCM
            channel_count: 1,
            samples_per_second: 44100, // Match ElevenLabs output if possible
            bits_per_sample: 16,
          },
          // Send empty objects for optional parameters for now
          face_params: {},
          emotion_post_processing_params: {},
          blendshape_params: {},
          emotion_params: {},
        }
      });
      console.log("Sent A2F Header.");

      // --- Send Audio Data Message ---
      console.log(`Sending A2F Audio Buffer (${audioBuffer.length} bytes)...`);
      call.write({
        // stream_part oneof field:
        audio_with_emotion: {
          audio_buffer: audioBuffer,
          emotions: [], // Send empty emotions array for now
        }
      });
      console.log("Sent A2F Audio Buffer.");

      // --- Send End of Audio Signal ---
      console.log("Sending A2F End of Audio signal...");
      call.write({
        end_of_audio: {} // Send an empty EndOfAudio message
      });
      console.log("Sent A2F End of Audio signal.");

      // --- End Client Stream ---
      call.end(); // Now end the client's writing stream
      console.log("Ended client stream to A2F.");

      // NOTE: Because gRPC call is async and callback-based,
      // we might need to wrap this in a Promise to wait for the callback
      // before proceeding to return the NextResponse.

      // --- Wait for gRPC call to complete using a Promise ---
      // Wait for the server stream to end or error using a Promise
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("A2F gRPC call timed out.");
          try { call.cancel(); } catch (e) { console.error("Error cancelling call:", e); }
          reject(new Error("A2F gRPC call timed out"));
        }, 30000); // 30-second timeout

        call.on('error', (err: any) => {
          clearTimeout(timeout);
          console.error('A2F gRPC Stream Error:', err);
          animationData = null; // Clear any partial data
          reject(err); // Reject the promise on error
        });

        call.on('end', () => {
          clearTimeout(timeout);
          console.log('A2F gRPC Server Stream Ended.');
          // Combine names and timed values into the final animationData structure
          if (blendshapeNames.length > 0 && blendshapeWeightsTimecourse.length > 0) {
            // Sort timecourse just in case it arrives out of order
            blendshapeWeightsTimecourse.sort((a, b) => a.time_code - b.time_code);
            animationData = {
              names: blendshapeNames,
              timecourse: blendshapeWeightsTimecourse, // Array of { time_code, values }
            };
            console.log(`A2F Processed ${blendshapeWeightsTimecourse.length} animation frames.`);
          } else {
            console.warn("A2F Stream ended but necessary blendshape names or timecourse data was missing.");
            animationData = null;
          }
          resolve();
        });

        call.on('status', (status: any) => {
           console.log('A2F gRPC Stream Status:', status);
           // Status might indicate success/failure after 'end'
           if (status.code !== grpc.status.OK) {
               console.warn(`A2F gRPC call finished with non-OK status: ${status.details || status.code}`);
               // Potentially clear animationData if status indicates failure
               // animationData = null;
           }
        });
      });
      // --- End Promise ---


    } catch (grpcError) {
      console.error("Failed to call NVIDIA A2F service:", grpcError);
      // Keep animationData as null, proceed to return audio URL
    }

    // --- Return Response ---
    console.log("Returning response with audioUrl and animationData:", { publicUrl, animationData });
    return NextResponse.json({
      audioUrl: publicUrl,
      animationData: animationData, // Include animation data (will be null if A2F failed)
    });

  } catch (error: any) {
    console.error('TTS API Error:', error);
    // Provide more specific error messages if possible
    const errorMessage = error.message || 'An unknown error occurred during TTS generation.';
    const status = error.status || 500; // Use error status if available
    return NextResponse.json({ error: `TTS generation failed: ${errorMessage}` }, { status });
  }
}
