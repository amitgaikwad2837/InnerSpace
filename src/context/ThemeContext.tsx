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
  background: '#0C0F1D',
  surface: '#131929',
  surfaceAlt: '#1C2236',
  text: '#F0F4FF',
  textSecondary: '#C8D5F0',
  textMuted: '#8B9CC8',
  textDim: '#556080',
  border: '#1E2A40',
  accent: '#5BA8FF',
  accentBg: '#172847',
  danger: '#EF4444',
  success: '#34D399',
  tabBar: '#0F1526',
  tabBarBorder: '#1E2A40',
};

export const LIGHT_COLORS: typeof DARK_COLORS = {
  background: '#F2F7FF',
  surface: '#FFFFFF',
  surfaceAlt: '#E8F0FD',
  text: '#0D1A2E',
  textSecondary: '#1E3A5F',
  textMuted: '#4A6A9A',
  textDim: '#8AABCC',
  border: '#C8DCFF',
  accent: '#4A9EFF',
  accentBg: '#DCF0FF',
  danger: '#DC2626',
  success: '#16A34A',
  tabBar: '#FFFFFF',
  tabBarBorder: '#C8DCFF',
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  isDark: false,
  setMode: () => {},
  colors: LIGHT_COLORS,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

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
