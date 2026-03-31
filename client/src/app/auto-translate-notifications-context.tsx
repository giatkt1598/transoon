import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { apiBaseUrl } from "./config";
import type {
  ProjectAutoTranslateProgressResponse,
  ProjectSummary,
  TranslationProgressResponse,
} from "./types";
import { getAppSocket } from "./socket";
import {
  cancelAutoTranslateProject,
  fetchProjects,
} from "../project-management/api";

const PROJECT_AUTO_TRANSLATE_STARTED_EVENT =
  "transoon:auto-translate-started";
const DOCUMENT_TRANSLATION_STARTED_EVENT =
  "transoon:document-translation-started";
const DOCUMENT_TRANSLATION_UPDATED_EVENT =
  "transoon:document-translation-updated";
const PROJECT_AUTO_TRANSLATE_IDLE_REFRESH_MS = 15000;
const PROJECT_AUTO_TRANSLATE_ACTIVE_REFRESH_MS = 2000;

export type AutoTranslateNotification = {
  kind: "project-auto-translate" | "document-translation";
  id: string;
  projectId: string | null;
  requestId: string | null;
  projectName: string;
  providerName: string | null;
  phase:
    | ProjectAutoTranslateProgressResponse["phase"]
    | TranslationProgressResponse["phase"];
  message: string;
  progressPercent: number;
  completedSegments: number;
  totalSegments: number;
  unitLabel: "segments" | "chunks";
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  downloadUrl: string | null;
  unread: boolean;
};

type AutoTranslateStartedDetail = {
  projectId: string;
  projectName: string;
  providerName: string;
  totalSegments: number;
};

type DocumentTranslationStartedDetail = {
  requestId: string;
  fileName: string;
  providerName: string;
};

