import { generateText } from "ai"
import { openai } from "@ai-sdk/openai" // Keep only OpenAI for SDK use

export async function POST(req: Request) {
  try {
    console.log("Chat API called")

    // Parse the request body
    const { messages, model, apiKey, apiUrl } = await req.json()

    // Validate required parameters
    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Invalid messages format" }, { status: 400 })
    }

    if (!apiKey) {
      return Response.json({ error: "API key is required" }, { status: 400 })
    }

    if (!model) {
      return Response.json({ error: "Model is required" }, { status: 400 })
    }

    console.log(`Processing request for model: ${model}`)

    // Format messages for AI SDK
    const formattedMessages = messages
      .filter((msg) => msg.role !== "system") // Handle system message separately
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

    // Get system message if it exists
    const systemMessage = messages.find((msg) => msg.role === "system")?.content || ""

    // Route request based on the selected model
    switch (model) {
      case "deepseek":
        try {
          console.log("Generating text directly with Deepseek API...")
          const deepseekApiUrl = apiUrl || "https://api.deepseek.com/v1"
          const response = await fetch(`${deepseekApiUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: messages.map((msg: any) => ({ role: msg.role, content: msg.content })),
              stream: false,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Deepseek API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
          }
          const data = await response.json()
          if (!data.choices?.[0]?.message?.content) throw new Error("Invalid response structure from Deepseek API")
          console.log("Text generated successfully via Deepseek API")
          return Response.json({ text: data.choices[0].message.content })
        } catch (error) {
          console.error("Deepseek API error:", error)
          return Response.json({ error: `Deepseek API request failed: ${error.message}` }, { status: 500 })
        }

      case "anthropic":
        try {
          console.log("Generating text directly with Anthropic API...")
          const anthropicApiUrl = apiUrl || "https://api.anthropic.com/v1/messages" // Use Messages API
          // Filter out system messages if present, as Anthropic Messages API takes it separately
          const userAssistantMessages = messages.filter((msg: any) => msg.role === 'user' || msg.role === 'assistant');

          const response = await fetch(anthropicApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-3-opus-20240229", // Or another desired Claude model
              max_tokens: 1024, // Or your desired max tokens
              system: systemMessage, // Pass system message separately
              messages: userAssistantMessages.map((msg: any) => ({ role: msg.role, content: msg.content })),
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Anthropic API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
          }
          const data = await response.json()
           // Anthropic Messages API returns content in a different structure
          if (!data.content?.[0]?.text) throw new Error("Invalid response structure from Anthropic API")
          console.log("Text generated successfully via Anthropic API")
          return Response.json({ text: data.content[0].text })
        } catch (error) {
          console.error("Anthropic API error:", error)
          return Response.json({ error: `Anthropic API request failed: ${error.message}` }, { status: 500 })
        }

      case "gemini":
        try {
          console.log("Generating text directly with Google Gemini API...")
          // Use v1beta and gemini-1.5-flash as requested
          const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`
          // Gemini requires specific role mapping ('user' and 'model') and structure
          const geminiMessages = messages
            .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant') // Filter system message if needed, handle separately
            .map((msg: any) => ({
              role: msg.role === 'assistant' ? 'model' : 'user', // Map roles
              parts: [{ text: msg.content }],
            }));

          // Prepend system message if it exists and format correctly for Gemini
          const contents = systemMessage
             ? [{ role: 'user', parts: [{ text: systemMessage }] }, { role: 'model', parts: [{ text: "Okay, I understand. How can I help?" }] }, ...geminiMessages] // Simplified system prompt handling
             : geminiMessages;


          const response = await fetch(googleApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ contents }), // Send the structured contents
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Google Gemini API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
          }
          const data = await response.json()
          // Extract text from the correct part of the Gemini response
          if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Invalid response structure from Google Gemini API")
          console.log("Text generated successfully via Google Gemini API")
          return Response.json({ text: data.candidates[0].content.parts[0].text })
        } catch (error) {
          console.error("Google Gemini API error:", error)
          return Response.json({ error: `Google Gemini API request failed: ${error.message}` }, { status: 500 })
        }

      case "openai":
      case "custom": // Assuming custom is OpenAI compatible
      default: // Default to OpenAI SDK logic
        try {
          let aiModel
          try {
             // Initialize OpenAI model using SDK
             aiModel = openai(model === 'custom' ? 'gpt-4o' : 'gpt-4o', { // Use gpt-4o or allow specific model from settings? For now, gpt-4o
                apiKey,
                baseURL: apiUrl || (model === 'custom' ? undefined : "https://api.openai.com/v1"), // Use custom URL if provided
                dangerouslyAllowMissingApiKey: model === 'custom', // Only allow missing key for custom
             });
             console.log("AI SDK model initialized successfully for OpenAI/Custom")
          } catch (initError) {
             console.error("Error creating AI SDK model:", initError)
             return Response.json({ error: `Failed to initialize AI SDK model: ${initError.message}` }, { status: 500 })
          }

          if (!aiModel) {
             return Response.json({ error: `Failed to initialize AI model for ${model}` }, { status: 500 })
          }

          console.log("Generating text with AI SDK model...")
          const { text } = await generateText({
            model: aiModel,
            messages: formattedMessages,
            system: systemMessage,
          })
          console.log("Text generated successfully via AI SDK")
          return Response.json({ text })
        } catch (error) {
          console.error("AI SDK generation error:", error)
          return Response.json({ error: `AI SDK generation failed: ${error.message}` }, { status: 500 })
        }
    }
  } catch (error) {
    console.error("Chat API error:", error)
    return Response.json({ error: `Failed to process request: ${error.message}` }, { status: 500 })
  }
}
