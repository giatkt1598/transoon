import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { Box, Chip, IconButton, Typography } from "@mui/material";
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
}: NavigationSidebarProps) {
  return (
    <Box
      component="aside"
      className={`sidebar${collapsed ? " collapsed" : ""}`}
    >
      <IconButton
        className={`sidebar-toggle${collapsed ? " collapsed" : ""}`}
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeftRoundedIcon fontSize="small" />
      </IconButton>

      <Box className="brand-mark">
        <Box className="brand-glyph">
          <TranslateRoundedIcon fontSize="small" />
        </Box>
        {collapsed ? null : (
          <Box>
            <Typography className="brand-name">TranSoon</Typography>
            <Typography className="brand-subtitle">Translate Tool</Typography>
          </Box>
        )}
      </Box>

      <Box className="sidebar-scroll">
        <Box className="nav-section">
          {primaryNavItems.map((item) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </Box>

        {collapsed ? null : (
          <Box className="nav-group-label">
            <Typography>Management</Typography>
          </Box>
        )}

        <Box className="nav-section secondary">
          {managementNavItems.map((item) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {collapsed ? null : (
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
}
