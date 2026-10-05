import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { VoiceLanguage } from '../i18n/phrases';
import type { RouteProfile } from '../routing/cost';

export interface Settings {
  voiceEnabled: boolean;
  voiceLanguage: VoiceLanguage;
  profile: RouteProfile;
  /** Cruising speed in km/h, used for timing estimates. */
  cruiseSpeed: number;
  /** Treat main roads without a speed sign in the map data as above 50 km/h. */
  strictUnknown: boolean;
  /** Replays the route with a simulated position instead of GPS. */
  simulate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  voiceEnabled: true,
  voiceLanguage: 'en',
  profile: 'safest',
  cruiseSpeed: 20,
  strictUnknown: true,
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
