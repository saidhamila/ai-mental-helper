// Configuration for ElevenLabs API
// IMPORTANT: Replace 'YOUR_ELEVENLABS_API_KEY' with your actual key.
// Keep this file secure and avoid committing your actual API key to version control if possible.
// Consider using environment variables for production deployments.

export const elevenLabsConfig = {
  apiKey: process.env.ELEVENLABS_API_KEY || "sk_b1582a52920a7991f1b935e0efe3ee2236a42365d57d2ea0", // Use environment variable or fallback to manual entry
  apiUrl: "https://api.elevenlabs.io/v1", // Default API URL
  voiceId: "2Lb1en5ujrODDIqmp7F3", // Default Voice ID
};

// Basic validation to warn if the key is still the placeholder
if (elevenLabsConfig.apiKey === "sk_b1582a52920a7991f1b935e0efe3ee2236a42365d57d2ea0") {
  console.warn(
    "ElevenLabs API Key is set to the placeholder value in elevenlabs-config.ts. " +
    "Please replace 'YOUR_ELEVENLABS_API_KEY' with your actual key or set the ELEVENLABS_API_KEY environment variable."
  );
}