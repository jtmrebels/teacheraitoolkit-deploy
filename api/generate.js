export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const { model, system, prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'prompt'." });
    }

    // Keep requests predictable
    const safeModel = (typeof model === "string" && model.length <= 60) ? model : "gpt-4.1-mini";
    const safeSystem = (typeof system === "string" && system.length <= 4000) ? system : "";
    const safePrompt = prompt.slice(0, 20000);

    // Add a small formatting instruction to avoid LaTeX escapes in teacher-facing output
    const formattingNote =
      "\n\nFormatting requirements:\n" +
      "- Use plain text math (e.g., 3/4) unless the user explicitly asks for LaTeX.\n" +
      "- Keep output classroom-ready and easy to copy/paste.\n";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: safeModel,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: safeSystem + formattingNote }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: safePrompt }]
          }
        ],
        max_output_tokens: 900
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenAI request failed",
        details: data
      });
    }

    // Prefer output_text if available
    let text = (typeof data.output_text === "string") ? data.output_text : "";

    // Fallback: extract any content.text entries
    if (!text && Array.isArray(data.output)) {
      let combined = "";
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (typeof c.text === "string") combined += c.text + "\n";
          }
        }
      }
      text = combined.trim();
    }

    // Last cleanup pass: remove common LaTeX wrappers if they still appear
    if (text) {
      text = text
        .replace(/\\\(/g, "")
        .replace(/\\\)/g, "")
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/\\\\/g, "\\");
    }

    return res.status(200).json({ text: text || "" });

  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}