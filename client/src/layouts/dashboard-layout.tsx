import { Box, useMediaQuery, useTheme } from '@mui/material'
import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DashboardHeader } from '../components/dashboard-header'
import { LoadingRouteSkeleton } from '../components/loading-skeleton'
import { NavigationSidebar } from '../components/navigation-sidebar'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'transoon:sidebar-collapsed'

export function DashboardLayout() {
  const theme = useTheme()
  const isMobileNavigation = useMediaQuery(theme.breakpoints.down('lg'))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || isMobileNavigation) {
      return
    }

    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      sidebarCollapsed ? 'true' : 'false',
    )
  }, [isMobileNavigation, sidebarCollapsed])

  return (
    <Box component="main" className="app-shell">
      <NavigationSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((currentValue) => !currentValue)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        isMobile={isMobileNavigation}
      />

      <Box
        className={`dashboard-shell${sidebarCollapsed && !isMobileNavigation ? ' sidebar-collapsed' : ''}${isMobileNavigation ? ' mobile-nav' : ''}`}
      >
        <DashboardHeader
          sidebarCollapsed={sidebarCollapsed && !isMobileNavigation}
          isMobileNavigation={isMobileNavigation}
          onOpenMobileNavigation={() => setMobileSidebarOpen(true)}
        />
        <Box className="dashboard-content">
          <Suspense fallback={<LoadingRouteSkeleton />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  )
}
