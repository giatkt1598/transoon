import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PendingRoundedIcon from "@mui/icons-material/PendingRounded";
import {
  Box,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  List,
  useDynamicRowHeight,
  useListRef,
  type RowComponentProps,
} from "react-window";
import type { ProjectSegment } from "../../app/types";
import type { ProjectTerm } from "../../app/types";
import { searchFuzzyProjectTerms } from "../term-fuzzy-search";
import { AlignmentToolToolbar } from "./alignment-tool-toolbar";
import "./alignment-tool.scss";

const TARGET_CHANGE_EMIT_INTERVAL_MS = 300;

type AlignmentToolProps = {
  segments: ProjectSegment[];
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  isLoading: boolean;
  isReadOnly: boolean;
  isBusy: boolean;
  isSaving: boolean;
  isExporting: boolean;
  hasPendingChanges: boolean;
  activeSegmentExternalId: string | null;
  inlineTranslatingSegmentId: string | null;
  confirmingSegmentId: string | null;
  inlineTranslateProviderName: string;
  inlineCaretRestoreSegmentId: string | null;
  inlineCaretRestoreToken: number;
  confirmFocusSegmentId: string | null;
  confirmFocusToken: number;
  projectTerms: ProjectTerm[];
  isPreviewVisible: boolean;
  restoreScrollKey?: number;
  onRegisterFlushPendingChanges?: (flushPendingChanges: (() => void) | null) => void;
  onTargetChange: (segmentId: string, targetText: string) => void;
  onActiveSegmentChange: (segmentExternalId: string | null) => void;
  onInlineTranslateSegment: (segmentId: string) => void;
  onConfirmSegment: (segmentId: string) => void;
  onSaveAll: () => void;
  onExport: () => void;
  onOpenAutoTranslate: () => void;
  onShowPreview: () => void;
};

