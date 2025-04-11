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

    // Parse only messages from the request body
    const { messages } = await req.json()
    // Use the specific DeepSeek key for title generation
    const TITLE_GENERATION_API_KEY = "sk-0c198e8cdac84f4490a252bba561d3ed";

    // Validate required parameters
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Invalid or empty messages format" }, { status: 400 })
    }
    // No need to check for apiKey from request anymore
    if (!TITLE_GENERATION_API_KEY) { // Basic check for the constant (should always be true)
      return Response.json({ error: "Internal configuration error: Title generation key missing" }, { status: 500 })
    }
    // No longer need model or apiUrl from request

    console.log("Generating title using Deepseek API...")

    // Create the prompt for title generation
    const conversationSummary = truncateMessagesForTitle(messages)
    const titlePrompt = `Generate a concise title (max 5 words, plain text only, no quotes or labels) for the following conversation:\n\n${conversationSummary}`

    // Prepare messages for different APIs
    const messagesForApi = [{ role: 'user', content: titlePrompt }] // Simple prompt for title generation

    let generatedTitle = "Chat Title" // Default fallback title

    // Always use DeepSeek for title generation
    try {
      const deepseekApiUrl = "https://api.deepseek.com/v1"; // Hardcode DeepSeek URL
      const response = await fetch(`${deepseekApiUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TITLE_GENERATION_API_KEY}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: messagesForApi, stream: false, max_tokens: 20 }),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Deepseek API Error for title: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      const data = await response.json();
      if (!data.choices?.[0]?.message?.content) {
        throw new Error("Invalid response structure from Deepseek API for title");
      }
      generatedTitle = data.choices[0].message.content.trim().replace(/["']/g, ""); // Clean up title
      console.log("Title generated successfully via Deepseek API");
    } catch (error) {
      console.error("Deepseek Title API error:", error);
      // Fallback to default title on error
    }

    // Return the generated title
    return Response.json({ title: generatedTitle || "Chat" }) // Ensure a title is always returned

  } catch (error) {
    console.error("Generate Title API error:", error)
    // Return a default title in case of unexpected errors
    return Response.json({ title: "Chat" }, { status: 500 })
  }
}