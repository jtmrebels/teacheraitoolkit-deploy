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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: system || "" }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
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

    // Prefer output_text if present
    if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
      return res.status(200).json({ text: data.output_text });
    }

    // Fallback: extract from output array
    if (Array.isArray(data.output)) {
      let combined = "";

      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const content of item.content) {
            if (content.text) {
              combined += content.text + "\n";
            }
          }
        }
      }

      return res.status(200).json({ text: combined.trim() });
    }

    return res.status(200).json({ text: "" });

  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}