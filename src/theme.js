import { createTheme } from '@mui/material/styles';

// Paper/ink/ledger-green palette, carried over from the original prototype,
// rather than MUI's default blue — a bookkeeping tool should feel like a
// well-kept ledger, not a generic SaaS dashboard.
const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#F5F3EE', paper: '#FFFFFF' },
    text: { primary: '#1E2B23', secondary: '#5B6760' },
    primary: { main: '#2F5A4B', light: '#3B6E5C', dark: '#20402F' },
    error: { main: '#A6472B' },
    warning: { main: '#C9A227' },
    divider: '#D9D2C2',
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
  shape: { borderRadius: 4 },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, fontSize: '0.75rem', textTransform: 'none', color: '#5B6760' } } },
    MuiButton: { styleOverrides: { root: { boxShadow: 'none' }, containedPrimary: { '&:hover': { boxShadow: 'none' } } } },
  },
});

// Class applied to elements that display monetary or numeric figures,
// giving them tabular (monospaced) numerals — appropriate for a ledger's
// columnar data, not decorative.
export const moneyFontFamily = '"IBM Plex Mono", monospace';

export default theme;
