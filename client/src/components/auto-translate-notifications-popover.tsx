import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { Box, Button, Chip, Divider, IconButton, Popover, Tooltip, Typography } from "@mui/material";
import type { AutoTranslateNotification } from "../app/auto-translate-notifications-context";

type AutoTranslateNotificationsPopoverProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  notifications: AutoTranslateNotification[];
  unreadCount: number;
  activeJobCount: number;
  isCancellingProjectId: string | null;
  onClose: () => void;
  onReadAll: () => void;
  onCancelJob: (projectId: string) => void;
  onOpenNotification: (notification: AutoTranslateNotification) => void;
};

export function AutoTranslateNotificationsPopover({
  anchorEl,
  open,
  notifications,
  unreadCount,
  activeJobCount,
  isCancellingProjectId,
  onClose,
  onReadAll,
  onCancelJob,
  onOpenNotification,
}: AutoTranslateNotificationsPopoverProps) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{
        paper: {
          className: "auto-translate-notifications-popover",
        },
      }}
    >
      <Box className="auto-translate-notifications-header">
        <Box>
          <Typography component="h3" className="auto-translate-notifications-title">
            Notifications
          </Typography>
          <Typography component="p" className="auto-translate-notifications-subtitle">
            {activeJobCount > 0
              ? `${activeJobCount} auto translate job(s) running`
              : "Auto translate activity"}
          </Typography>
        </Box>
        <Box className="auto-translate-notifications-header-actions">
          <Tooltip title="Read all">
            <span>
              <IconButton
                size="small"
                disabled={unreadCount === 0}
                onClick={onReadAll}
                aria-label="Mark all notifications as read"
              >
                <DoneAllRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Divider />

      <Box className="auto-translate-notifications-list">
        {notifications.length === 0 ? (
          <Box className="auto-translate-notifications-empty">
            <NotificationsNoneRoundedIcon fontSize="small" />
            <Typography component="p">
              No auto translate notifications yet.
            </Typography>
          </Box>
        ) : (
          notifications.map((notification) => {
            const isActive =
              notification.phase === "queued" ||
              notification.phase === "translating";
            return (
              <Box
                key={notification.id}
                className={`auto-translate-notification-item${notification.unread ? " unread" : ""}`}
                onClick={() => onOpenNotification(notification)}
              >
                <Box className="auto-translate-notification-head">
                  <Box className="auto-translate-notification-icon">
                    <NotificationStatusIcon phase={notification.phase} />
                  </Box>
                  <Box className="auto-translate-notification-title-row">
                    <Typography
                      component="strong"
                      className="auto-translate-notification-project-name"
                    >
                      {notification.projectName}
                    </Typography>
                    <Chip
                      label={getPhaseLabel(notification.phase)}
                      size="small"
                      className={`auto-translate-notification-chip ${notification.phase}`}
                    />
                  </Box>
                  {isActive ? (
                    <Button
                      variant="outlined"
                      size="small"
                      className="auto-translate-notification-cancel"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCancelJob(notification.projectId);
                      }}
                      disabled={isCancellingProjectId === notification.projectId}
                      startIcon={<CancelOutlinedIcon fontSize="small" />}
                    >
                      {isCancellingProjectId === notification.projectId
                        ? "Cancelling..."
                        : "Cancel"}
                    </Button>
                  ) : null}
                </Box>
                <Box className="auto-translate-notification-copy">
                  <Typography component="p">
                    {notification.message}
                  </Typography>
                  <Typography component="span">
                    {buildNotificationMeta(notification)}
                  </Typography>
                  {isActive ? (
                    <Box className="auto-translate-notification-progress">
                      <Box
                        className={`auto-translate-notification-progress-bar${clampProgressPercent(notification.progressPercent) >= 100 ? " is-complete" : ""}`}
                        sx={{
                          width: `${clampProgressPercent(notification.progressPercent)}%`,
                        }}
                      />
                    </Box>
                  ) : null}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Popover>
  );
}

function NotificationStatusIcon({
  phase,
}: {
  phase: AutoTranslateNotification["phase"];
}) {
  if (phase === "queued" || phase === "translating") {
    return (
      <AutorenewRoundedIcon
        fontSize="small"
        className="auto-translate-notification-spin"
      />
    );
  }

  if (phase === "completed") {
    return <CheckCircleRoundedIcon fontSize="small" />;
  }

  return <ErrorOutlineRoundedIcon fontSize="small" />;
}

function getPhaseLabel(phase: AutoTranslateNotification["phase"]) {
  switch (phase) {
    case "queued":
      return "Queued";
    case "translating":
      return "Running";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return phase;
  }
}

function buildNotificationMeta(notification: AutoTranslateNotification) {
  const relativeTime = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(notification.updatedAt));

  if (
    (notification.phase === "completed" ||
      notification.phase === "failed" ||
      notification.phase === "cancelled") &&
    notification.durationMs !== null
  ) {
    const metaParts = [
      `${notification.completedSegments}/${notification.totalSegments} segments`,
    ];

    if (notification.providerName) {
      metaParts.push(notification.providerName);
    }

    metaParts.push(formatDuration(notification.durationMs));
    metaParts.push(relativeTime);

    return metaParts.join(" • ");
  }

  return `${notification.completedSegments}/${notification.totalSegments} segments • ${notification.progressPercent}% • ${relativeTime}`;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function clampProgressPercent(progressPercent: number) {
  return Math.max(0, Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0));
}