type DocumentTranslationUpdatedDetail = {
  requestId: string;
  providerName?: string | null;
  message?: string;
  progressPercent?: number;
  completedChunks?: number;
  totalChunks?: number;
  updatedAt?: string;
  completedAt?: string | null;
  durationMs?: number | null;
  phase?: TranslationProgressResponse["phase"];
  downloadUrl?: string | null;
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
  const [manuallyTrackedRequestIds, setManuallyTrackedRequestIds] = useState<
    string[]
  >([]);
  const [isCancellingProjectId, setIsCancellingProjectId] = useState<
    string | null
  >(null);
  const startedAtRef = useRef(new Map<string, string>());
  const refreshIntervalMs =
    processingProjectIds.length > 0 ||
    manuallyTrackedProjectIds.length > 0 ||
    manuallyTrackedRequestIds.length > 0
      ? PROJECT_AUTO_TRANSLATE_ACTIVE_REFRESH_MS
      : PROJECT_AUTO_TRANSLATE_IDLE_REFRESH_MS;

  useEffect(() => {
    let isDisposed = false;

    async function loadPersistedNotifications() {
      try {
        const nextNotifications = await fetchNotifications();
        if (isDisposed) {
          return;
        }

        setNotifications(nextNotifications);
        setManuallyTrackedProjectIds(
          nextNotifications
            .filter(
              (notification) =>
                notification.kind === "project-auto-translate" &&
                notification.projectId &&
                isNotificationActive(notification.phase),
            )
            .map((notification) => notification.projectId!)
            .filter((projectId, index, currentValue) => currentValue.indexOf(projectId) === index),
        );
        setManuallyTrackedRequestIds(
          nextNotifications
            .filter(
              (notification) =>
                notification.kind === "document-translation" &&
                notification.requestId &&
                isNotificationActive(notification.phase),
            )
            .map((notification) => notification.requestId!)
            .filter((requestId, index, currentValue) => currentValue.indexOf(requestId) === index),
        );
      } catch {
        // Notification center should fail quietly.
      }
    }

    void loadPersistedNotifications();

    return () => {
      isDisposed = true;
    };
  }, []);

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
        setNotifications((currentNotifications) => {
          const nextNotifications = syncNotificationsWithProjects(
            currentNotifications,
            projects,
          );
          void persistAllNotifications(nextNotifications);
          return nextNotifications;
        });
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
        persistUpsertAndMergeNotification(currentNotifications, {
          id: buildNotificationId(detail.projectId),
          kind: "project-auto-translate",
          projectId: detail.projectId,
          requestId: null,
          projectName: detail.projectName,
          providerName: detail.providerName,
          phase: "queued",
          message: "Preparing background auto translate.",
          progressPercent: 0,
          completedSegments: 0,
          totalSegments: detail.totalSegments,
          unitLabel: "segments",
          updatedAt: startedAt,
          startedAt,
          completedAt: null,
          durationMs: null,
          downloadUrl: null,
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

  useEffect(() => {
    const handleDocumentTranslationUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<DocumentTranslationUpdatedDetail>;
      const detail = customEvent.detail;
      if (!detail?.requestId) {
        return;
      }

      setNotifications((currentNotifications) => {
        const currentNotification = currentNotifications.find(
          (notification) => notification.requestId === detail.requestId,
        );
        if (!currentNotification) {
          return currentNotifications;
        }

        return persistUpsertAndMergeNotification(currentNotifications, {
          ...currentNotification,
          providerName:
            detail.providerName === undefined
              ? currentNotification.providerName
              : detail.providerName,
          message: detail.message ?? currentNotification.message,
          progressPercent:
            detail.progressPercent ?? currentNotification.progressPercent,
          completedSegments:
            detail.completedChunks ?? currentNotification.completedSegments,
          totalSegments: detail.totalChunks ?? currentNotification.totalSegments,
          updatedAt: detail.updatedAt ?? currentNotification.updatedAt,
          completedAt:
            detail.completedAt === undefined
              ? currentNotification.completedAt
              : detail.completedAt,
          durationMs:
            detail.durationMs === undefined
              ? currentNotification.durationMs
              : detail.durationMs,
          phase: detail.phase ?? currentNotification.phase,
          downloadUrl:
            detail.downloadUrl === undefined
              ? currentNotification.downloadUrl
              : detail.downloadUrl,
          unread: true,
        });
      });
    };

    window.addEventListener(
      DOCUMENT_TRANSLATION_UPDATED_EVENT,
      handleDocumentTranslationUpdated as EventListener,
    );
    return () => {
      window.removeEventListener(
        DOCUMENT_TRANSLATION_UPDATED_EVENT,
        handleDocumentTranslationUpdated as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const handleDocumentTranslationStarted = (event: Event) => {
      const customEvent = event as CustomEvent<DocumentTranslationStartedDetail>;
      const detail = customEvent.detail;
      if (!detail?.requestId) {
        return;
      }

      const startedAt = new Date().toISOString();
      startedAtRef.current.set(detail.requestId, startedAt);
      setManuallyTrackedRequestIds((currentValue) =>
        currentValue.includes(detail.requestId)
          ? currentValue
          : [...currentValue, detail.requestId],
      );
      setNotifications((currentNotifications) =>
        persistUpsertAndMergeNotification(currentNotifications, {
          id: buildDocumentTranslationNotificationId(detail.requestId),
          kind: "document-translation",
          projectId: null,
          requestId: detail.requestId,
          projectName: detail.fileName,
          providerName: detail.providerName,
          phase: "queued",
          message: "Preparing background document translation.",
          progressPercent: 0,
          completedSegments: 0,
          totalSegments: 0,
          unitLabel: "chunks",
          updatedAt: startedAt,
          startedAt,
          completedAt: null,
          durationMs: null,
          downloadUrl: null,
          unread: true,
        }),
      );
    };

    window.addEventListener(
      DOCUMENT_TRANSLATION_STARTED_EVENT,
      handleDocumentTranslationStarted as EventListener,
    );
    return () => {
      window.removeEventListener(
        DOCUMENT_TRANSLATION_STARTED_EVENT,
        handleDocumentTranslationStarted as EventListener,
      );
    };
  }, []);

  const subscribedProjectIds = useMemo(
    () =>
      Array.from(new Set([...processingProjectIds, ...manuallyTrackedProjectIds])),
    [manuallyTrackedProjectIds, processingProjectIds],
  );
  const subscribedRequestIds = useMemo(
    () => Array.from(new Set(manuallyTrackedRequestIds)),
    [manuallyTrackedRequestIds],
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
        persistUpsertAndMergeNotification(currentNotifications, {
          id: buildNotificationId(progress.projectId),
          kind: "project-auto-translate",
          projectId: progress.projectId,
          requestId: null,
          projectName: existingProject?.name ?? "Project",
          providerName: null,
          phase: progress.phase,
          message: progress.message,
          progressPercent: progress.progressPercent,
          completedSegments: progress.completedSegments,
          totalSegments: progress.totalSegments,
          unitLabel: "segments",
          updatedAt: progress.updatedAt,
          startedAt,
          completedAt,
          durationMs,
          downloadUrl: null,
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

  useEffect(() => {
    if (subscribedRequestIds.length === 0) {
      return;
    }

    const socket = getAppSocket();
    const subscribedRequestIdSet = new Set(subscribedRequestIds);

    const handleProgress = (progress: TranslationProgressResponse) => {
      if (!subscribedRequestIdSet.has(progress.requestId)) {
        return;
      }

      const startedAt =
        startedAtRef.current.get(progress.requestId) ?? progress.updatedAt;

      if (
        progress.phase === "queued" ||
        progress.phase === "extracting" ||
        progress.phase === "translating" ||
        progress.phase === "merging"
      ) {
        startedAtRef.current.set(progress.requestId, startedAt);
      }

      const completedAt =
        progress.phase === "completed" || progress.phase === "failed"
          ? progress.updatedAt
          : null;
      const durationMs =
        completedAt && startedAt
          ? Math.max(0, Date.parse(completedAt) - Date.parse(startedAt))
          : null;

      setNotifications((currentNotifications) =>
        persistUpsertAndMergeNotification(currentNotifications, {
          id: buildDocumentTranslationNotificationId(progress.requestId),
          kind: "document-translation",
          projectId: null,
          requestId: progress.requestId,
          projectName:
            currentNotifications.find(
              (notification) =>
                notification.requestId === progress.requestId,
            )?.projectName ?? "Document translation",
          providerName: null,
          phase: progress.phase,
          message: progress.message,
          progressPercent: progress.progressPercent,
          completedSegments: progress.completedChunks,
          totalSegments: progress.totalChunks,
          unitLabel: "chunks",
          updatedAt: progress.updatedAt,
          startedAt,
          completedAt,
          durationMs,
          downloadUrl: null,
          unread: true,
        }),
      );

      if (progress.phase === "completed" || progress.phase === "failed") {
        setManuallyTrackedRequestIds((currentValue) =>
          currentValue.filter((requestId) => requestId !== progress.requestId),
        );
      }
    };

    socket.on("translation-progress", handleProgress);
    subscribedRequestIds.forEach((requestId) => {
      socket.emit("translation-progress:subscribe", requestId);
    });

    return () => {
      subscribedRequestIds.forEach((requestId) => {
        socket.emit("translation-progress:unsubscribe", requestId);
      });
      socket.off("translation-progress", handleProgress);
    };
  }, [subscribedRequestIds]);

  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;
  const activeJobCount = notifications.filter(
    (notification) => isNotificationActive(notification.phase),
  ).length;

  async function cancelProjectJob(projectId: string) {
    try {
      setIsCancellingProjectId(projectId);
      await cancelAutoTranslateProject(projectId);
      setNotifications((currentNotifications) => {
        const nextNotifications: AutoTranslateNotification[] = currentNotifications.map((notification) =>
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
              } as AutoTranslateNotification
            : notification,
        );
        void persistAllNotifications(nextNotifications);
        return nextNotifications;
      });
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
          setNotifications((currentNotifications) => {
            const nextNotifications = currentNotifications.map((notification) => ({
              ...notification,
              unread: false,
            }));
            void markAllNotificationsAsReadRequest();
            return nextNotifications;
          });
        },
        clearAllNotifications: () => {
          setNotifications([]);
          setManuallyTrackedProjectIds([]);
          setManuallyTrackedRequestIds([]);
          void clearAllNotificationsRequest();
        },
        markNotificationAsRead: (notificationId: string) => {
          setNotifications((currentNotifications) => {
            const nextNotifications = currentNotifications.map((notification) =>
              notification.id === notificationId
                ? { ...notification, unread: false }
                : notification,
            );
            void markNotificationAsReadRequest(notificationId);
            return nextNotifications;
          });
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

function buildDocumentTranslationNotificationId(requestId: string) {
  return `document-translation:${requestId}`;
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
    if (notification.kind !== "project-auto-translate" || !notification.projectId) {
      return notification;
    }

    const project = projectLookup.get(notification.projectId);
    if (!project) {
      return notification;
    }

    const isActiveNotification = isNotificationActive(notification.phase);
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

function isNotificationActive(
  phase: AutoTranslateNotification["phase"],
) {
  return (
    phase === "queued" ||
    phase === "extracting" ||
    phase === "translating" ||
    phase === "merging"
  );
}

export function dispatchDocumentTranslationStartedNotification(
  detail: DocumentTranslationStartedDetail,
) {
  window.dispatchEvent(
    new CustomEvent<DocumentTranslationStartedDetail>(
      DOCUMENT_TRANSLATION_STARTED_EVENT,
      { detail },
    ),
  );
}

export function dispatchDocumentTranslationUpdatedNotification(
  detail: DocumentTranslationUpdatedDetail,
) {
  window.dispatchEvent(
    new CustomEvent<DocumentTranslationUpdatedDetail>(
      DOCUMENT_TRANSLATION_UPDATED_EVENT,
      { detail },
    ),
  );
}

async function fetchNotifications() {
  const response = await fetch(`${apiBaseUrl}/api/notifications`);
  const data = (await response.json()) as
    | { notifications: AutoTranslateNotification[] }
    | { error?: string };

  if (!response.ok || !("notifications" in data)) {
    throw new Error(
      "error" in data
        ? data.error ?? "Could not load notifications."
        : "Could not load notifications.",
    );
  }

  return data.notifications;
}

function persistUpsertAndMergeNotification(
  currentNotifications: AutoTranslateNotification[],
  nextNotification: AutoTranslateNotification,
) {
  const nextNotifications = upsertNotification(
    currentNotifications,
    nextNotification,
  );
  void upsertNotificationRequest(nextNotification);
  return nextNotifications;
}

async function upsertNotificationRequest(
  notification: AutoTranslateNotification,
) {
  await fetch(`${apiBaseUrl}/api/notifications/${encodeURIComponent(notification.id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(notification),
  });
}

async function markNotificationAsReadRequest(notificationId: string) {
  await fetch(
    `${apiBaseUrl}/api/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "POST",
    },
  );
}

async function markAllNotificationsAsReadRequest() {
  await fetch(`${apiBaseUrl}/api/notifications/read-all`, {
    method: "POST",
  });
}

async function clearAllNotificationsRequest() {
  await fetch(`${apiBaseUrl}/api/notifications`, {
    method: "DELETE",
  });
}

async function persistAllNotifications(
  notifications: AutoTranslateNotification[],
) {
  await Promise.all(
    notifications.map((notification) => upsertNotificationRequest(notification)),
  );
}
