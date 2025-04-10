// mental-health-ai/app/api/tts/route.ts
import { NextResponse } from 'next/server';
import { ElevenLabsClient } from "elevenlabs";
import fs from "fs/promises";
import path from "path";
import { PassThrough } from 'stream';

// Ensure the public audio direcImptory exists
const audioDir = path.join(process.cwd(), 'public', 'audio');
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
      // Request visemes along with the audio
      output_format: 'mp3_44100_128_with_visemes', // Use the format that includes visemes
    });

    // --- Handling Stream with Audio and Visemes ---
    const audioChunks: Buffer[] = [];
    let visemeData: any = null; // To store the parsed viseme JSON

    // Use PassThrough to handle the mixed stream (audio bytes + JSON metadata)
    const passThrough = new PassThrough();
    audioStream.pipe(passThrough);

    // Accumulate chunks and try to parse JSON for visemes
    let potentialJson = '';
    for await (const chunk of passThrough) {
        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        // Attempt to detect and parse JSON metadata (visemes)
        // ElevenLabs often sends JSON lines separated by newlines within the stream
        potentialJson += bufferChunk.toString('utf8');
        const lines = potentialJson.split('\n');

        let jsonParsed = false;
        for (let i = 0; i < lines.length - 1; i++) { // Process all lines except the last (potentially incomplete)
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) { // Basic JSON check
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.visemes) { // Check if it looks like viseme data
                        visemeData = parsed;
                        console.log("Parsed Viseme Data from stream.");
                        jsonParsed = true;
                        potentialJson = lines.slice(i + 1).join('\n'); // Keep the rest for next iteration
                        break; // Assume only one viseme JSON object per stream for now
                    }
                } catch (e) {
                    // Not valid JSON, likely audio data, ignore parsing error
                }
            }
        }

        // If no JSON was parsed from this chunk, assume it's audio data
        if (!jsonParsed) {
            audioChunks.push(bufferChunk);
            potentialJson = lines[lines.length - 1]; // Keep the last potentially incomplete line
        } else {
             // If JSON was parsed, the remaining potentialJson might contain the start of audio data
             // Add it to audio chunks if it's not empty after parsing
             if(potentialJson.length > 0) {
                 audioChunks.push(Buffer.from(potentialJson, 'utf8'));
                 potentialJson = ''; // Reset potentialJson
             }
        }
    }
    // Handle any remaining data in potentialJson (likely audio)
    if (potentialJson.length > 0 && !visemeData) {
         try {
             // Final check if the remaining buffer is the viseme JSON
             const parsed = JSON.parse(potentialJson.trim());
             if (parsed.visemes) {
                 visemeData = parsed;
                 console.log("Parsed Viseme Data from remaining buffer.");
             } else {
                 audioChunks.push(Buffer.from(potentialJson, 'utf8'));
             }
         } catch(e) {
              audioChunks.push(Buffer.from(potentialJson, 'utf8'));
         }
    }


    const audioBuffer = Buffer.concat(audioChunks);

    if (audioBuffer.length === 0) {
        console.error("TTS Error: No audio data received.");
        return NextResponse.json({ error: 'TTS generation failed: No audio data received.' }, { status: 500 });
    }
     if (!visemeData) {
        console.warn("TTS Warning: No viseme data received or parsed from stream.");
        // Proceed without visemes, or return an error if they are mandatory
        // visemeData = { visemes: [] }; // Send empty visemes if proceeding
    }

    // --- Save Audio File ---
    const timestamp = Date.now();
    const fileName = `tts_audio_${timestamp}.mp3`;
    const filePath = path.join(audioDir, fileName);
    const publicUrl = `/audio/${fileName}`; // URL path relative to the public folder

    await fs.writeFile(filePath, audioBuffer);
    console.log(`Audio saved to: ${filePath}`);
    console.log(`Public URL: ${publicUrl}`);

    // --- Prepare Lip Sync Data ---
    // Use the parsed visemeData if available
    const lipSyncData = visemeData || { visemes: [] }; // Use parsed data or default


    return NextResponse.json({
      audioUrl: publicUrl,
      lipSyncData: lipSyncData,
    });

  } catch (error: any) {
    console.error('TTS API Error:', error);
    // Provide more specific error messages if possible
    const errorMessage = error.message || 'An unknown error occurred during TTS generation.';
    const status = error.status || 500; // Use error status if available
    return NextResponse.json({ error: `TTS generation failed: ${errorMessage}` }, { status });
  }
}
