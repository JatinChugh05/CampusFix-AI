const GEMINI_TIMEOUT_MS = 22000;

const getGeminiConfig = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  const model = String(
    process.env.GEMINI_MODEL || "gemini-3.7-flash"
  ).trim();

  return { apiKey, model };
};

const isGeminiConfigured = () => Boolean(getGeminiConfig().apiKey);

const extractText = (payload) => {
  const parts =
    payload?.candidates?.[0]?.content?.parts || [];

  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
};

const parseJsonFromText = (rawText) => {
  if (!rawText) {
    return null;
  }

  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

const generateContent = async ({
  parts,
  systemInstruction,
  temperature = 0.2,
  json = true,
}) => {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  const body = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: 1024,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response;

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Gemini request timed out.");
      timeoutError.code = "GEMINI_TIMEOUT";
      throw timeoutError;
    }

    const networkError = new Error("Unable to reach Gemini.");
    networkError.code = "GEMINI_NETWORK";
    throw networkError;
  } finally {
    clearTimeout(timeout);
  }

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || "Gemini request failed."
    );
    error.code =
      response.status === 429 ? "GEMINI_RATE_LIMIT" : "GEMINI_HTTP";
    error.status = response.status;
    throw error;
  }

  const text = extractText(payload);

  if (!text) {
    const error = new Error("Gemini returned an empty response.");
    error.code = "GEMINI_EMPTY";
    throw error;
  }

  if (!json) {
    return { text, raw: payload };
  }

  const parsed = parseJsonFromText(text);

  if (!parsed || typeof parsed !== "object") {
    const error = new Error("Gemini returned invalid JSON.");
    error.code = "GEMINI_INVALID_JSON";
    throw error;
  }

  return { json: parsed, text, raw: payload };
};

module.exports = {
  generateContent,
  isGeminiConfigured,
  parseJsonFromText,
};
