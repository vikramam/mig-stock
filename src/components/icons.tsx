import { createSvgIcon } from '@mui/material/utils'

// The native-mobile design prototype (MIG-Stock-Mobile-App.html) uses its own custom set
// of 2px-stroke line icons instead of a library — this file extracts each shape's exact
// path data from that prototype and wraps it in MUI's `createSvgIcon` so every icon below
// is a drop-in replacement for the `@mui/icons-material/*Sharp` icon it used to be:
// same `fontSize`/`sx`/`color` props, same default 24x24 box, `stroke="currentColor"` so
// it inherits `theme.palette.text.secondary`/`primary.main` like the rest of the UI.
//
// A handful of icons used elsewhere in the app (edit pencil, cancel, delete-forever,
// payments/rupee, generic share, PDF-as-distinct-from-download, image upload, restore,
// receipt, trend arrows, qty stepper +/−) have NO equivalent drawn anywhere in the
// prototype — those call sites deliberately keep their MUI Sharp icon rather than
// inventing a shape that was never specified.

const strokeProps = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

export const MenuIcon = createSvgIcon(<path {...strokeProps} d="M4 6h16M4 12h16M4 18h16" />, 'MenuIcon')

export const LightModeIcon = createSvgIcon(
  <>
    <circle {...strokeProps} cx="12" cy="12" r="4.2" />
    <path {...strokeProps} d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
  </>,
  'LightModeIcon'
)

export const DarkModeIcon = createSvgIcon(
  <path {...strokeProps} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  'DarkModeIcon'
)

// Single-person avatar (New Sale's customer-picker row icon)
export const PersonIcon = createSvgIcon(
  <>
    <circle {...strokeProps} cx="12" cy="8" r="3.2" />
    <path {...strokeProps} d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
  </>,
  'PersonIcon'
)

// Customers list icon (AppBar/menu "Customers" row, Dashboard "Customers" quick action)
export const PeopleIcon = createSvgIcon(
  <>
    <path {...strokeProps} d="M17 21v-8H7v8M7 3v5h8" />
    <path {...strokeProps} d="M5 21V5a2 2 0 0 1 2-2h10l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
  </>,
  'PeopleIcon'
)

// Warning triangle — Low stock nav tab, Dashboard low-stock stat tile
export const WarningIcon = createSvgIcon(
  <>
    <path {...strokeProps} d="M12 8v5M12 17h.01" />
    <path {...strokeProps} d="M10.3 3.9 1.8 18.5a1.5 1.5 0 0 0 1.3 2.3h17.8a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" />
  </>,
  'WarningIcon'
)

// Stacked-box/catalog icon — Catalog nav tab, Dashboard "Stock" quick action, Manage stock button
export const InventoryIcon = createSvgIcon(
  <>
    <path {...strokeProps} d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path {...strokeProps} d="M3 8v8l9 5 9-5V8" />
    <path {...strokeProps} d="M12 13v8" />
  </>,
  'InventoryIcon'
)

export const BarChartIcon = createSvgIcon(
  <>
    <path {...strokeProps} d="M3 3v18h18" />
    <path {...strokeProps} d="M7 15v3M12 11v7M17 7v11" />
  </>,
  'BarChartIcon'
)

// Robot/chat icon — "Ask MIG" everywhere
export const SmartToyIcon = createSvgIcon(
  <>
    <rect {...strokeProps} x="4" y="7" width="16" height="12" rx="3" />
    <path {...strokeProps} d="M9 7V5a3 3 0 0 1 6 0v2M9 12h.01M15 12h.01" />
  </>,
  'SmartToyIcon'
)

export const SettingsIcon = createSvgIcon(
  <>
    <circle {...strokeProps} cx="12" cy="12" r="3" />
    <path
      {...strokeProps}
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
    />
  </>,
  'SettingsIcon'
)

export const LogoutIcon = createSvgIcon(
  <>
    <path {...strokeProps} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path {...strokeProps} d="M16 17l5-5-5-5" />
    <path {...strokeProps} d="M21 12H9" />
  </>,
  'LogoutIcon'
)

// Cart icon — "Sell"/"New sale" everywhere
export const SellIcon = createSvgIcon(
  <>
    <circle {...strokeProps} cx="9" cy="21" r="1" />
    <circle {...strokeProps} cx="20" cy="21" r="1" />
    <path {...strokeProps} d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
  </>,
  'SellIcon'
)

// House icon — Dashboard/Home nav tab
export const DashboardIcon = createSvgIcon(
  <>
    <path {...strokeProps} d="M3 10.5 12 3l9 7.5" />
    <path {...strokeProps} d="M5 9.5V21h14V9.5" />
  </>,
  'DashboardIcon'
)

export const ChevronRightIcon = createSvgIcon(<path {...strokeProps} d="M9 18l6-6-6-6" />, 'ChevronRightIcon')

// Back chevron — used for every "back to previous level" header button
export const BackIcon = createSvgIcon(<path {...strokeProps} d="M15 18l-6-6 6-6" />, 'BackIcon')

export const CheckIcon = createSvgIcon(<path {...strokeProps} d="M20 6 9 17l-5-5" />, 'CheckIcon')

// Plus — every "Add product/type/variant/customer" trigger
export const AddIcon = createSvgIcon(<path {...strokeProps} d="M12 5v14M5 12h14" />, 'AddIcon')

// Trash — every delete/remove action (cart line remove, variant delete, customer delete)
export const DeleteIcon = createSvgIcon(
  <path {...strokeProps} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />,
  'DeleteIcon'
)

export const CloseIcon = createSvgIcon(<path {...strokeProps} d="M18 6 6 18M6 6l12 12" />, 'CloseIcon')

// Download tray — every "export/save/PDF" action (they're all "get this file" to the user)
export const FileDownloadIcon = createSvgIcon(
  <path {...strokeProps} d="M12 3v12M7 10l5 5 5-5M4 19h16" />,
  'FileDownloadIcon'
)

export const FileUploadIcon = createSvgIcon(
  <path {...strokeProps} d="M12 21V9M7 14l5-5 5 5M4 5h16" />,
  'FileUploadIcon'
)

export const BackupIcon = createSvgIcon(<rect {...strokeProps} x="4" y="4" width="16" height="16" rx="2" />, 'BackupIcon')

export const SendIcon = createSvgIcon(
  <>
    <path {...strokeProps} d="M22 2 11 13" />
    <path {...strokeProps} d="M22 2 15 22l-4-9-9-4Z" />
  </>,
  'SendIcon'
)

// Shield/badge brand mark — Login screen logo
export const BrandMarkIcon = createSvgIcon(<path {...strokeProps} d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5Z" />, 'BrandMarkIcon')
