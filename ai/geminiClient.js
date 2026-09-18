const GEMINI_TIMEOUT_MS = 22000;
const MAX_RETRIES = 3;
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const isTransientStatus = (status) =>
  status === 408 || status === 429 || (status >= 500 && status < 600);

const isFallbackEligible = (status) =>
  status === 503 || (status >= 500 && status < 600);

const getRetryDelay = (attempt) => {
  const base = 1000 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
};

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

const sendGeminiRequest = async (targetModel, requestBody, apiKey) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      targetModel
    )}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: requestBody,
      signal: controller.signal,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    return { response, payload };
  } catch (fetchError) {
    if (fetchError.name === "AbortError") {
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
};

const generateContent = async ({
  parts,
  systemInstruction,
  temperature = 0.2,
  maxOutputTokens = 1024,
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
      maxOutputTokens,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const requestBody = JSON.stringify(body);
  let response;
  let payload = {};

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const result = await sendGeminiRequest(model, requestBody, apiKey);
    response = result.response;
    payload = result.payload;

    if (response.ok) {
      break;
    }

    if (isTransientStatus(response.status) && attempt <= MAX_RETRIES) {
      const delay = getRetryDelay(attempt - 1);
      console.warn(
        `Gemini request failed with ${response.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1}).`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    break;
  }

  if (
    !response.ok &&
    isFallbackEligible(response.status) &&
    model !== FALLBACK_MODEL
  ) {
    console.warn(
      `Gemini primary model failed with ${response.status}. Trying fallback model ${FALLBACK_MODEL}.`
    );

    const fallbackResult = await sendGeminiRequest(
      FALLBACK_MODEL,
      requestBody,
      apiKey
    );
    response = fallbackResult.response;
    payload = fallbackResult.payload;
  }

if (!response.ok) {
  const geminiMessage =
    payload?.error?.message || "Gemini request failed.";

  console.error("Gemini API error:", {
    status: response.status,
    statusText: response.statusText,
    message: geminiMessage,
  });

  const error = new Error(geminiMessage);

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
