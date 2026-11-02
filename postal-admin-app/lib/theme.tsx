import { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export interface IPalette {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  success: string;
  warning: string;
}

const LIGHT: IPalette = {
  background: '#f1f5f9',
  surface: '#ffffff',
  surfaceMuted: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  primary: '#0f766e',
  primaryText: '#ffffff',
  danger: '#dc2626',
  success: '#059669',
  warning: '#d97706',
};

const DARK: IPalette = {
  background: '#020617',
  surface: '#0f172a',
  surfaceMuted: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  border: '#1e293b',
  primary: '#14b8a6',
  primaryText: '#042f2e',
  danger: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
};

interface IThemeContext {
  mode: 'light' | 'dark';
  colors: IPalette;
  setMode: (mode: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = createContext<IThemeContext | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const system = useColorScheme();
  const [override, setOverride] = useState<'light' | 'dark' | 'system'>('system');
  const mode = override === 'system' ? (system === 'dark' ? 'dark' : 'light') : override;

  const value = useMemo(
    () => ({ mode, colors: mode === 'dark' ? DARK : LIGHT, setMode: setOverride }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): IThemeContext => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
};
