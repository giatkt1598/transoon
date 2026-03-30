import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type {
  ProjectAutoTranslateProgressResponse,
  ProjectSummary,
} from "./types";
import { getAppSocket } from "./socket";
import {
  cancelAutoTranslateProject,
  fetchProjects,
} from "../project-management/api";

const PROJECT_AUTO_TRANSLATE_STARTED_EVENT =
  "transoon:auto-translate-started";
const PROJECT_AUTO_TRANSLATE_IDLE_REFRESH_MS = 15000;
const PROJECT_AUTO_TRANSLATE_ACTIVE_REFRESH_MS = 2000;

export type AutoTranslateNotification = {
  id: string;
  projectId: string;
  projectName: string;
  providerName: string | null;
  phase: ProjectAutoTranslateProgressResponse["phase"];
  message: string;
  progressPercent: number;
  completedSegments: number;
  totalSegments: number;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  unread: boolean;
};

type AutoTranslateStartedDetail = {
  projectId: string;
  projectName: string;
  providerName: string;
  totalSegments: number;
};

type AutoTranslateNotificationsContextValue = {
  notifications: AutoTranslateNotification[];
  unreadCount: number;
  activeJobCount: number;
  isCancellingProjectId: string | null;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
  markNotificationAsRead: (notificationId: string) => void;
  cancelProjectJob: (projectId: string) => Promise<void>;
};

const AutoTranslateNotificationsContext =
  createContext<AutoTranslateNotificationsContextValue | null>(null);

export function AutoTranslateNotificationsProvider({
  children,
}: PropsWithChildren) {
  const [notifications, setNotifications] = useState<AutoTranslateNotification[]>(
    [],
  );
  const [projectLookup, setProjectLookup] = useState<
    Record<string, ProjectSummary>
  >({});
  const [processingProjectIds, setProcessingProjectIds] = useState<string[]>([]);
  const [manuallyTrackedProjectIds, setManuallyTrackedProjectIds] = useState<
    string[]
  >([]);
  const [isCancellingProjectId, setIsCancellingProjectId] = useState<
    string | null
  >(null);
  const startedAtRef = useRef(new Map<string, string>());
  const refreshIntervalMs =
    processingProjectIds.length > 0 || manuallyTrackedProjectIds.length > 0
      ? PROJECT_AUTO_TRANSLATE_ACTIVE_REFRESH_MS
      : PROJECT_AUTO_TRANSLATE_IDLE_REFRESH_MS;

  useEffect(() => {
    let isDisposed = false;

    async function loadProjects() {
      try {
        const projects = await fetchProjects();
        if (isDisposed) {
          return;
        }

        setProjectLookup(
          Object.fromEntries(projects.map((project) => [project.id, project])),
        );
        setProcessingProjectIds(
          projects
            .filter((project) => project.status === "auto-translate-processing")
            .map((project) => project.id),
        );
        setNotifications((currentNotifications) =>
          syncNotificationsWithProjects(currentNotifications, projects),
        );
      } catch {
        // Notification center should fail quietly.
      }
    }

    void loadProjects();
    const intervalId = window.setInterval(
      () => void loadProjects(),
      refreshIntervalMs,
    );

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [refreshIntervalMs]);

  useEffect(() => {
    const handleAutoTranslateStarted = (event: Event) => {
      const customEvent = event as CustomEvent<AutoTranslateStartedDetail>;
      const detail = customEvent.detail;
      if (!detail?.projectId) {
        return;
      }

      const startedAt = new Date().toISOString();
      startedAtRef.current.set(detail.projectId, startedAt);
      setManuallyTrackedProjectIds((currentValue) =>
        currentValue.includes(detail.projectId)
          ? currentValue
          : [...currentValue, detail.projectId],
      );
      setNotifications((currentNotifications) =>
        upsertNotification(currentNotifications, {
          id: buildNotificationId(detail.projectId),
          projectId: detail.projectId,
          projectName: detail.projectName,
          providerName: detail.providerName,
          phase: "queued",
          message: "Preparing background auto translate.",
          progressPercent: 0,
          completedSegments: 0,
          totalSegments: detail.totalSegments,
          updatedAt: startedAt,
          startedAt,
          completedAt: null,
          durationMs: null,
          unread: true,
        }),
      );
    };

    window.addEventListener(
      PROJECT_AUTO_TRANSLATE_STARTED_EVENT,
      handleAutoTranslateStarted as EventListener,
    );
    return () => {
      window.removeEventListener(
        PROJECT_AUTO_TRANSLATE_STARTED_EVENT,
        handleAutoTranslateStarted as EventListener,
      );
    };
  }, []);

  const subscribedProjectIds = useMemo(
    () =>
      Array.from(new Set([...processingProjectIds, ...manuallyTrackedProjectIds])),
    [manuallyTrackedProjectIds, processingProjectIds],
  );

  useEffect(() => {
    if (subscribedProjectIds.length === 0) {
      return;
    }

    const socket = getAppSocket();
    const subscribedProjectIdSet = new Set(subscribedProjectIds);

    const handleProgress = (progress: ProjectAutoTranslateProgressResponse) => {
      if (!subscribedProjectIdSet.has(progress.projectId)) {
        return;
      }

      const existingProject = projectLookup[progress.projectId];
      const startedAt =
        startedAtRef.current.get(progress.projectId) ?? progress.updatedAt;

      if (progress.phase === "queued" || progress.phase === "translating") {
        startedAtRef.current.set(progress.projectId, startedAt);
      }

      const completedAt =
        progress.phase === "completed" ||
        progress.phase === "failed" ||
        progress.phase === "cancelled"
          ? progress.updatedAt
          : null;
      const durationMs =
        completedAt && startedAt
          ? Math.max(
              0,
              Date.parse(completedAt) - Date.parse(startedAt),
            )
          : null;

      setNotifications((currentNotifications) =>
        upsertNotification(currentNotifications, {
          id: buildNotificationId(progress.projectId),
          projectId: progress.projectId,
          projectName: existingProject?.name ?? "Project",
          providerName: null,
          phase: progress.phase,
          message: progress.message,
          progressPercent: progress.progressPercent,
          completedSegments: progress.completedSegments,
          totalSegments: progress.totalSegments,
          updatedAt: progress.updatedAt,
          startedAt,
          completedAt,
          durationMs,
          unread: true,
        }),
      );

      if (
        progress.phase === "completed" ||
        progress.phase === "failed" ||
        progress.phase === "cancelled"
      ) {
        setManuallyTrackedProjectIds((currentValue) =>
          currentValue.filter((projectId) => projectId !== progress.projectId),
        );
      }
    };

    socket.on("project-auto-translate-progress", handleProgress);
    subscribedProjectIds.forEach((projectId) => {
      socket.emit("project-auto-translate:subscribe", projectId);
    });

    return () => {
      subscribedProjectIds.forEach((projectId) => {
        socket.emit("project-auto-translate:unsubscribe", projectId);
      });
      socket.off("project-auto-translate-progress", handleProgress);
    };
  }, [projectLookup, subscribedProjectIds]);

  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;
  const activeJobCount = notifications.filter(
    (notification) =>
      notification.phase === "queued" || notification.phase === "translating",
  ).length;

  async function cancelProjectJob(projectId: string) {
    try {
      setIsCancellingProjectId(projectId);
      await cancelAutoTranslateProject(projectId);
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.projectId === projectId
            ? {
                ...notification,
                phase: "cancelled",
                message: "Auto translate was cancelled.",
                updatedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs:
                  notification.startedAt === null
                    ? null
                    : Date.now() - Date.parse(notification.startedAt),
                unread: true,
              }
            : notification,
        ),
      );
      setManuallyTrackedProjectIds((currentValue) =>
        currentValue.filter((trackedProjectId) => trackedProjectId !== projectId),
      );
    } finally {
      setIsCancellingProjectId(null);
    }
  }

  return (
    <AutoTranslateNotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        activeJobCount,
        isCancellingProjectId,
        markAllAsRead: () => {
          setNotifications((currentNotifications) =>
            currentNotifications.map((notification) => ({
              ...notification,
              unread: false,
            })),
          );
        },
        clearAllNotifications: () => {
          setNotifications([]);
          setManuallyTrackedProjectIds([]);
        },
        markNotificationAsRead: (notificationId: string) => {
          setNotifications((currentNotifications) =>
            currentNotifications.map((notification) =>
              notification.id === notificationId
                ? { ...notification, unread: false }
                : notification,
            ),
          );
        },
        cancelProjectJob,
      }}
    >
      {children}
    </AutoTranslateNotificationsContext.Provider>
  );
}

