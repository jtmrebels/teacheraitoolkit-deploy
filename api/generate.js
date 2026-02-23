export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server misconfigured: missing OPENAI_API_KEY" });
    }

    const { model, system, prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'prompt'." });
    }

    // Basic guardrails (keeps costs predictable)
    const safeModel = (typeof model === "string" && model.length <= 60) ? model : "gpt-4.1-mini";
    const safeSystem = (typeof system === "string" && system.length <= 4000) ? system : "";
    const safePrompt = prompt.slice(0, 20000); // cap input length

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
            content: [{ type: "input_text", text: safeSystem }]
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

    // Responses API provides a convenient aggregated field: output_text (when available)
    const text = (data && typeof data.output_text === "string") ? data.output_text : "";

    if (!text) {
      return res.status(200).json({ text: "" });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}