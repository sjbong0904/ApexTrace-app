import { createContext, useContext } from 'react';
import { type Theme, darkTheme } from './themes';

export interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeById: (id: 'dark' | 'light') => void;
}

/** Lives outside ThemeContext.tsx so that file exports only the provider component (Fast Refresh). */
export const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
  setThemeById: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
