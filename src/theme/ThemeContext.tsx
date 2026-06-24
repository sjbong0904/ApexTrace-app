import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { type Theme, darkTheme, ALL_THEMES } from './themes';

const STORAGE_KEY = 'apex-trace-theme';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeById: (id: 'dark' | 'light') => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
  setThemeById: () => {},
});

function toKebab(key: string): string {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function applyCSSVariables(colors: Theme['colors']): void {
  const root = document.documentElement;
  (Object.entries(colors) as [string, string][]).forEach(([key, value]) => {
    root.style.setProperty(`--color-${toKebab(key)}`, value);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return ALL_THEMES.find((t) => t.id === saved) ?? darkTheme;
  });

  const setThemeById = useCallback((id: 'dark' | 'light') => {
    const next = ALL_THEMES.find((t) => t.id === id);
    if (next) {
      setThemeState(next);
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeById(theme.id === 'dark' ? 'light' : 'dark');
  }, [theme.id, setThemeById]);

  useEffect(() => {
    applyCSSVariables(theme.colors);
    document.documentElement.setAttribute('data-theme', theme.id);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme.id === 'dark', toggleTheme, setThemeById }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
