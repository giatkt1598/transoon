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

type DashboardHeaderProps = {
  sidebarCollapsed: boolean;
};

export function DashboardHeader({ sidebarCollapsed }: DashboardHeaderProps) {
  return (
    <Box
      component="header"
      className={`topbar${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
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
        <IconButton className="topbar-icon-button">
          <Badge badgeContent={3} color="error">
            <NotificationsNoneRoundedIcon fontSize="small" />
          </Badge>
        </IconButton>
        <Avatar className="user-avatar">T</Avatar>
      </Box>
    </Box>
  );
}
