import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance as SystemAppearance } from 'react-native';
import type { Language } from '../i18n/phrases';
import type { RouteProfile } from '../routing/cost';

export type Appearance = 'system' | 'light' | 'dark';

export interface Settings {
  voiceEnabled: boolean;
  /** Language of the screens and the voice guidance. */
  language: Language;
  /** Light or dark screens, or follow the phone. */
  appearance: Appearance;
  profile: RouteProfile;
  /** Replays the route with a simulated position instead of GPS. */
  simulate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  voiceEnabled: true,
  language: 'he',
  appearance: 'system',
  profile: 'safest',
  simulate: false,
};

const STORAGE_KEY = 'scoot2.settings.v1';

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  loaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Overrides the color scheme for the whole app, including native controls and useColorScheme().
  useEffect(() => {
    SystemAppearance.setColorScheme(settings.appearance === 'system' ? 'unspecified' : settings.appearance);
  }, [settings.appearance]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update, loaded }), [settings, update, loaded]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