function buildNotificationId(projectId: string) {
  return `project-auto-translate:${projectId}`;
}

function upsertNotification(
  currentNotifications: AutoTranslateNotification[],
  nextNotification: AutoTranslateNotification,
) {
  const existingNotificationIndex = currentNotifications.findIndex(
    (notification) => notification.id === nextNotification.id,
  );

  if (existingNotificationIndex < 0) {
    return [nextNotification, ...currentNotifications].sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );
  }

  const previousNotification =
    currentNotifications[existingNotificationIndex] ?? nextNotification;
  const nextNotifications = [...currentNotifications];
  nextNotifications[existingNotificationIndex] = {
    ...previousNotification,
    ...nextNotification,
    providerName: nextNotification.providerName ?? previousNotification.providerName,
    unread: previousNotification.unread || nextNotification.unread,
  };
  return nextNotifications.sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

export function useAutoTranslateNotifications() {
  const context = useContext(AutoTranslateNotificationsContext);

  if (!context) {
    throw new Error(
      "useAutoTranslateNotifications must be used within AutoTranslateNotificationsProvider.",
    );
  }

  return context;
}

export function dispatchAutoTranslateStartedNotification(
  detail: AutoTranslateStartedDetail,
) {
  window.dispatchEvent(
    new CustomEvent<AutoTranslateStartedDetail>(
      PROJECT_AUTO_TRANSLATE_STARTED_EVENT,
      { detail },
    ),
  );
}

function syncNotificationsWithProjects(
  currentNotifications: AutoTranslateNotification[],
  projects: ProjectSummary[],
) {
  const projectLookup = new Map(
    projects.map((project) => [project.id, project] as const),
  );

  return currentNotifications.map((notification) => {
    const project = projectLookup.get(notification.projectId);
    if (!project) {
      return notification;
    }

    const isActiveNotification =
      notification.phase === "queued" || notification.phase === "translating";
    if (!isActiveNotification) {
      return notification;
    }

    const totalSegments = Math.max(notification.totalSegments, project.segmentCount);
    const completedSegments = Math.max(
      notification.completedSegments,
      project.translatedSegmentCount,
    );
    const progressPercent =
      totalSegments <= 0
        ? 0
        : Math.max(
            notification.progressPercent,
            project.progressPercent,
            Math.round((completedSegments / totalSegments) * 100),
          );

    return {
      ...notification,
      phase:
        project.status === "auto-translate-processing"
          ? completedSegments > 0 || progressPercent > 0
            ? "translating"
            : "queued"
          : notification.phase,
      completedSegments,
      totalSegments,
      progressPercent,
      updatedAt: project.lastModifiedAt ?? notification.updatedAt,
    };
  });
}
