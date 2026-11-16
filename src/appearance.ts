import {useCallback, useEffect, useLayoutEffect, useState} from 'react';

export interface AppearancePreferences {
  theme: 'system' | 'light' | 'dark';
  background: 'paper' | 'sage' | 'blue' | 'rose';
  font: 'sans' | 'serif';
  textSize: number;
  textColor: 'default' | 'blue' | 'plum';
  alignment: 'left' | 'justify';
}

export const APPEARANCE_STORAGE_KEY = 'mathfolio-appearance-v1';
export const DEFAULT_APPEARANCE: Readonly<AppearancePreferences> = Object.freeze({
  theme: 'system', background: 'paper', font: 'sans', textSize: 16,
  textColor: 'default', alignment: 'left',
});

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : fallback;
}

/** Only allow known preferences, including when recovering older or damaged records. */
export function parseAppearancePreferences(value: unknown): AppearancePreferences {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    theme: choice(record.theme, ['system', 'light', 'dark'], DEFAULT_APPEARANCE.theme),
    background: choice(record.background, ['paper', 'sage', 'blue', 'rose'], DEFAULT_APPEARANCE.background),
    font: choice(record.font, ['sans', 'serif'], DEFAULT_APPEARANCE.font),
    textSize: typeof record.textSize === 'number' && Number.isFinite(record.textSize)
      ? Math.max(14, Math.min(24, Math.round(record.textSize))) : DEFAULT_APPEARANCE.textSize,
    textColor: choice(record.textColor, ['default', 'blue', 'plum'], DEFAULT_APPEARANCE.textColor),
    alignment: choice(record.alignment, ['left', 'justify'], DEFAULT_APPEARANCE.alignment),
  };
}

function browserStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function loadAppearancePreferences(
  storage: Pick<Storage, 'getItem'> | undefined = browserStorage(),
): AppearancePreferences {
  try {
    const saved = storage?.getItem(APPEARANCE_STORAGE_KEY);
    return parseAppearancePreferences(saved ? JSON.parse(saved) : undefined);
  } catch { return {...DEFAULT_APPEARANCE}; }
}

export function saveAppearancePreferences(
  preferences: AppearancePreferences,
  storage: Pick<Storage, 'setItem'> | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(parseAppearancePreferences(preferences)));
    return true;
  } catch { return false; }
}

export interface AppearanceController {
  preferences: AppearancePreferences;
  resolvedTheme: 'light' | 'dark';
  savedLocally: boolean;
  updateAppearance: (patch: Partial<AppearancePreferences>) => void;
  resetAppearance: () => void;
}

export function useAppearance(): AppearanceController {
  const [preferences, setPreferences] = useState(loadAppearancePreferences);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches : false);
  const [savedLocally, setSavedLocally] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const resolvedTheme = preferences.theme === 'system'
    ? systemDark ? 'dark' : 'light' : preferences.theme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.paper = preferences.background;
    root.dataset.readingFont = preferences.font;
    root.dataset.ink = preferences.textColor;
    root.dataset.readingAlign = preferences.alignment;
    root.style.setProperty('--reading-size', `${preferences.textSize}px`);
  }, [preferences, resolvedTheme]);

  useEffect(() => {
    setSavedLocally(saveAppearancePreferences(preferences));
  }, [preferences]);

  const updateAppearance = useCallback((patch: Partial<AppearancePreferences>) => {
    setPreferences(current => parseAppearancePreferences({...current, ...patch}));
  }, []);
  const resetAppearance = useCallback(() => setPreferences({...DEFAULT_APPEARANCE}), []);

  return {preferences, resolvedTheme, savedLocally, updateAppearance, resetAppearance};
}
