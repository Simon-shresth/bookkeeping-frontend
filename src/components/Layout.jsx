import { NavLink, Outlet } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton, ListItemText, Chip, Button } from '@mui/material';
import { useAuth, hasRole } from '../context/AuthContext';

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Chart of Accounts', path: '/chart-of-accounts' },
  { label: 'Journal Entries', path: '/journal' },
  { label: 'General Ledger', path: '/ledger' },
  { label: 'Customers', path: '/customers' },
  { label: 'Suppliers', path: '/suppliers' },
  { label: 'Products', path: '/products' },
  { label: 'Sales', path: '/sales' },
  { label: 'Purchases', path: '/purchases' },
  { label: 'Salary', path: '/salary' },
  { label: 'Expenses', path: '/expenses' },
  { label: 'Payments', path: '/payments' },
  { label: 'Bank Reconciliation', path: '/reconciliation', minRole: 'accountant' },
  { label: 'Reports', path: '/reports' },
  { label: 'Users', path: '/users', minRole: 'admin' },
  { label: 'Audit Log', path: '/audit', minRole: 'admin' },
];

export default function Layout() {
  const { profile, signOut } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !item.minRole || hasRole(profile, item.minRole));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}
      >
        <Toolbar sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">Ledger</Typography>
        </Toolbar>
        <List sx={{ pt: 1 }}>
          {visibleItems.map((item) => (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path}
              end={item.path === '/'}
              sx={{
                '&.active': { borderLeft: '2px solid', borderColor: 'primary.main', bgcolor: 'action.selected' },
                borderLeft: '2px solid transparent',
              }}
            >
              <ListItemText primaryTypographyProps={{ fontSize: 14 }}>{item.label}</ListItemText>
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar sx={{ justifyContent: 'flex-end', gap: 1.5 }}>
            {profile && (
              <>
                <Typography variant="body2" color="text.secondary">{profile.email}</Typography>
                <Chip label={profile.role} size="small" variant="outlined" />
              </>
            )}
            <Button size="small" onClick={signOut}>Sign out</Button>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: 3, maxWidth: 1100 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