export function AlignmentTool({
  segments,
  sourceLanguageLabel,
  targetLanguageLabel,
  isLoading,
  isReadOnly,
  isBusy,
  isSaving,
  isExporting,
  hasPendingChanges,
  activeSegmentExternalId,
  inlineTranslatingSegmentId,
  confirmingSegmentId,
  inlineTranslateProviderName,
  inlineCaretRestoreSegmentId,
  inlineCaretRestoreToken,
  confirmFocusSegmentId,
  confirmFocusToken,
  projectTerms,
  isPreviewVisible,
  restoreScrollKey = 0,
  onRegisterFlushPendingChanges,
  onTargetChange,
  onActiveSegmentChange,
  onInlineTranslateSegment,
  onConfirmSegment,
  onSaveAll,
  onExport,
  onOpenAutoTranslate,
  onShowPreview,
}: AlignmentToolProps) {
  const listRef = useListRef(null);
  const scrollTopRef = useRef(0);
  const emitTimeoutsRef = useRef(new Map<string, number>());
  const latestDraftValuesRef = useRef(new Map<string, string>());
  const lastHandledConfirmFocusTokenRef = useRef(0);
  const [draftTargets, setDraftTargets] = useState<Record<string, string>>({});
  const targetInputRefs = useRef(
    new Map<string, HTMLTextAreaElement | HTMLInputElement>(),
  );
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 96,
    key: `${segments.length}:${segments.map((segment) => segment.id).join("|")}`,
  });

  const emitSegmentDraftChange = useCallback(
    (segmentId: string, targetText: string) => {
      latestDraftValuesRef.current.set(segmentId, targetText);

      flushSync(() => {
        onTargetChange(segmentId, targetText);
      });
    },
    [onTargetChange],
  );

  const flushSegmentDraft = useCallback((segmentId: string) => {
    const draftValue =
      latestDraftValuesRef.current.get(segmentId) ?? draftTargets[segmentId];
    if (draftValue === undefined) {
      return;
    }

    const existingTimeoutId = emitTimeoutsRef.current.get(segmentId);
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
      emitTimeoutsRef.current.delete(segmentId);
    }

    emitSegmentDraftChange(segmentId, draftValue);
  }, [draftTargets, emitSegmentDraftChange]);

  const flushPendingChanges = useCallback(() => {
    const pendingDraftEntries = Object.entries(draftTargets);
    if (pendingDraftEntries.length === 0) {
      return;
    }

    emitTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    emitTimeoutsRef.current.clear();

    flushSync(() => {
      pendingDraftEntries.forEach(([segmentId, targetText]) => {
        emitSegmentDraftChange(segmentId, targetText);
      });
    });
  }, [draftTargets, emitSegmentDraftChange]);

  const rowData: RowData = {
    segments,
    draftTargets,
    projectTerms,
    isReadOnly,
    activeSegmentExternalId,
    inlineTranslatingSegmentId,
    confirmingSegmentId,
    inlineTranslateProviderName,
    registerTargetInput: (segmentId, element) => {
      if (element) {
        targetInputRefs.current.set(segmentId, element);
        return;
      }

      targetInputRefs.current.delete(segmentId);
    },
    onTargetDraftChange: (segmentId, targetText) => {
      setDraftTargets((currentDraftTargets) => ({
        ...currentDraftTargets,
        [segmentId]: targetText,
      }));
      latestDraftValuesRef.current.set(segmentId, targetText);

      const existingTimeoutId = emitTimeoutsRef.current.get(segmentId);
      if (existingTimeoutId) {
        return;
      }

      const nextTimeoutId = window.setTimeout(() => {
        emitTimeoutsRef.current.delete(segmentId);
        const latestTargetText = latestDraftValuesRef.current.get(segmentId);
        if (latestTargetText === undefined) {
          return;
        }

        emitSegmentDraftChange(segmentId, latestTargetText);
      }, TARGET_CHANGE_EMIT_INTERVAL_MS);
      emitTimeoutsRef.current.set(segmentId, nextTimeoutId);
    },
    onActiveSegmentChange,
    onInlineTranslateSegment,
    onConfirmSegment,
    flushSegmentDraft,
  };

  useEffect(() => {
    setDraftTargets((currentDraftTargets) => {
      const nextDraftTargets: Record<string, string> = {};

      Object.entries(currentDraftTargets).forEach(([segmentId, draftValue]) => {
        const matchingSegment = segments.find((segment) => segment.id === segmentId);
        if (!matchingSegment) {
          return;
        }

        if (matchingSegment.targetText !== draftValue) {
          nextDraftTargets[segmentId] = draftValue;
          return;
        }

        latestDraftValuesRef.current.delete(segmentId);
        const timeoutId = emitTimeoutsRef.current.get(segmentId);
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          emitTimeoutsRef.current.delete(segmentId);
        }
      });

      return nextDraftTargets;
    });
  }, [segments]);

  useEffect(() => {
    onRegisterFlushPendingChanges?.(flushPendingChanges);

    return () => {
      onRegisterFlushPendingChanges?.(null);
    };
  }, [flushPendingChanges, onRegisterFlushPendingChanges]);

  useLayoutEffect(() => {
    if (restoreScrollKey === 0 || segments.length === 0) {
      return;
    }

    emitTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    emitTimeoutsRef.current.clear();
    latestDraftValuesRef.current.clear();

    const animationFrameId = window.requestAnimationFrame(() => {
      setDraftTargets({});
      const element = listRef.current?.element;
      if (element) {
        element.scrollTop = scrollTopRef.current;
      }
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [listRef, restoreScrollKey, segments.length]);

  useLayoutEffect(() => {
    if (!inlineCaretRestoreSegmentId || inlineCaretRestoreToken === 0) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const inputElement = targetInputRefs.current.get(
        inlineCaretRestoreSegmentId,
      );
      if (!inputElement || document.activeElement !== inputElement) {
        return;
      }

      const nextCaretPosition = inputElement.value.length;
      inputElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [inlineCaretRestoreSegmentId, inlineCaretRestoreToken]);

  useLayoutEffect(() => {
    if (!confirmFocusSegmentId || confirmFocusToken === 0) {
      return;
    }

    if (lastHandledConfirmFocusTokenRef.current === confirmFocusToken) {
      return;
    }

    lastHandledConfirmFocusTokenRef.current = confirmFocusToken;

    const nextIndex = segments.findIndex(
      (segment) => segment.id === confirmFocusSegmentId,
    );
    if (nextIndex < 0) {
      return;
    }

    listRef.current?.scrollToRow({
      index: nextIndex,
      align: "smart",
      behavior: "auto",
    });

    let animationFrameId = 0;
    let attempts = 0;

    const focusNextInput = () => {
      const inputElement = targetInputRefs.current.get(confirmFocusSegmentId);
      if (!inputElement) {
        if (attempts < 10) {
          attempts += 1;
          animationFrameId = window.requestAnimationFrame(focusNextInput);
        }
        return;
      }

      inputElement.focus();
      const nextCaretPosition = inputElement.value.length;
      inputElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
    };

    animationFrameId = window.requestAnimationFrame(focusNextInput);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [confirmFocusSegmentId, confirmFocusToken, listRef, segments]);

  useEffect(() => {
    const emitTimeouts = emitTimeoutsRef.current;
    const latestDraftValues = latestDraftValuesRef.current;

    return () => {
      emitTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      emitTimeouts.clear();
      latestDraftValues.clear();
    };
  }, []);

  return (
    <Paper className="detail-section-card alignment-tool-shell" elevation={0}>
      <AlignmentToolToolbar
        isReadOnly={isReadOnly}
        isBusy={isBusy}
        isSaving={isSaving}
        isExporting={isExporting}
        hasPendingChanges={hasPendingChanges}
        isPreviewVisible={isPreviewVisible}
        onSaveAll={onSaveAll}
        onExport={onExport}
        onOpenAutoTranslate={onOpenAutoTranslate}
        onShowPreview={onShowPreview}
      />

      <Box className="alignment-grid-shell">
        <Box className="alignment-grid-head">
          <span>No.</span>
          <span>{`Source (${sourceLanguageLabel})`}</span>
          <span>{`Target (${targetLanguageLabel})`}</span>
        </Box>

        {isLoading ? (
          <Box className="empty-state alignment-empty-state">
            <Typography component="p">Loading segments...</Typography>
          </Box>
        ) : segments.length === 0 ? (
          <Box className="empty-state alignment-empty-state">
            <Typography component="p">
              No segments are ready for alignment yet.
            </Typography>
          </Box>
        ) : (
          <Box className="alignment-grid-body">
            <List
              className="alignment-virtual-list"
              listRef={listRef}
              rowComponent={AlignmentVirtualRow}
              rowCount={segments.length}
              rowHeight={rowHeight}
              rowProps={rowData}
              overscanCount={6}
              defaultHeight={480}
              onScroll={(event) => {
                scrollTopRef.current = event.currentTarget.scrollTop;
              }}
              style={{ height: "100%" }}
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
}

type RowData = {
  segments: ProjectSegment[];
  draftTargets: Record<string, string>;
  projectTerms: ProjectTerm[];
  isReadOnly: boolean;
  activeSegmentExternalId: string | null;
  inlineTranslatingSegmentId: string | null;
  confirmingSegmentId: string | null;
  inlineTranslateProviderName: string;
  registerTargetInput: (
    segmentId: string,
    element: HTMLTextAreaElement | HTMLInputElement | null,
  ) => void;
  onTargetDraftChange: (segmentId: string, targetText: string) => void;
  onActiveSegmentChange: (segmentExternalId: string | null) => void;
  onInlineTranslateSegment: (segmentId: string) => void;
  onConfirmSegment: (segmentId: string) => void;
  flushSegmentDraft: (segmentId: string) => void;
};

function AlignmentVirtualRow({
  index,
  style,
  segments,
  draftTargets,
  projectTerms,
  isReadOnly,
  activeSegmentExternalId,
  inlineTranslatingSegmentId,
  confirmingSegmentId,
  inlineTranslateProviderName,
  registerTargetInput,
  onTargetDraftChange,
  onActiveSegmentChange,
  onInlineTranslateSegment,
  onConfirmSegment,
  flushSegmentDraft,
}: RowComponentProps<RowData>) {
  const segment = segments[index];
  const targetValue = draftTargets[segment.id] ?? segment.targetText;
  const normalizedTargetValue = targetValue.trim();
  const hasTermConflict = projectTerms.some(
    (term) =>
      term.sourceTermNormalized === segment.sourceText.trim().toLowerCase() &&
      term.targetTermNormalized !== normalizedTargetValue.toLowerCase(),
  );
  const isActive = activeSegmentExternalId === segment.externalSegmentId;
  const isInlineTranslating = inlineTranslatingSegmentId === segment.id;
  const isConfirming = confirmingSegmentId === segment.id;
  const fuzzyMatches = useMemo(() => {
    if (!isActive || normalizedTargetValue.length > 0) {
      return [];
    }

    return searchFuzzyProjectTerms(segment.sourceText, projectTerms);
  }, [isActive, normalizedTargetValue.length, projectTerms, segment.sourceText]);
  const exactMatchedTerm = fuzzyMatches[0]?.score === 1 ? fuzzyMatches[0].term : null;
  const inlinePlaceholder = isInlineTranslating
    ? `Translating (by ${inlineTranslateProviderName || "translate provider"})...`
    : exactMatchedTerm?.targetTerm || "Type target translation...";
  return (
    <div style={style}>
      <Box className={`alignment-grid-row${isActive ? " active" : ""}`}>
        <Box className={`alignment-index-cell${isActive ? " active" : ""}`}>
          {segment.position}.
        </Box>

        <Box className="alignment-source-cell">
          <Typography component="p">{segment.sourceText}</Typography>
        </Box>

        <TextField
          multiline
          minRows={2}
          fullWidth
          value={targetValue}
          onChange={(event) => onTargetDraftChange(segment.id, event.target.value)}
          inputRef={(element) => registerTargetInput(segment.id, element)}
          onKeyDown={(event) => {
            if (
              event.key === "Tab" &&
              !event.shiftKey &&
              exactMatchedTerm &&
              normalizedTargetValue.length === 0
            ) {
              event.preventDefault();
              event.stopPropagation();
              onTargetDraftChange(segment.id, exactMatchedTerm.targetTerm);
              window.requestAnimationFrame(() => {
                const inputElement = document.activeElement as
                  | HTMLTextAreaElement
                  | HTMLInputElement
                  | null;
                if (!inputElement || typeof inputElement.setSelectionRange !== "function") {
                  return;
                }

                const nextCaretPosition = exactMatchedTerm.targetTerm.length;
                inputElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
              });
              return;
            }

            if (event.ctrlKey && event.code === "Space") {
              event.preventDefault();
              event.stopPropagation();
              onInlineTranslateSegment(segment.id);
              return;
            }

            if (event.ctrlKey && event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              flushSegmentDraft(segment.id);
              onConfirmSegment(segment.id);
            }
          }}
          onFocus={() => onActiveSegmentChange(segment.externalSegmentId)}
          onBlur={() => onActiveSegmentChange(null)}
          placeholder={inlinePlaceholder}
          disabled={isReadOnly || isConfirming}
          className="alignment-target-field"
        />

        <Box className="alignment-score-cell">
          <AlignmentScoreCell
            translationStatus={segment.translationStatus}
            isInlineTranslating={isInlineTranslating}
            isConfirming={isConfirming}
            hasTermConflict={hasTermConflict}
          />
        </Box>

        <Box className="alignment-status-cell">
          <AlignmentStatusCell
            translationStatus={segment.translationStatus}
            isInlineTranslating={isInlineTranslating}
            isConfirming={isConfirming}
          />
        </Box>
      </Box>
    </div>
  );
}

type AlignmentStatusBadgeProps = {
  translationStatus: ProjectSegment["translationStatus"];
  isInlineTranslating: boolean;
  isConfirming: boolean;
  hasTermConflict?: boolean;
};

function AlignmentScoreCell({
  translationStatus,
  isInlineTranslating,
  isConfirming,
  hasTermConflict = false,
}: AlignmentStatusBadgeProps) {
  const statusPresentation = getAlignmentStatusPresentation({
    translationStatus,
    isInlineTranslating,
    isConfirming,
  });

  return (
    <Stack sx={{ alignSelf: "start", width: "100%" }} direction={"column"}>
      <Tooltip
        title={`Match rate with translation memory is ${statusPresentation.score}`}
        placement="left"
        arrow
      >
        <Box
          className={`alignment-score-cell-fill ${statusPresentation.className}`}
        >
          <span>{statusPresentation.score}</span>
        </Box>
      </Tooltip>
      {hasTermConflict ? (
        <Tooltip
          title="A term with the same source already exists in translation memory with a different target."
          placement="left"
          arrow
        >
          <Box className="alignment-score-conflict-indicator">!</Box>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

function AlignmentStatusCell({
  translationStatus,
  isInlineTranslating,
  isConfirming,
}: AlignmentStatusBadgeProps) {
  const statusPresentation = getAlignmentStatusPresentation({
    translationStatus,
    isInlineTranslating,
    isConfirming,
  });

  const Icon = statusPresentation.icon;

  return (
    <Stack sx={{ alignSelf: "start", width: "100%" }} direction={"column"}>
      <Tooltip title={statusPresentation.tooltip} placement="left" arrow>
        <Box
          className={`alignment-status-icon ${statusPresentation.className}`}
        >
          <Box className="alignment-status-icon-shell">
            <Icon
              className={
                statusPresentation.spinning
                  ? "alignment-status-spin"
                  : undefined
              }
              fontSize="inherit"
            />
          </Box>
        </Box>
      </Tooltip>
    </Stack>
  );
}

function getAlignmentStatusPresentation({
  translationStatus,
  isInlineTranslating,
  isConfirming,
}: AlignmentStatusBadgeProps) {
  if (isConfirming) {
    return {
      className: "confirming",
      score: "...",
      tooltip:
        "Confirming segment and writing it to the project write translation memory.",
      icon: AutorenewRoundedIcon,
      spinning: true,
    };
  }

  if (isInlineTranslating) {
    return {
      className: "translating",
      score: "...",
      tooltip: "Inline translation is running for this segment.",
      icon: AutorenewRoundedIcon,
      spinning: true,
    };
  }

  if (translationStatus === "reviewed") {
    return {
      className: "confirmed",
      score: "101%",
      tooltip:
        "Confirmed segment. This translation is ready and has been stored in the write translation memory when available.",
      icon: CheckCircleRoundedIcon,
      spinning: false,
    };
  }

  if (translationStatus === "translated") {
    return {
      className: "translated",
      score: "95%",
      tooltip:
        "Translated segment. Review and confirm it to store it in the write translation memory.",
      icon: PendingRoundedIcon,
      spinning: false,
    };
  }

  if (translationStatus === "rejected") {
    return {
      className: "rejected",
      score: "-",
      tooltip:
        "Rejected segment. This translation needs attention before it can be confirmed.",
      icon: CloseRoundedIcon,
      spinning: false,
    };
  }

  return {
    className: "pending",
    score: "-",
    tooltip: "Pending segment. No confirmed translation has been saved yet.",
    icon: CloseRoundedIcon,
    spinning: false,
  };
}
