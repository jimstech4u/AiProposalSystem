import { appConfig, assertConfigured } from './config';

type NvidiaResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

// NVIDIA's API does not send CORS headers, so a direct browser call is blocked.
// In dev we route through the Vite proxy (see vite.config.ts); in a production
// build the request goes straight to NVIDIA (requires a CORS-enabled reverse proxy).
const nvidiaBaseUrl = (import.meta as any).env?.DEV
  ? '/nvidia-api/v1'
  : 'https://integrate.api.nvidia.com/v1';

export async function generateWithNvidia(prompt: string) {
  assertConfigured('nvidiaApiKey');

  const response = await fetch(`${nvidiaBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appConfig.nvidiaApiKey}`,
    },
    body: JSON.stringify({
      model: appConfig.nvidiaModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.35,
      top_p: 0.9,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    let apiMessage = message;
    try {
      const parsed = JSON.parse(message) as {
        detail?: string;
        title?: string;
        error?: { message?: string };
      };
      apiMessage = parsed.detail || parsed.error?.message || parsed.title || message;
    } catch {
      apiMessage = message;
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('NVIDIA authentication failed. Set VITE_NVIDIA_API_KEY to a valid key (it should start with "nvapi-") and restart Vite.');
    }

    if (response.status === 404 || response.status === 410) {
      throw new Error(`NVIDIA model "${appConfig.nvidiaModel}" is unavailable (it may be retired). Set VITE_NVIDIA_MODEL to a current model and restart Vite.`);
    }

    const requestError = new Error(`NVIDIA request failed (${response.status}): ${apiMessage}`);
    if (response.status === 429 || response.status === 503) {
      (requestError as any).status = response.status;
      (requestError as any).retryAfterMs = parseRetryDelayMs(apiMessage);
    }
    throw requestError;
  }

  const data = (await response.json()) as NvidiaResponse;
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('NVIDIA returned an empty response.');
  }

  return text;
}

export function getNvidiaErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'NVIDIA request failed.';
}

export function isNvidiaQuotaError(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as any).status === 429);
}

export function isNvidiaRetryableError(error: unknown) {
  return Boolean(error && typeof error === 'object' && [429, 503].includes((error as any).status));
}

export function getNvidiaRetryAfterMs(error: unknown) {
  if (error && typeof error === 'object' && typeof (error as any).retryAfterMs === 'number') {
    return (error as any).retryAfterMs as number;
  }

  return 2000;
}

function parseRetryDelayMs(message: string) {
  const match = message.match(/retry in\s+([0-9.]+)s/i);
  if (!match) return 2000;
  return Math.max(1000, Math.ceil(Number(match[1]) * 1000));
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
