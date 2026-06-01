/**
 * Theme context — dark / light mode toggle.
 * Persists the user's choice in AsyncStorage.
 * Defaults to dark if no preference is saved.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const THEME_KEY = '@innerspace:theme';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  colors: typeof DARK_COLORS;
}

export const DARK_COLORS = {
  background: '#0A0F1E',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  text: '#FFFFFF',
  textSecondary: '#CBD5E1',
  textMuted: '#8B9CC8',
  textDim: '#5A6478',
  border: '#1F2937',
  accent: '#4A9EFF',
  accentBg: '#1A3A6B',
  danger: '#EF4444',
  success: '#22C55E',
  tabBar: '#111827',
  tabBarBorder: '#1F2937',
};

export const LIGHT_COLORS: typeof DARK_COLORS = {
  background: '#F0F4FF',
  surface: '#FFFFFF',
  surfaceAlt: '#E8EDF8',
  text: '#0A0F1E',
  textSecondary: '#1E2A4A',
  textMuted: '#4A5578',
  textDim: '#8B9CC8',
  border: '#D1D9EF',
  accent: '#1A5FBB',
  accentBg: '#D6E8FF',
  danger: '#DC2626',
  success: '#16A34A',
  tabBar: '#FFFFFF',
  tabBarBorder: '#D1D9EF',
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  isDark: true,
  setMode: () => {},
  colors: DARK_COLORS,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const isDark =
    mode === 'system' ? systemScheme !== 'light' : mode === 'dark';

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  async function setMode(m: ThemeMode) {
    setModeState(m);
    await AsyncStorage.setItem(THEME_KEY, m);
  }

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
