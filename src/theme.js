import { createTheme } from '@mui/material/styles';

export const moneyFontFamily = '"IBM Plex Mono", monospace';

export function getTheme(mode = 'light') {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: isDark
        ? { main: '#3B82F6', light: '#60A5FA', dark: '#1D4ED8', contrastText: '#FFFFFF' }
        : { main: '#2563EB', light: '#3B82F6', dark: '#1D4ED8', contrastText: '#FFFFFF' },
      background: isDark
        ? { default: '#000000', paper: '#000000' }
        : { default: '#F8FAFC', paper: '#FFFFFF' },
      text: isDark
        ? { primary: '#F8FAFC', secondary: '#94A3B8' }
        : { primary: '#0F172A', secondary: '#64748B' },
      divider: isDark ? '#262626' : '#E2E8F0',
      error: { main: '#EF4444' },
      warning: { main: '#F59E0B' },
      success: { main: '#10B981' },
      action: isDark
        ? {
            selected: 'rgba(59, 130, 246, 0.16)',
            hover: 'rgba(255, 255, 255, 0.06)',
          }
        : {
            selected: 'rgba(37, 99, 235, 0.08)',
            hover: 'rgba(0, 0, 0, 0.04)',
          },
    },
    typography: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      h1: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
      h2: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
      h3: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
      h4: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
      h5: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
      h6: { fontFamily: '"Source Serif 4", serif', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: isDark ? '1px solid #262626' : undefined,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'none',
            color: isDark ? '#94A3B8' : '#64748B',
          },
          root: {
            borderColor: isDark ? '#262626' : '#E2E8F0',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
          },
          containedPrimary: {
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
    },
  });
}

const defaultTheme = getTheme('light');
export default defaultTheme;
