import { Box } from '@mui/material'
import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DashboardHeader } from '../components/dashboard-header'
import { NavigationSidebar } from '../components/navigation-sidebar'

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <Box component="main" className="app-shell">
      <NavigationSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((currentValue) => !currentValue)}
      />

      <Box className={`dashboard-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        <Box className="dashboard-content">
          <Suspense fallback={<Box className="route-loading">Loading workspace...</Box>}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  )
}
