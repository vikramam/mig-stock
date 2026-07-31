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
import DashboardIcon from '@mui/icons-material/GridViewSharp'
import SellIcon from '@mui/icons-material/PointOfSaleSharp'
import InventoryIcon from '@mui/icons-material/Inventory2Sharp'
import BarChartIcon from '@mui/icons-material/BarChartSharp'
import WarningIcon from '@mui/icons-material/ReportProblemSharp'
import SettingsIcon from '@mui/icons-material/SettingsSharp'
import LogoutIcon from '@mui/icons-material/LogoutSharp'
import SmartToyIcon from '@mui/icons-material/SmartToySharp'
import LightModeIcon from '@mui/icons-material/LightModeSharp'
import DarkModeIcon from '@mui/icons-material/DarkModeSharp'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '../lib/auth'
import { useThemeMode } from '../lib/themeMode'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'New sale', path: '/sale/new', icon: <SellIcon /> },
  { label: 'Stock', path: '/stock', icon: <InventoryIcon /> },
  { label: 'Reports', path: '/reports', icon: <BarChartIcon /> },
  { label: 'Low stock', path: '/low-stock', icon: <WarningIcon /> }
]

export default function Layout({ children }: PropsWithChildren) {
  const { signOut } = useAuth()
  const { mode, toggleMode } = useThemeMode()
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
            component="img"
            src="/icon-192.png"
            alt="Logo"
            sx={{ width: 32, height: 32, borderRadius: '8px', objectFit: 'contain', flexShrink: 0 }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1, letterSpacing: 0.2 }}>
            Clamp Sales Tracker
          </Typography>
          <IconButton
            color="inherit"
            onClick={toggleMode}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <IconButton color="inherit" onClick={() => navigate('/chat')} aria-label="Ask MIG">
            <SmartToyIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => navigate('/settings')} aria-label="Settings">
            <SettingsIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => void signOut()} aria-label="Sign out">
            <LogoutIcon />
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

        <Box
          component="main"
          sx={{
            flex: 1,
            p: { xs: 2, md: 4 },
            pb: { xs: 'calc(64px + env(safe-area-inset-bottom))', md: 4 },
            maxWidth: 1160,
            mx: 'auto',
            width: '100%'
          }}
        >
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
            height: 'auto',
            pb: 'env(safe-area-inset-bottom)',
            boxShadow: '0 -1px 2px rgba(0,0,0,0.15), 0 -2px 8px rgba(0,0,0,0.2)',
            zIndex: (t) => t.zIndex.appBar
          }}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      )}
    </Box>
  )
}
