import type { SvgIconComponent } from '@mui/icons-material'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded'

export type NavigationItem = {
  icon: SvgIconComponent
  label: string
  to: string
}

export const primaryNavItems: NavigationItem[] = [
  { icon: HomeRoundedIcon, label: 'Overview', to: '/' },
  { icon: TranslateRoundedIcon, label: 'Translator', to: '/translator' },
  { icon: FolderOpenOutlinedIcon, label: 'Projects', to: '/projects' },
]

export const managementNavItems: NavigationItem[] = [
  { icon: StorageOutlinedIcon, label: 'Translation Memories', to: '/translation-memories' },
  { icon: MenuBookOutlinedIcon, label: 'Glossaries', to: '/glossaries' },
  { icon: SettingsOutlinedIcon, label: 'Settings', to: '/settings' },
]
