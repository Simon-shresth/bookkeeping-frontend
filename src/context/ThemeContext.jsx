import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getTheme } from '../theme';

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'bksys_theme_mode';

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (_) {}
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => getTheme(mode), [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleTheme,
      isDark: mode === 'dark',
    }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
