import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { Box, Button, Chip, Divider, IconButton, Popover, Tooltip, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import type { AutoTranslateNotification } from "../app/auto-translate-notifications-context";
import { apiBaseUrl } from "../app/config";

const NOTIFICATIONS_PAGE_SIZE = 4;

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
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_PAGE_SIZE);
  const visibleNotifications = useMemo(
    () => notifications.slice(0, visibleCount),
    [notifications, visibleCount],
  );
  const hasMoreNotifications = notifications.length > visibleCount;

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={() => {
        setVisibleCount(NOTIFICATIONS_PAGE_SIZE);
        onClose();
      }}
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
              ? `${activeJobCount} background job(s) running`
              : "Background translation activity"}
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
              No background notifications yet.
            </Typography>
          </Box>
        ) : (
          visibleNotifications.map((notification) => {
            const isActive =
              notification.phase === "queued" ||
              notification.phase === "extracting" ||
              notification.phase === "translating" ||
              notification.phase === "merging";
            return (
              <Box
                key={notification.id}
                className={`auto-translate-notification-item${notification.unread ? " unread" : ""}${
                  notification.phase === "completed"
                    ? " is-completed"
                    : notification.phase === "failed"
                      ? " is-failed"
                      : notification.phase === "cancelled"
                        ? " is-cancelled"
                        : ""
                }`}
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
                  {isActive && notification.kind === "project-auto-translate" && notification.projectId ? (
                    <Button
                      variant="outlined"
                      size="small"
                      className="auto-translate-notification-cancel"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCancelJob(notification.projectId!);
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
                  {notification.kind === "document-translation" &&
                  notification.phase === "completed" &&
                  notification.downloadUrl ? (
                    <Box sx={{ mt: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        component="a"
                        href={new URL(
                          notification.downloadUrl,
                          `${apiBaseUrl.replace(/\/$/, "")}/`,
                        ).toString()}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        Download
                      </Button>
                    </Box>
                  ) : null}
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
        {hasMoreNotifications ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 0.5 }}>
            <Button
              variant="text"
              size="small"
              onClick={() =>
                setVisibleCount((currentValue) => currentValue + NOTIFICATIONS_PAGE_SIZE)
              }
            >
              View more
            </Button>
          </Box>
        ) : null}
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

  if (phase === "extracting" || phase === "merging") {
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
    case "extracting":
      return "Extracting";
    case "merging":
      return "Merging";
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
    const metaParts =
      notification.totalSegments > 0
        ? [
            `${notification.completedSegments}/${notification.totalSegments} ${notification.unitLabel}`,
          ]
        : [];

    if (notification.providerName) {
      metaParts.push(notification.providerName);
    }

    metaParts.push(formatDuration(notification.durationMs));
    metaParts.push(relativeTime);

    return metaParts.join(" • ");
  }

  const runningMetaParts: string[] = [];
  if (notification.totalSegments > 0) {
    runningMetaParts.push(
      `${notification.completedSegments}/${notification.totalSegments} ${notification.unitLabel}`,
    );
  }
  runningMetaParts.push(`${notification.progressPercent}%`, relativeTime);

  return runningMetaParts.join(" • ");
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
