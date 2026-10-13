import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton, ListItemText, ListItemIcon, Chip, Button, IconButton } from '@mui/material';
import {
  DashboardOutlined, AccountBalanceOutlined, MenuBookOutlined, ReceiptLongOutlined,
  PeopleAltOutlined, LocalShippingOutlined, Inventory2Outlined, TrendingUpOutlined,
  ShoppingCartOutlined, AttachMoneyOutlined, BadgeOutlined, PaymentsOutlined,
  CheckCircleOutline, AssessmentOutlined, AdminPanelSettingsOutlined, HistoryOutlined,
  ChevronLeft, ChevronRight, PlaylistAddOutlined,
} from '@mui/icons-material';
import { useAuth, hasRole } from '../context/AuthContext';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 72;

const ICONS = {
  '/': DashboardOutlined,
  '/chart-of-accounts': AccountBalanceOutlined,
  '/journal': MenuBookOutlined,
  '/ledger': ReceiptLongOutlined,
  '/opening-balances': PlaylistAddOutlined,
  '/customers': PeopleAltOutlined,
  '/suppliers': LocalShippingOutlined,
  '/products': Inventory2Outlined,
  '/sales': TrendingUpOutlined,
  '/purchases': ShoppingCartOutlined,
  '/expenses': AttachMoneyOutlined,
  '/salary': BadgeOutlined,
  '/payments': PaymentsOutlined,
  '/reconciliation': CheckCircleOutline,
  '/reports': AssessmentOutlined,
  '/users': AdminPanelSettingsOutlined,
  '/audit': HistoryOutlined,
};

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Chart of Accounts', path: '/chart-of-accounts' },
  { label: 'Journal Entries', path: '/journal' },
  { label: 'General Ledger', path: '/ledger' },
  { label: 'Opening Balances', path: '/opening-balances', minRole: 'accountant' },
  { label: 'Customers', path: '/customers' },
  { label: 'Suppliers', path: '/suppliers' },
  { label: 'Products', path: '/products' },
  { label: 'Sales', path: '/sales' },
  { label: 'Purchases', path: '/purchases' },
  { label: 'Expenses', path: '/expenses' },
  { label: 'Salary', path: '/salary' },
  { label: 'Payments', path: '/payments' },
  { label: 'Bank Reconciliation', path: '/reconciliation', minRole: 'accountant' },
  { label: 'Reports', path: '/reports' },
  { label: 'Users', path: '/users', minRole: 'admin' },
  { label: 'Audit Log', path: '/audit', minRole: 'admin' },
];

export default function Layout() {
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const visibleItems = NAV_ITEMS.filter((item) => !item.minRole || hasRole(profile, item.minRole));
  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            transition: 'width 0.2s ease',
            overflowX: 'hidden',
          },
        }}
      >
        <Toolbar sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', minHeight: 64, px: collapsed ? 1 : 2 }}>
          {!collapsed && (
            <>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>Ledger</Typography>
              {profile?.company_name && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: drawerWidth - 32, mt: 0.25, fontWeight: 500 }}>
                  {profile.company_name}
                </Typography>
              )}
            </>
          )}
          {collapsed && <Typography variant="h6" sx={{ lineHeight: 1.2 }}>L</Typography>}
        </Toolbar>
        <List sx={{ pt: 1, px: collapsed ? 0.5 : 0 }}>
          {visibleItems.map((item) => {
            const Icon = ICONS[item.path];
            return (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                end={item.path === '/'}
                title={collapsed ? item.label : undefined}
                sx={{
                  '&.active': { borderLeft: '2px solid', borderColor: 'primary.main', bgcolor: 'action.selected' },
                  borderLeft: '2px solid transparent',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 1 : 2,
                }}
              >
                {Icon && (
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, color: 'inherit' }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                )}
                {!collapsed && <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />}
              </ListItemButton>
            );
          })}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <ListItemButton
          onClick={() => setCollapsed(!collapsed)}
          sx={{ borderTop: '1px solid', borderColor: 'divider', justifyContent: 'center', py: 1.5 }}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
          {!collapsed && <ListItemText primary="Collapse" primaryTypographyProps={{ fontSize: 12 }} sx={{ ml: 1 }} />}
        </ListItemButton>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar sx={{ justifyContent: 'flex-end', gap: 1.5 }}>
            {profile && (
              <>
                {profile.company_name && (
                  <Chip label={profile.company_name} size="small" variant="filled" sx={{ bgcolor: 'action.selected', fontWeight: 500 }} />
                )}
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
