import { appConfig, assertConfigured } from './config';

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

export async function generateWithGemini(prompt: string) {
  assertConfigured('geminiApiKey');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${appConfig.geminiModel}:generateContent?key=${appConfig.geminiApiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    let apiMessage = message;
    try {
      const parsed = JSON.parse(message) as { error?: { message?: string; status?: string } };
      apiMessage = parsed.error?.message || parsed.error?.status || message;
    } catch {
      apiMessage = message;
    }

    if (response.status === 403 && apiMessage.toLowerCase().includes('leaked')) {
      throw new Error('Gemini API key was reported as leaked. Create a new Gemini API key, update VITE_GEMINI_API_KEY, and restart Vite.');
    }

    if (response.status === 403) {
      throw new Error('Gemini permission denied. Check that the API key is valid and allowed to use the selected model.');
    }

    if (response.status === 404) {
      throw new Error(`Gemini model "${appConfig.geminiModel}" was not found or is not enabled for this API key.`);
    }

    throw new Error(`Gemini request failed (${response.status}): ${apiMessage}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}

export function getGeminiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Gemini request failed.';
}

export function extractJsonObject<T>(text: string, fallback: T): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const jsonStart = source.indexOf('{');
  const jsonEnd = source.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return fallback;

  try {
    return JSON.parse(source.slice(jsonStart, jsonEnd + 1)) as T;
  } catch {
    return fallback;
  }
}
