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
        maxOutputTokens: 1400,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${message}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
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
