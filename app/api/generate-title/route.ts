// No AI SDK imports needed for this route anymore

// Helper function to truncate messages for the title prompt
const truncateMessagesForTitle = (messages: any[], maxLength = 500): string => {
  let content = messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n")

  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + "..."
  }
  return content
}

export async function POST(req: Request) {
  try {
    console.log("Generate Title API called")

    // Parse the request body
    const { messages, model, apiUrl } = await req.json() // Remove apiKey from request body
    const TITLE_GENERATION_API_KEY = "sk-1060331e86074966a7e8a91d7f6714b0" // Hardcoded key

    // Validate required parameters
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Invalid or empty messages format" }, { status: 400 })
    }
    // No need to check for apiKey from request anymore
    if (!TITLE_GENERATION_API_KEY) { // Basic check for the constant (should always be true)
      return Response.json({ error: "Internal configuration error: Title generation key missing" }, { status: 500 })
    }
    if (!model) {
      return Response.json({ error: "Model is required" }, { status: 400 })
    }

    console.log(`Generating title for model: ${model}`)

    // Create the prompt for title generation
    const conversationSummary = truncateMessagesForTitle(messages)
    const titlePrompt = `Generate a concise title (max 5 words, plain text only, no quotes or labels) for the following conversation:\n\n${conversationSummary}`

    // Prepare messages for different APIs
    const messagesForApi = [{ role: 'user', content: titlePrompt }] // Simple prompt for title generation

    let generatedTitle = "Chat Title" // Default fallback title

    // Route request based on the selected model
    switch (model) {
      case "deepseek":
        try {
          console.log("Generating title directly with Deepseek API...")
          const deepseekApiUrl = apiUrl || "https://api.deepseek.com/v1"
          const response = await fetch(`${deepseekApiUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${TITLE_GENERATION_API_KEY}` },
            body: JSON.stringify({ model: "deepseek-chat", messages: messagesForApi, stream: false, max_tokens: 20 }),
          })
          if (!response.ok) throw new Error(`Deepseek API Error: ${response.status} ${response.statusText}`)
          const data = await response.json()
          if (!data.choices?.[0]?.message?.content) throw new Error("Invalid response structure from Deepseek API")
          generatedTitle = data.choices[0].message.content.trim().replace(/["']/g, "") // Clean up title
          console.log("Title generated successfully via Deepseek API")
        } catch (error) {
          console.error("Deepseek Title API error:", error)
          // Fallback to default title on error
        }
        break

      case "anthropic":
        try {
          console.log("Generating title directly with Anthropic API...")
          const anthropicApiUrl = apiUrl || "https://api.anthropic.com/v1/messages"
          const response = await fetch(anthropicApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": TITLE_GENERATION_API_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 20, messages: messagesForApi }), // Use Haiku for speed/cost
          })
          if (!response.ok) throw new Error(`Anthropic API Error: ${response.status} ${response.statusText}`)
          const data = await response.json()
          if (!data.content?.[0]?.text) throw new Error("Invalid response structure from Anthropic API")
          generatedTitle = data.content[0].text.trim().replace(/["']/g, "") // Clean up title
          console.log("Title generated successfully via Anthropic API")
        } catch (error) {
          console.error("Anthropic Title API error:", error)
          // Fallback to default title on error
        }
        break

      case "gemini":
        try {
          console.log("Generating title directly with Google Gemini API...")
          const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${TITLE_GENERATION_API_KEY}`
          const response = await fetch(googleApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: titlePrompt }] }] }), // Simple content structure
          })
          if (!response.ok) throw new Error(`Google Gemini API Error: ${response.status} ${response.statusText}`)
          const data = await response.json()
          if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Invalid response structure from Google Gemini API")
          generatedTitle = data.candidates[0].content.parts[0].text.trim().replace(/["']/g, "") // Clean up title
          console.log("Title generated successfully via Google Gemini API")
        } catch (error) {
          console.error("Google Gemini Title API error:", error)
          // Fallback to default title on error
        }
        break

      case "openai":
      case "custom":
      default:
        // Direct fetch for OpenAI / Custom / Default
        try {
          console.log("Generating title directly with OpenAI/Custom API...")
          const effectiveApiUrl = apiUrl || "https://api.openai.com/v1" // Default to OpenAI if not provided
          // Use a fast model like gpt-3.5-turbo for titles. Consider making this configurable if needed.
          const effectiveModel = model === 'custom' ? 'gpt-3.5-turbo' : 'gpt-3.5-turbo'

          const response = await fetch(`${effectiveApiUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${TITLE_GENERATION_API_KEY}`,
            },
            body: JSON.stringify({
              model: effectiveModel,
              messages: messagesForApi, // Use the pre-defined title prompt message
              max_tokens: 20, // Limit tokens for title generation
              stream: false,
            }),
          })

          if (!response.ok) {
             const errorData = await response.json().catch(() => ({}))
             throw new Error(`OpenAI/Custom API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
          }
          const data = await response.json()
          if (!data.choices?.[0]?.message?.content) throw new Error("Invalid response structure from OpenAI/Custom API")
          generatedTitle = data.choices[0].message.content.trim().replace(/["']/g, "") // Clean up title
          console.log("Title generated successfully via OpenAI/Custom API")
        } catch (error) {
          console.error("OpenAI/Custom Title API error:", error)
          // Fallback to default title on error
        }
        break
    }

    // Return the generated title
    return Response.json({ title: generatedTitle || "Chat" }) // Ensure a title is always returned

  } catch (error) {
    console.error("Generate Title API error:", error)
    // Return a default title in case of unexpected errors
    return Response.json({ title: "Chat" }, { status: 500 })
  }
}