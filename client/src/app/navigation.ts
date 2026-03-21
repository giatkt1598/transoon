import type { SvgIconComponent } from '@mui/icons-material'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'

export type NavigationItem = {
  icon: SvgIconComponent
  label: string
  to: string
}

export const primaryNavItems: NavigationItem[] = [
  { icon: HomeRoundedIcon, label: 'Overview', to: '/' },
  { icon: TranslateRoundedIcon, label: 'Translator', to: '/translator' },
  { icon: FolderOpenOutlinedIcon, label: 'Projects', to: '/projects' },
  { icon: AnalyticsOutlinedIcon, label: 'Analytics', to: '/analytics' },
]

export const managementNavItems: NavigationItem[] = [
  { icon: DescriptionOutlinedIcon, label: 'Templates', to: '/templates' },
  { icon: UploadFileOutlinedIcon, label: 'Imports', to: '/imports' },
  { icon: AutoAwesomeOutlinedIcon, label: 'Providers', to: '/providers' },
  { icon: SettingsOutlinedIcon, label: 'Settings', to: '/settings' },
]
