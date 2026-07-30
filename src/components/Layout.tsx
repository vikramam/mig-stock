import { PropsWithChildren } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  useMediaQuery,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/GridViewRounded'
import SellIcon from '@mui/icons-material/PointOfSaleRounded'
import InventoryIcon from '@mui/icons-material/Inventory2Rounded'
import BarChartIcon from '@mui/icons-material/BarChartRounded'
import WarningIcon from '@mui/icons-material/ReportProblemRounded'
import SettingsIcon from '@mui/icons-material/SettingsRounded'
import { useTheme } from '@mui/material/styles'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'New sale', path: '/sale/new', icon: <SellIcon /> },
  { label: 'Stock', path: '/stock', icon: <InventoryIcon /> },
  { label: 'Reports', path: '/reports', icon: <BarChartIcon /> },
  { label: 'Low stock', path: '/low-stock', icon: <WarningIcon /> }
]

export default function Layout({ children }: PropsWithChildren) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const navigate = useNavigate()
  const location = useLocation()
  const currentIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((i) => i.path === location.pathname)
  )

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              color: 'primary.contrastText',
              fontSize: 14
            }}
          >
            M
          </Box>
          <Typography variant="h6" sx={{ flexGrow: 1, letterSpacing: 0.2 }}>
            MIG Stock
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/settings')} aria-label="Settings">
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1 }}>
        {isDesktop && (
          <Drawer
            variant="permanent"
            sx={{
              width: 220,
              flexShrink: 0,
              '& .MuiDrawer-paper': { width: 220, boxSizing: 'border-box', position: 'sticky', top: 64, borderRight: '1px solid', borderColor: 'divider' }
            }}
          >
            <List sx={{ pt: 2 }}>
              {NAV_ITEMS.map((item, idx) => (
                <ListItemButton
                  key={item.path}
                  selected={idx === currentIndex}
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1,
                    mb: 0.5,
                    borderRadius: 2,
                    '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }
                  }}
                >
                  <ListItemIcon sx={{ color: idx === currentIndex ? 'inherit' : 'text.secondary', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          </Drawer>
        )}

        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, pb: { xs: 9, md: 3 }, maxWidth: 1100, mx: 'auto', width: '100%' }}>
          {children ?? <Outlet />}
        </Box>
      </Box>

      {!isDesktop && (
        <BottomNavigation
          value={currentIndex}
          onChange={(_, newValue) => navigate(NAV_ITEMS[newValue].path)}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.appBar
          }}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} sx={{ minWidth: 0 }} />
          ))}
        </BottomNavigation>
      )}
    </Box>
  )
}
