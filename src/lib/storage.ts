const prefix = 'proposalai:';

export function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(`${prefix}${key}`);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function removeJson(key: string) {
  window.localStorage.removeItem(`${prefix}${key}`);
}
