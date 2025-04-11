// mental-health-ai/app/api/tts/route.ts
import { NextResponse } from 'next/server';
import { ElevenLabsClient } from "elevenlabs";
import fs from "fs/promises";
import path from "path";
import { PassThrough } from 'stream';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { nvidiaConfig } from '@/lib/nvidia-config'; // Import NVIDIA config
// Ensure the public audio directory exists
const audioDir = path.join(process.cwd(), 'public', 'audio');
const PROTO_DIR = path.join(process.cwd(), 'Audio2Face-3D-Samples', 'proto', 'protobuf_files');
const PROTO_FILE = path.join(PROTO_DIR, 'nvidia_ace.services.a2f.v1.proto'); // Main service definition
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
// Access the service definition based on the logged structure
const loadedProto = grpc.loadPackageDefinition(packageDefinition) as any;
// Access the service definition object directly based on logged structure
const a2fServiceDefObject = loadedProto?.nvidia_ace?.services?.a2f?.v1;

// Check if the service definition object and the service constructor exist using the correct name 'A2FService'
if (!a2fServiceDefObject || typeof a2fServiceDefObject.A2FService !== 'function') {
  console.error("Failed to access A2F gRPC service constructor (A2FService) within nvidia_ace.services.a2f.v1");
  console.log("Loaded package definition structure:", loadedProto);
  console.log("Contents of nvidia_ace.services.a2f.v1:", a2fServiceDefObject);
  throw new Error("Failed to load A2F gRPC service definition.");
}
// Get the service constructor using the correct name
const A2FServiceClient = a2fServiceDefObject.A2FService;

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
  return new A2FServiceClient(nvidiaConfig.grpcEndpoint, combinedCreds);
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

    console.log(`Generating TTS for text: "${text.substring(0, 50)}..."`);

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
      // Ensure method name casing is correct (e.g., pushAudioStream). Check proto/client definition if unsure.
      const call = a2fClient.pushAudioStream((error: any, response: any) => {
        if (error) {
          console.error('A2F gRPC Response Error:', error);
          // Decide how to handle A2F error - maybe return audio only?
          // For now, we'll let the outer catch handle it or proceed without animationData.
        } else {
          console.log('A2F gRPC Response Success:', response);
          // ASSUMPTION: Response structure contains blendshape data, e.g., response.blend_shape_data
          animationData = response; // Store the full response for now
        }
      });

      // Send audio data
      // TODO: Determine if A2F expects specific chunking or headers/config first.
      // Sending the whole buffer might work for unary, but streaming might need chunks.
      // Sending config first might be required for streaming calls.

      // Example: Sending config (adjust based on actual proto definition)
      // call.write({
      //   config: {
      //     sample_rate_hertz: 44100, // Assuming 44.1 kHz MP3 from ElevenLabs
      //     // Other config params?
      //   }
      // });

      // Send audio buffer (adjust chunking if needed for streaming)
      // For simplicity, sending the whole buffer. If it needs chunks:
      // const chunkSize = 4096; // Example chunk size
      // for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      //   const chunk = audioBuffer.slice(i, i + chunkSize);
      //   call.write({ audio_data: chunk });
      // }
       call.write({ audio_data: audioBuffer }); // Send full buffer


      // End the stream once all data is sent
      call.end();
      console.log("Sent audio data to A2F and ended stream.");

      // NOTE: Because gRPC call is async and callback-based,
      // we might need to wrap this in a Promise to wait for the callback
      // before proceeding to return the NextResponse.

      // --- Wait for gRPC call to complete using a Promise ---
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("A2F gRPC call timed out.");
          try {
            call.cancel(); // Attempt to cancel the call on timeout
          } catch (cancelError) {
            console.error("Error cancelling gRPC call:", cancelError);
          }
          reject(new Error("A2F gRPC call timed out"));
        }, 30000); // 30-second timeout

        call.on('data', (dataChunk: any) => {
          // If response is streamed, accumulate data here
          console.log('A2F gRPC Stream Data:', dataChunk);
          // Example: Assuming the last chunk has the final data or merge logic needed
          // You might need to accumulate chunks into a single object/array
          animationData = dataChunk; // Replace or merge based on actual API behavior
        });

        call.on('error', (err: any) => {
          clearTimeout(timeout);
          console.error('A2F gRPC Stream Error:', err);
          animationData = null; // Ensure data is null on error
          // Don't reject here if we want to return audioUrl anyway, just resolve.
          resolve();
        });

        call.on('end', () => {
          clearTimeout(timeout);
          console.log('A2F gRPC Stream Ended.');
          // Final data should be in animationData if set by 'data' or the initial callback
          resolve();
        });

        call.on('status', (status: any) => {
           console.log('A2F gRPC Stream Status:', status);
           // Optionally handle non-OK status here, maybe resolve without rejecting
           if (status.code !== grpc.status.OK) {
               console.warn(`A2F gRPC call finished with status: ${status.details || status.code}`);
               // animationData might be null or partially complete depending on the error
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
