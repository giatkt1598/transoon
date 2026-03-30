import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { Box, Chip, Drawer, IconButton, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";
import {
  managementNavItems,
  primaryNavItems,
  type NavigationItem,
} from "../app/navigation";

type NavItemProps = {
  item: NavigationItem;
  collapsed: boolean;
};

type NavigationSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  isMobile?: boolean;
};

function NavItem({ item, collapsed }: NavItemProps) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `nav-item${collapsed ? " collapsed" : ""}${isActive ? " active" : ""}`
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon fontSize="small" />
      {collapsed ? null : <Typography>{item.label}</Typography>}
    </NavLink>
  );
}

export function NavigationSidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen = false,
  onCloseMobile,
  isMobile = false,
}: NavigationSidebarProps) {
  const sidebarContent = (
    <Box
      component="aside"
      className={`sidebar${collapsed && !isMobile ? " collapsed" : ""}${isMobile ? " mobile" : ""}`}
    >
      {isMobile ? null : (
        <IconButton
          className={`sidebar-toggle${collapsed ? " collapsed" : ""}`}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeftRoundedIcon fontSize="small" />
        </IconButton>
      )}

      <Box className="brand-mark">
        <Box className="brand-glyph">
          <TranslateRoundedIcon fontSize="small" />
        </Box>
        {collapsed && !isMobile ? null : (
          <Box>
            <Typography className="brand-name">TranSoon</Typography>
            <Typography className="brand-subtitle">Translate Tool</Typography>
          </Box>
        )}
      </Box>

      <Box className="sidebar-scroll">
        <Box className="nav-section">
          {primaryNavItems.map((item) => (
            <Box key={item.to} onClick={isMobile ? onCloseMobile : undefined}>
              <NavItem item={item} collapsed={collapsed && !isMobile} />
            </Box>
          ))}
        </Box>

        {collapsed && !isMobile ? null : (
          <Box className="nav-group-label">
            <Typography>Management</Typography>
          </Box>
        )}

        <Box className="nav-section secondary">
          {managementNavItems.map((item) => (
            <Box key={item.to} onClick={isMobile ? onCloseMobile : undefined}>
              <NavItem item={item} collapsed={collapsed && !isMobile} />
            </Box>
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {collapsed && !isMobile ? null : (
          <Box className="sidebar-card">
            <Typography className="sidebar-card-title">
              Translation flow
            </Typography>
            <Typography className="sidebar-card-copy">
              Upload, translate, merge, and export with provider-aware routing.
            </Typography>
            <Chip label="Feature 01" size="small" className="sidebar-chip" />
          </Box>
        )}
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        open={mobileOpen}
        onClose={onCloseMobile}
        anchor="left"
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            className: "sidebar-drawer-paper",
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return sidebarContent;
}
