import { readJson, saveJson } from './storage';

export type ThemeMode = 'light' | 'dark';

export function getStoredTheme(): ThemeMode {
  return readJson<ThemeMode>('theme', 'light');
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
}

export function setStoredTheme(mode: ThemeMode) {
  saveJson('theme', mode);
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent('proposalai:theme-change', { detail: mode }));
}
