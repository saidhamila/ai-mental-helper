import { NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';
import { Readable } from 'stream';

// Note: We will instantiate the client inside the POST handler now,
// using the API key provided in the request.
// const speechClient = new SpeechClient(); // No longer instantiate globally

export async function POST(request: Request) {
  console.log("Speech API route called");

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const apiKey = formData.get('apiKey') as string | null; // Get API key
    const languageCode = formData.get('languageCode') as string || 'en-US'; // Default to English

    if (!audioFile) {
      console.error("No audio file received");
      return NextResponse.json({ error: 'No audio file received' }, { status: 400 });
    }

    // Check for API Key
    if (!apiKey) {
      console.error("No API key received from frontend");
      return NextResponse.json({ error: 'API key is missing' }, { status: 400 });
    }

    console.log(`Received audio file: ${audioFile.name}, size: ${audioFile.size}, type: ${audioFile.type}`);
    console.log(`Using language code: ${languageCode}`);

    // Convert the File blob to a Buffer
    const audioBytes = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(audioBytes);

    // Prepare the request for Google Cloud Speech API
    const audio = {
      content: audioBuffer.toString('base64'),
    };
    const config = {
      // Encoding needs to match the format from the frontend recorder
      // Common formats: 'LINEAR16', 'WEBM_OPUS', 'OGG_OPUS'
      // Let's assume WEBM_OPUS for now, might need adjustment based on frontend recorder
      encoding: 'WEBM_OPUS' as const, // Adjust if necessary
      // Sample rate might also need adjustment based on recorder settings
      // sampleRateHertz: 16000, // Common rate, adjust if needed
      languageCode: languageCode, // Use language from request or default
      // model: 'telephony', // Optional: specify model for better accuracy in some cases
    };
    const speechRequest = {
      audio: audio,
      config: config,
    };

    console.log("Sending request to Google Cloud Speech API...");

    // Instantiate client using the API key directly via the 'key' option
    // **IMPORTANT:** Replace 'YOUR_GOOGLE_CLOUD_PROJECT_ID' with your actual project ID.
    const speechClient = new SpeechClient({
        key: apiKey,
        projectId: 'YOUR_GOOGLE_CLOUD_PROJECT_ID', // Explicitly provide Project ID
        // Note: Using an API Key has limitations compared to a Service Account.
        // Ensure the key is unrestricted or properly restricted for the Speech API.
    });

    // Detects speech in the audio file
    const [response] = await speechClient.recognize(speechRequest);

    console.log("Received response from Google Cloud Speech API");

    if (!response.results || response.results.length === 0) {
      console.log("No transcription results found.");
      return NextResponse.json({ transcription: '' }); // Return empty if no results
    }

    // Get the most likely transcription
    const transcription = response.results
      .map(result => result.alternatives?.[0]?.transcript)
      .filter(transcript => transcript !== undefined) // Filter out undefined transcripts
      .join('\n'); // Join multiple results if any

    console.log(`Transcription: ${transcription}`);

    return NextResponse.json({ transcription });

  } catch (error: any) { // Type error as any to access potential properties
    console.error('--- ERROR PROCESSING SPEECH REQUEST ---');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code); // Google API errors often have a code
    console.error('Error Details:', error.details); // May contain more specific info
    console.error('Stack Trace:', error.stack);
    console.error('--------------------------------------');

    // Provide a slightly more informative error message to the client, but avoid leaking sensitive details
    const clientErrorMessage = `Failed to process speech. Code: ${error.code || 'UNKNOWN'}`;
    return NextResponse.json({ error: clientErrorMessage, details: error.message }, { status: 500 });
  }
}
