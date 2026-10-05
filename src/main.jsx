import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    // Only refetch when data actually changes (via invalidateQueries after a
    // mutation) or on a fresh page load — not just from switching tabs and
    // back, which is react-query's default behavior and was the cause of
    // the "page refreshes every time I come back to it" complaint.
    queries: {
      refetchOnWindowFocus: false, // Prevents refreshing data when changing browser tabs
      refetchOnReconnect: false,   // Prevents auto-refetching on reconnect
      staleTime: 1000 * 60 * 10,   // Considers cached data fresh for 10 minutes
     },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
