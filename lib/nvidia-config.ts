// lib/nvidia-config.ts

// IMPORTANT: In production, use environment variables for sensitive data like API keys.
// Example: process.env.NVIDIA_A2F_API_KEY

export const nvidiaConfig = {
  apiKey: "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",
  grpcEndpoint: "grpc.nvcf.nvidia.com:443",
  functionIds: {
    mark: "b85c53f3-5d18-4edf-8b12-875a400eb798",
    claire: "a05a5522-3059-4dfd-90e4-4bc1699ae9d4", // Default?
    james: "52f51a79-324c-4dbe-90ad-798ab665ad64",
  },
  // Default model to use if not specified elsewhere
  defaultModel: "claire",
};