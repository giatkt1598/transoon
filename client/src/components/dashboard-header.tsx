import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Avatar,
  Badge,
  Box,
  Chip,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAutoTranslateNotifications,
  type AutoTranslateNotification,
} from "../app/auto-translate-notifications-context";
import { AutoTranslateNotificationsPopover } from "./auto-translate-notifications-popover";

type DashboardHeaderProps = {
  sidebarCollapsed: boolean;
  isMobileNavigation?: boolean;
  onOpenMobileNavigation?: () => void;
};

export function DashboardHeader({
  sidebarCollapsed,
  isMobileNavigation = false,
  onOpenMobileNavigation,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [notificationAnchorEl, setNotificationAnchorEl] =
    useState<HTMLElement | null>(null);
  const {
    notifications,
    unreadCount,
    activeJobCount,
    isCancellingProjectId,
    markAllAsRead,
    markNotificationAsRead,
    cancelProjectJob,
  } = useAutoTranslateNotifications();

  function handleOpenNotification(
    notification: AutoTranslateNotification,
  ) {
    markNotificationAsRead(notification.id);
    setNotificationAnchorEl(null);
    navigate(`/projects/${notification.projectId}?tab=translations`);
  }

  return (
    <Box
      component="header"
      className={`topbar${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        {isMobileNavigation ? (
          <IconButton
            className="topbar-icon-button topbar-menu-button"
            onClick={onOpenMobileNavigation}
            aria-label="Open navigation menu"
          >
            <MenuRoundedIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Chip label="Workspace" className="team-chip" />
        <Typography className="topbar-title">Translation Studio</Typography>
      </Stack>

      <Box className="topbar-actions">
        <Box className="search-shell">
          <SearchRoundedIcon fontSize="small" />
          <InputBase
            placeholder="Search documents, providers..."
            sx={{ width: "100%" }}
          />
        </Box>
        <IconButton
          className="topbar-icon-button"
          onClick={(event) => setNotificationAnchorEl(event.currentTarget)}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            invisible={unreadCount === 0}
          >
            <NotificationsNoneRoundedIcon fontSize="small" />
          </Badge>
        </IconButton>
        <Avatar className="user-avatar">T</Avatar>
      </Box>
      <AutoTranslateNotificationsPopover
        anchorEl={notificationAnchorEl}
        open={Boolean(notificationAnchorEl)}
        notifications={notifications}
        unreadCount={unreadCount}
        activeJobCount={activeJobCount}
        isCancellingProjectId={isCancellingProjectId}
        onClose={() => setNotificationAnchorEl(null)}
        onReadAll={markAllAsRead}
        onCancelJob={(projectId) => void cancelProjectJob(projectId)}
        onOpenNotification={handleOpenNotification}
      />
    </Box>
  );
}
