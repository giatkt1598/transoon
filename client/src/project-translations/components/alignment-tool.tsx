import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PendingRoundedIcon from "@mui/icons-material/PendingRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Box,
  Checkbox,
  MenuItem,
  MenuList,
  Paper,
  Popover,
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
import { toast } from "react-toastify";
import {
  List,
  useDynamicRowHeight,
  useListRef,
  type RowComponentProps,
} from "react-window";
import type { ProjectSegment } from "../../app/types";
import type { ProjectTerm } from "../../app/types";
import {
  getAppliedTermMatchScore,
  searchFuzzyProjectTerms,
  type FuzzyMatchedProjectTerm,
} from "../term-fuzzy-search";
import { TERM_FUZZY_MATCH_THRESHOLD } from "../constants";
import { AlignmentToolToolbar } from "./alignment-tool-toolbar";
import { AlignmentTermConflictDialog } from "./alignment-term-conflict-dialog";
import { SplitSegmentDialog } from "./split-segment-dialog";
import "./alignment-tool.scss";

const TARGET_CHANGE_EMIT_INTERVAL_MS = 300;

type AlignmentToolProps = {
  segments: ProjectSegment[];
  savedSegmentTargets: Record<string, string>;
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
  termFuzzyMatchThreshold: number;
  inlineCaretRestoreSegmentId: string | null;
  inlineCaretRestoreToken: number;
  confirmFocusSegmentId: string | null;
  confirmFocusToken: number;
  projectTerms: ProjectTerm[];
  isPreviewVisible: boolean;
  restoreScrollKey?: number;
  onRegisterFlushPendingChanges?: (
    flushPendingChanges: (() => void) | null,
  ) => void;
  onTargetChange: (segmentId: string, targetText: string) => void;
  onActiveSegmentChange: (segmentExternalId: string | null) => void;
  onInlineTranslateSegment: (segmentId: string) => void;
  onConfirmSegment: (segmentId: string, targetText?: string) => void;
  onSplitSegment?: (segmentId: string, splitIndex: number) => void;
  onSaveAll: () => void;
  onJoinSelected?: (segmentIds: string[]) => void;
  onExport: () => void;
  onOpenAutoTranslate: () => void;
  onShowPreview: () => void;
};

export function AlignmentTool({
  segments,
  savedSegmentTargets,
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
  termFuzzyMatchThreshold,
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
  onSplitSegment,
  onSaveAll,
  onJoinSelected,
  onExport,
  onOpenAutoTranslate,
  onShowPreview,
}: AlignmentToolProps) {
  const listRef = useListRef(null);
  const tableShellRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);
  const emitTimeoutsRef = useRef(new Map<string, number>());
  const latestDraftValuesRef = useRef(new Map<string, string>());
  const lastHandledConfirmFocusTokenRef = useRef(0);
  const [draftTargets, setDraftTargets] = useState<Record<string, string>>({});
  const [isShiftSelectionMode, setIsShiftSelectionMode] = useState(false);
  const [checkedSegmentIds, setCheckedSegmentIds] = useState<string[]>([]);
  const [splitDialogSegmentId, setSplitDialogSegmentId] = useState<string | null>(
    null,
  );
  const [splitCaretPosition, setSplitCaretPosition] = useState(0);
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

  const flushSegmentDraft = useCallback(
    (segmentId: string) => {
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
    },
    [draftTargets, emitSegmentDraftChange],
  );

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

  const focusSegmentAtIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= segments.length) {
        return;
      }

      const nextSegment = segments[index];
      listRef.current?.scrollToRow({
        index,
        align: "smart",
        behavior: "auto",
      });

      let attempts = 0;
      const focusNextInput = () => {
        const inputElement = targetInputRefs.current.get(nextSegment.id);
        if (!inputElement) {
          if (attempts < 10) {
            attempts += 1;
            window.requestAnimationFrame(focusNextInput);
          }
          return;
        }

        inputElement.focus();
        const nextCaretPosition = inputElement.value.length;
        inputElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
      };

      window.requestAnimationFrame(focusNextInput);
    },
    [listRef, segments],
  );

  const focusSegmentById = useCallback(
    (segmentId: string) => {
      const nextIndex = segments.findIndex((segment) => segment.id === segmentId);
      if (nextIndex < 0) {
        return;
      }

      focusSegmentAtIndex(nextIndex);
    },
    [focusSegmentAtIndex, segments],
  );

  const rowData: RowData = {
    segments,
    savedSegmentTargets,
    draftTargets,
    projectTerms,
    isReadOnly,
    isAltSelectionMode: isShiftSelectionMode,
    checkedSegmentIds,
    activeSegmentExternalId,
    inlineTranslatingSegmentId,
    confirmingSegmentId,
    inlineTranslateProviderName,
    termFuzzyMatchThreshold,
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
    onOpenSplitDialog: () => {
      if (isReadOnly || !activeSegmentExternalId) {
        return;
      }

      const segmentToSplit = segments.find(
        (segment) => segment.externalSegmentId === activeSegmentExternalId,
      );
      if (!segmentToSplit) {
        return;
      }

      const nextCaretPosition = Math.floor(segmentToSplit.sourceText.length / 2);
      setSplitDialogSegmentId(segmentToSplit.id);
      setSplitCaretPosition(nextCaretPosition);
    },
    onConfirmSegment,
    flushSegmentDraft,
    onSelectSegmentRange: (segmentId) => {
      setCheckedSegmentIds((currentCheckedSegmentIds) => {
        if (currentCheckedSegmentIds.includes(segmentId)) {
          return currentCheckedSegmentIds.filter(
            (checkedSegmentId) => checkedSegmentId !== segmentId,
          );
        }

        return [...currentCheckedSegmentIds, segmentId];
      });
    },
    focusSegmentAtIndex,
    focusSegmentById,
  };
  const activeSegment = segments.find(
    (segment) => segment.externalSegmentId === activeSegmentExternalId,
  );
  const activeSegmentTargetText = activeSegment
    ? draftTargets[activeSegment.id] ?? activeSegment.targetText
    : "";
  const splitDialogSegment = splitDialogSegmentId
    ? segments.find((segment) => segment.id === splitDialogSegmentId) ?? null
    : null;
  const splitSourceText = splitDialogSegment?.sourceText ?? "";
  const boundedSplitCaretPosition = Math.max(
    0,
    Math.min(splitCaretPosition, splitSourceText.length),
  );
  const canSplitCurrent = Boolean(activeSegment) && !isReadOnly;
  const canConfirmCurrent =
    Boolean(activeSegment) && !isReadOnly && !confirmingSegmentId;
  const canClearAll =
    !isReadOnly &&
    segments.some((segment) => {
      const targetValue = draftTargets[segment.id] ?? segment.targetText;
      return targetValue.length > 0;
    });

  const clearSelectionMode = useCallback(() => {
    setIsShiftSelectionMode(false);
    setCheckedSegmentIds([]);
  }, []);

  const executeMergeSelection = useCallback(
    (segmentIds: string[]) => {
      const selectedIndexes = segmentIds
        .map((segmentId) =>
          segments.findIndex((segment) => segment.id === segmentId),
        )
        .filter((index) => index >= 0)
        .sort((left, right) => left - right);

      if (selectedIndexes.length !== 2) {
        toast.error("Select exactly two rows to merge.");
        return;
      }

      if (selectedIndexes[1] - selectedIndexes[0] !== 1) {
        toast.error("Only two adjacent rows can be merged.");
        return;
      }

      console.log("mergeSegments", segmentIds);
      onJoinSelected?.(segmentIds);
      clearSelectionMode();
    },
    [clearSelectionMode, onJoinSelected, segments],
  );

  const openSplitDialog = useCallback(() => {
    if (!activeSegment || isReadOnly) {
      return;
    }

    const nextCaretPosition = Math.floor(activeSegment.sourceText.length / 2);
    setSplitDialogSegmentId(activeSegment.id);
    setSplitCaretPosition(nextCaretPosition);
  }, [activeSegment, isReadOnly]);

  const closeSplitDialog = useCallback(() => {
    setSplitDialogSegmentId(null);
  }, []);

  const clearAllTargets = useCallback(() => {
    const segmentIdsToClear = segments
      .filter((segment) => {
        const targetValue = draftTargets[segment.id] ?? segment.targetText;
        return targetValue.length > 0;
      })
      .map((segment) => segment.id);

    if (segmentIdsToClear.length === 0) {
      return;
    }

    segmentIdsToClear.forEach((segmentId) => {
      const timeoutId = emitTimeoutsRef.current.get(segmentId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        emitTimeoutsRef.current.delete(segmentId);
      }

      latestDraftValuesRef.current.set(segmentId, "");
    });

    setDraftTargets((currentDraftTargets) => ({
      ...currentDraftTargets,
      ...Object.fromEntries(segmentIdsToClear.map((segmentId) => [segmentId, ""])),
    }));

    segmentIdsToClear.forEach((segmentId) => {
      onTargetChange(segmentId, "");
    });
  }, [draftTargets, onTargetChange, segments]);

  useEffect(() => {
    setDraftTargets((currentDraftTargets) => {
      const nextDraftTargets: Record<string, string> = {};

      Object.entries(currentDraftTargets).forEach(([segmentId, draftValue]) => {
        const matchingSegment = segments.find(
          (segment) => segment.id === segmentId,
        );
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

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift") {
        return;
      }

      if (event.repeat) {
        return;
      }

      event.preventDefault();

      if (isShiftSelectionMode) {
        clearSelectionMode();
        return;
      }

      setIsShiftSelectionMode(true);
      if (checkedSegmentIds.length > 0) {
        return;
      }

      if (!activeSegmentExternalId) {
        return;
      }

      const activeSegmentForSelection = segments.find(
        (segment) => segment.externalSegmentId === activeSegmentExternalId,
      );
      if (!activeSegmentForSelection) {
        return;
      }

      setCheckedSegmentIds([activeSegmentForSelection.id]);
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [
    activeSegmentExternalId,
    checkedSegmentIds.length,
    clearSelectionMode,
    isShiftSelectionMode,
    segments,
  ]);

  useEffect(() => {
    if (!isShiftSelectionMode) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (tableShellRef.current?.contains(target)) {
        return;
      }

      const targetElement =
        target instanceof Element ? target : target.parentElement;
      if (targetElement?.closest('[data-alignment-merge-button="true"]')) {
        return;
      }

      clearSelectionMode();
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [
    clearSelectionMode,
    isShiftSelectionMode,
  ]);

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
        canSplitCurrent={canSplitCurrent}
        canConfirmCurrent={canConfirmCurrent}
        canClearAll={canClearAll}
        showMergeTooltip={checkedSegmentIds.length === 0}
        onSaveAll={onSaveAll}
        onClearAll={clearAllTargets}
        onOpenSplitDialog={openSplitDialog}
        onConfirmCurrent={() => {
          if (!activeSegment) {
            return;
          }

          flushSegmentDraft(activeSegment.id);
          onConfirmSegment(activeSegment.id, activeSegmentTargetText);
        }}
        onJoinSelected={() => executeMergeSelection(checkedSegmentIds)}
        onExport={onExport}
        onOpenAutoTranslate={onOpenAutoTranslate}
        onShowPreview={onShowPreview}
      />

      <Box ref={tableShellRef} className="alignment-grid-shell">
        <Box className="alignment-grid-head">
          {isShiftSelectionMode ? <span className="alignment-select-head" /> : null}
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

      <SplitSegmentDialog
        open={Boolean(splitDialogSegment)}
        sourceText={splitSourceText}
        caretPosition={boundedSplitCaretPosition}
        onCaretPositionChange={setSplitCaretPosition}
        onClose={closeSplitDialog}
        onSplit={() => {
          if (!splitDialogSegment) {
            return;
          }

          onSplitSegment?.(splitDialogSegment.id, boundedSplitCaretPosition);
          closeSplitDialog();
        }}
      />
    </Paper>
  );
}

type RowData = {
  segments: ProjectSegment[];
  savedSegmentTargets: Record<string, string>;
  draftTargets: Record<string, string>;
  projectTerms: ProjectTerm[];
  isReadOnly: boolean;
  isAltSelectionMode: boolean;
  checkedSegmentIds: string[];
  activeSegmentExternalId: string | null;
  inlineTranslatingSegmentId: string | null;
  confirmingSegmentId: string | null;
  inlineTranslateProviderName: string;
  termFuzzyMatchThreshold: number;
  registerTargetInput: (
    segmentId: string,
    element: HTMLTextAreaElement | HTMLInputElement | null,
  ) => void;
  onTargetDraftChange: (segmentId: string, targetText: string) => void;
  onActiveSegmentChange: (segmentExternalId: string | null) => void;
  onInlineTranslateSegment: (segmentId: string) => void;
  onOpenSplitDialog: () => void;
  onConfirmSegment: (segmentId: string, targetText?: string) => void;
  flushSegmentDraft: (segmentId: string) => void;
  onSelectSegmentRange: (segmentId: string) => void;
  focusSegmentAtIndex: (index: number) => void;
  focusSegmentById: (segmentId: string) => void;
};

function AlignmentVirtualRow({
  index,
  style,
  segments,
  savedSegmentTargets,
  draftTargets,
  projectTerms,
  isReadOnly,
  isAltSelectionMode,
  checkedSegmentIds,
  activeSegmentExternalId,
  inlineTranslatingSegmentId,
  confirmingSegmentId,
  inlineTranslateProviderName,
  termFuzzyMatchThreshold,
  registerTargetInput,
  onTargetDraftChange,
  onActiveSegmentChange,
  onInlineTranslateSegment,
  onOpenSplitDialog,
  onConfirmSegment,
  flushSegmentDraft,
  onSelectSegmentRange,
  focusSegmentAtIndex,
  focusSegmentById,
}: RowComponentProps<RowData>) {
  const segment = segments[index];
  const inputElementRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(
    null,
  );
  const [inlineAssistMenu, setInlineAssistMenu] = useState<{
    top: number;
    left: number;
    matches: FuzzyMatchedProjectTerm[];
  } | null>(null);
  const [selectedInlineAssistIndex, setSelectedInlineAssistIndex] = useState(0);
  const targetValue = draftTargets[segment.id] ?? segment.targetText;
  const normalizedTargetValue = targetValue.trim();
  const savedTargetValue = savedSegmentTargets[segment.id] ?? "";
  const displayTranslationStatus =
    targetValue !== savedTargetValue ? "pending" : segment.translationStatus;
  const isChecked = checkedSegmentIds.includes(segment.id);
  const hasTermConflict =
    normalizedTargetValue.length > 0 &&
    projectTerms.some(
      (term) =>
        term.sourceTermNormalized === segment.sourceText.trim().toLowerCase() &&
        term.targetTermNormalized !== normalizedTargetValue.toLowerCase(),
    );
  const preferredTranslationMemoryTerm =
    normalizedTargetValue.length > 0
      ? projectTerms.find(
          (term) =>
            term.sourceTermNormalized ===
            segment.sourceText.trim().toLowerCase(),
        ) ?? null
      : null;
  const conflictingSourceSegments = useMemo(
    () =>
      segments.filter((candidateSegment) => {
        if (
          candidateSegment.sourceText.trim().toLowerCase() !==
          segment.sourceText.trim().toLowerCase()
        ) {
          return false;
        }

        const candidateTargetValue =
          draftTargets[candidateSegment.id] ?? candidateSegment.targetText;
        return (
          normalizedTargetValue.length > 0 &&
          candidateTargetValue.trim().length > 0 &&
          candidateTargetValue.trim().toLowerCase() !==
            (preferredTranslationMemoryTerm?.targetTerm ?? "").trim().toLowerCase()
        );
      }),
    [
      draftTargets,
      normalizedTargetValue,
      preferredTranslationMemoryTerm?.targetTerm,
      segment.sourceText,
      segments,
    ],
  );
  const isActive = activeSegmentExternalId === segment.externalSegmentId;
  const isInlineTranslating = inlineTranslatingSegmentId === segment.id;
  const isConfirming = confirmingSegmentId === segment.id;
  const fuzzyMatches = useMemo(() => {
    if (!isActive || normalizedTargetValue.length > 0) {
      return [];
    }

    return searchFuzzyProjectTerms(
      segment.sourceText,
      projectTerms,
      termFuzzyMatchThreshold,
    );
  }, [
    isActive,
    normalizedTargetValue.length,
    projectTerms,
    segment.sourceText,
    termFuzzyMatchThreshold,
  ]);
  const sourceTermMatches = useMemo(
    () =>
      searchFuzzyProjectTerms(
        segment.sourceText,
        projectTerms,
        termFuzzyMatchThreshold,
      ),
    [projectTerms, segment.sourceText, termFuzzyMatchThreshold],
  );
  const exactMatchedTerm =
    fuzzyMatches[0]?.score === 1 ? fuzzyMatches[0].term : null;
  const appliedTermMatchScore = useMemo(
    () =>
      getAppliedTermMatchScore(
        segment.sourceText,
        targetValue,
        projectTerms,
      ),
    [projectTerms, segment.sourceText, targetValue],
  );
  const hasSourceTermMatches = sourceTermMatches.length > 0;
  const hasEmptyTarget = normalizedTargetValue.length === 0;
  const hasNoTermAvailable = !hasSourceTermMatches;
  const hasUnmatchedTermSuggestion =
    !hasEmptyTarget && hasSourceTermMatches && appliedTermMatchScore === null;
  const hasLowTermMatchScore =
    appliedTermMatchScore !== null &&
    appliedTermMatchScore > 0 &&
    appliedTermMatchScore < termFuzzyMatchThreshold;
  const inlinePlaceholder = isInlineTranslating
    ? `Translating (by ${inlineTranslateProviderName || "translate provider"})...`
    : exactMatchedTerm?.targetTerm || "Type target translation...";
  const highlightedSourceFragments = useMemo(
    () => buildHighlightedSourceFragments(segment),
    [segment],
  );

  const handleApplyTerm = useCallback(
    (nextTargetText: string) => {
      onTargetDraftChange(segment.id, nextTargetText);
      setInlineAssistMenu(null);
      setSelectedInlineAssistIndex(0);

      window.requestAnimationFrame(() => {
        const inputElement = inputElementRef.current;
        if (!inputElement) {
          return;
        }

        inputElement.focus();
        const nextCaretPosition = nextTargetText.length;
        inputElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });
    },
    [onTargetDraftChange, segment.id],
  );

  const handleOpenInlineAssistMenu = useCallback(
    (
      inputElement: HTMLTextAreaElement | HTMLInputElement,
      matches: FuzzyMatchedProjectTerm[],
    ) => {
      const caretPosition =
        inputElement.selectionStart ?? inputElement.value.length;
      const caretCoordinates = getTextareaCaretCoordinates(
        inputElement,
        caretPosition,
      );
      const inputBounds = inputElement.getBoundingClientRect();

      setInlineAssistMenu({
        top: inputBounds.top + caretCoordinates.top + 28,
        left: inputBounds.left + caretCoordinates.left + 12,
        matches,
      });
      setSelectedInlineAssistIndex(0);
    },
    [],
  );

  return (
    <div style={style}>
      <Box
        className={`alignment-grid-row${
          isActive || isChecked ? " active" : ""
        }${isAltSelectionMode ? " selection-mode" : ""}`}
        onMouseDown={() => {
          if (!isAltSelectionMode) {
            return;
          }

          onSelectSegmentRange(segment.id);
        }}
      >
        {isAltSelectionMode ? (
          <Box className="alignment-select-cell">
            <Checkbox
              size="small"
              checked={isChecked}
              onMouseDown={(event) => event.stopPropagation()}
              onChange={() => onSelectSegmentRange(segment.id)}
            />
          </Box>
        ) : null}
        <Box
          className={`alignment-index-cell${isActive || isChecked ? " active" : ""}`}
        >
          {segment.position}.
        </Box>

        <Box className="alignment-source-cell">
          <Typography component="p">
            {highlightedSourceFragments.map((fragment, fragmentIndex) =>
              fragment.isHighlighted ? (
                <Tooltip
                  key={`${segment.id}-glossary-${fragmentIndex}`}
                  title={`Glossary: ${fragment.glossaryItem.source} -> ${fragment.glossaryItem.target}`}
                  arrow
                  placement="top"
                >
                  <span className="alignment-glossary-highlight">
                    {fragment.text}
                  </span>
                </Tooltip>
              ) : (
                <span key={`${segment.id}-text-${fragmentIndex}`}>
                  {fragment.text}
                </span>
              ),
            )}
          </Typography>
        </Box>

        <TextField
          multiline
          minRows={2}
          fullWidth
          value={targetValue}
          onChange={(event) => {
            setInlineAssistMenu(null);
            setSelectedInlineAssistIndex(0);
            onTargetDraftChange(segment.id, event.target.value);
          }}
          inputRef={(element) => {
            inputElementRef.current = element;
            registerTargetInput(segment.id, element);
          }}
          onKeyDown={(event) => {
            if (inlineAssistMenu) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                event.stopPropagation();
                setSelectedInlineAssistIndex((currentIndex) => {
                  const lastIndex = inlineAssistMenu.matches.length;
                  return currentIndex >= lastIndex ? 0 : currentIndex + 1;
                });
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                event.stopPropagation();
                setSelectedInlineAssistIndex((currentIndex) => {
                  const lastIndex = inlineAssistMenu.matches.length;
                  return currentIndex <= 0 ? lastIndex : currentIndex - 1;
                });
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setInlineAssistMenu(null);
                setSelectedInlineAssistIndex(0);
                return;
              }

              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                event.stopPropagation();

                const selectedMatch =
                  inlineAssistMenu.matches[selectedInlineAssistIndex];
                if (selectedMatch) {
                  handleApplyTerm(selectedMatch.term.targetTerm);
                  return;
                }

                setInlineAssistMenu(null);
                setSelectedInlineAssistIndex(0);
                flushSegmentDraft(segment.id);
                onInlineTranslateSegment(segment.id);
                return;
              }
            }

            if (!inlineAssistMenu && event.key === "ArrowDown") {
              event.preventDefault();
              event.stopPropagation();
              focusSegmentAtIndex(index + 1);
              return;
            }

            if (!inlineAssistMenu && event.key === "ArrowUp") {
              event.preventDefault();
              event.stopPropagation();
              focusSegmentAtIndex(index - 1);
              return;
            }

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
                if (
                  !inputElement ||
                  typeof inputElement.setSelectionRange !== "function"
                ) {
                  return;
                }

                const nextCaretPosition = exactMatchedTerm.targetTerm.length;
                inputElement.setSelectionRange(
                  nextCaretPosition,
                  nextCaretPosition,
                );
              });
              return;
            }

            if (event.ctrlKey && event.code === "Space") {
              event.preventDefault();
              event.stopPropagation();
              if (
                normalizedTargetValue.length === 0 &&
                fuzzyMatches.length > 0
              ) {
                const inputElement = inputElementRef.current;
                if (inputElement) {
                  handleOpenInlineAssistMenu(inputElement, fuzzyMatches);
                  return;
                }

                setInlineAssistMenu({
                  top: window.innerHeight / 2,
                  left: window.innerWidth / 2,
                  matches: fuzzyMatches,
                });
                setSelectedInlineAssistIndex(0);
                return;
              }

              flushSegmentDraft(segment.id);
              onInlineTranslateSegment(segment.id);
              return;
            }

            if (event.ctrlKey && event.code === "Backslash") {
              event.preventDefault();
              event.stopPropagation();
              onOpenSplitDialog();
              return;
            }

            if (event.ctrlKey && event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              flushSegmentDraft(segment.id);
              onConfirmSegment(segment.id, targetValue);
            }
          }}
          onFocus={() => {
            onActiveSegmentChange(segment.externalSegmentId);
          }}
          onBlur={() => {
            onActiveSegmentChange(null);
            window.setTimeout(() => {
              if (document.activeElement === inputElementRef.current) {
                return;
              }

              setInlineAssistMenu(null);
              setSelectedInlineAssistIndex(0);
            }, 0);
          }}
          placeholder={inlinePlaceholder}
          disabled={isReadOnly || isConfirming}
          className="alignment-target-field"
        />

        <Popover
          open={Boolean(inlineAssistMenu)}
          onClose={() => {
            setInlineAssistMenu(null);
            setSelectedInlineAssistIndex(0);
          }}
          anchorReference="anchorPosition"
          anchorPosition={
            inlineAssistMenu
              ? { top: inlineAssistMenu.top, left: inlineAssistMenu.left }
              : undefined
          }
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          disableAutoFocus
          disableEnforceFocus
          disableRestoreFocus
          slotProps={{
            paper: {
              className: "alignment-inline-assist-popover",
            },
          }}
        >
          <MenuList dense autoFocusItem={false}>
            {inlineAssistMenu?.matches.map((match, matchIndex) => (
              <MenuItem
                key={match.term.id}
                selected={matchIndex === selectedInlineAssistIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleApplyTerm(match.term.targetTerm)}
                className="alignment-inline-assist-item"
              >
                <Box className="alignment-inline-assist-copy">
                  <Tooltip
                    title={match.term.targetTerm}
                    placement="right"
                    arrow
                  >
                    <Typography
                      component="span"
                      className="alignment-inline-assist-target"
                    >
                      {match.term.targetTerm}
                    </Typography>
                  </Tooltip>
                  <Typography
                    component="span"
                    className="alignment-inline-assist-score"
                  >
                    {`${Math.round(match.score * 100)}%`}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
            <MenuItem
              selected={
                selectedInlineAssistIndex ===
                (inlineAssistMenu?.matches.length ?? Number.POSITIVE_INFINITY)
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setInlineAssistMenu(null);
                setSelectedInlineAssistIndex(0);
                flushSegmentDraft(segment.id);
                onInlineTranslateSegment(segment.id);
              }}
              className="alignment-inline-assist-item alignment-inline-assist-translate"
            >
              <Typography component="span">
                {`Translate with ${inlineTranslateProviderName || "Translation Provider"}`}
              </Typography>
            </MenuItem>
          </MenuList>
        </Popover>

        <Box className="alignment-score-cell">
          <AlignmentScoreCell
            segment={segment}
            translationStatus={displayTranslationStatus}
            isInlineTranslating={isInlineTranslating}
            isConfirming={isConfirming}
            termMatchScore={appliedTermMatchScore}
            termFuzzyMatchThreshold={termFuzzyMatchThreshold}
            hasEmptyTarget={hasEmptyTarget}
            hasNoTermAvailable={hasNoTermAvailable}
            hasUnmatchedTermSuggestion={hasUnmatchedTermSuggestion}
            hasLowTermMatchScore={hasLowTermMatchScore}
            hasTermConflict={hasTermConflict}
            conflictingSegments={conflictingSourceSegments}
            translationMemoryTarget={preferredTranslationMemoryTerm?.targetTerm ?? ""}
            onGoToSegment={focusSegmentById}
            onApplyTranslationMemoryTargetToMatchingSourceSegments={() => {
              const nextTargetText = preferredTranslationMemoryTerm?.targetTerm ?? "";
              if (!nextTargetText) {
                return;
              }

              const matchingSegments = segments.filter(
                (candidateSegment) =>
                  candidateSegment.sourceText.trim().toLowerCase() ===
                  segment.sourceText.trim().toLowerCase(),
              );

              matchingSegments.forEach((candidateSegment) => {
                onTargetDraftChange(candidateSegment.id, nextTargetText);
              });
            }}
            onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments={async () => {
              const nextTargetText = preferredTranslationMemoryTerm?.targetTerm ?? "";
              if (!nextTargetText) {
                return;
              }

              const matchingSegments = segments.filter(
                (candidateSegment) =>
                  candidateSegment.sourceText.trim().toLowerCase() ===
                  segment.sourceText.trim().toLowerCase(),
              );

              for (const candidateSegment of matchingSegments) {
                onTargetDraftChange(candidateSegment.id, nextTargetText);
                flushSegmentDraft(candidateSegment.id);
                await onConfirmSegment(candidateSegment.id, nextTargetText);
              }
            }}
          />
        </Box>

        <Box className="alignment-status-cell">
          <AlignmentStatusCell
            translationStatus={displayTranslationStatus}
            isInlineTranslating={isInlineTranslating}
            isConfirming={isConfirming}
          />
        </Box>
      </Box>
    </div>
  );
}

type AlignmentStatusBadgeProps = {
  segment?: ProjectSegment;
  translationStatus: ProjectSegment["translationStatus"];
  isInlineTranslating: boolean;
  isConfirming: boolean;
  termMatchScore?: number | null;
  termFuzzyMatchThreshold?: number;
  hasEmptyTarget?: boolean;
  hasNoTermAvailable?: boolean;
  hasUnmatchedTermSuggestion?: boolean;
  hasLowTermMatchScore?: boolean;
  hasTermConflict?: boolean;
  conflictingSegments?: ProjectSegment[];
  translationMemoryTarget?: string;
  onGoToSegment?: (segmentId: string) => void;
  onApplyTranslationMemoryTargetToMatchingSourceSegments?: () => void;
  onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments?:
    () => Promise<void> | void;
};

function AlignmentScoreCell({
  segment,
  translationStatus,
  isInlineTranslating,
  isConfirming,
  termMatchScore = null,
  termFuzzyMatchThreshold = TERM_FUZZY_MATCH_THRESHOLD,
  hasEmptyTarget = false,
  hasNoTermAvailable = false,
  hasUnmatchedTermSuggestion = false,
  hasLowTermMatchScore = false,
  hasTermConflict = false,
  conflictingSegments = [],
  translationMemoryTarget = "",
  onGoToSegment,
  onApplyTranslationMemoryTargetToMatchingSourceSegments,
  onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments,
}: AlignmentStatusBadgeProps) {
  const statusPresentation = getAlignmentStatusPresentation({
    translationStatus,
    isInlineTranslating,
    isConfirming,
    termMatchScore,
    termFuzzyMatchThreshold,
    hasEmptyTarget,
    hasNoTermAvailable,
    hasUnmatchedTermSuggestion,
    hasLowTermMatchScore,
  });

  return (
    <Stack sx={{ alignSelf: "start", width: "100%" }} direction={"column"}>
      <Tooltip title={statusPresentation.tooltip} placement="left" arrow>
        <Box
          className={`alignment-score-cell-fill ${statusPresentation.className}`}
        >
          <span>{statusPresentation.score}</span>
        </Box>
      </Tooltip>
      {hasTermConflict ? (
        segment &&
        onGoToSegment &&
        onApplyTranslationMemoryTargetToMatchingSourceSegments &&
        onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments &&
        translationMemoryTarget ? (
          <AlignmentTermConflictDialog
            currentSegmentId={segment.id}
            translationMemoryTarget={translationMemoryTarget}
            conflictingSegments={conflictingSegments}
            onGoToSegment={onGoToSegment}
            onApplyTranslationMemoryTargetToMatchingSourceSegments={
              onApplyTranslationMemoryTargetToMatchingSourceSegments
            }
            onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments={
              onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments
            }
          />
        ) : (
          <Tooltip
            title="A term with the same source already exists in translation memory with a different target."
            placement="left"
            arrow
          >
            <Box className="alignment-score-conflict-indicator">
              <WarningAmberRoundedIcon fontSize="inherit" />
            </Box>
          </Tooltip>
        )
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
  termMatchScore,
  termFuzzyMatchThreshold,
  hasEmptyTarget,
  hasNoTermAvailable,
  hasUnmatchedTermSuggestion,
  hasLowTermMatchScore,
}: AlignmentStatusBadgeProps) {
  const resolvedTermMatchScore = termMatchScore ?? null;
  const hasStrongTermMatch =
    resolvedTermMatchScore !== null &&
    resolvedTermMatchScore >= (termFuzzyMatchThreshold ?? TERM_FUZZY_MATCH_THRESHOLD);
  const resolvedTermMatchScoreLabel =
    resolvedTermMatchScore !== null
      ? `${Math.round(resolvedTermMatchScore * 100)}%`
      : null;

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
      className:
        hasStrongTermMatch
          ? "confirmed"
          : hasLowTermMatchScore ||
              hasEmptyTarget ||
              hasUnmatchedTermSuggestion
            ? "term-mismatch"
            : hasNoTermAvailable
              ? "pending"
              : "confirmed",
      score:
        hasStrongTermMatch || hasLowTermMatchScore
          ? (resolvedTermMatchScoreLabel ?? "-")
          : hasEmptyTarget
            ? "-"
            : hasNoTermAvailable
              ? "-"
              : hasUnmatchedTermSuggestion
                ? "-"
                : "101%",
      tooltip:
        resolvedTermMatchScore !== null
          ? `Confirmed segment with a ${Math.round(resolvedTermMatchScore * 100)}% term match.`
          : hasEmptyTarget
            ? "This segment does not have a target translation yet."
            : hasNoTermAvailable
              ? "No translation memory term is available for this source segment."
              : hasUnmatchedTermSuggestion
                ? "A term suggestion exists for this source, but the current target does not match any suggested term."
                : "Confirmed segment. This translation is ready and has been stored in the write translation memory when available.",
      icon: CheckCircleRoundedIcon,
      spinning: false,
    };
  }

  if (translationStatus === "translated") {
    return {
      className:
        hasStrongTermMatch
          ? "confirmed"
          : hasLowTermMatchScore ||
              hasEmptyTarget ||
              hasUnmatchedTermSuggestion
            ? "term-mismatch"
            : hasNoTermAvailable
              ? "pending"
              : "translated",
      score:
        hasStrongTermMatch || hasLowTermMatchScore
          ? (resolvedTermMatchScoreLabel ?? "-")
          : hasEmptyTarget
            ? "-"
            : hasNoTermAvailable
              ? "-"
              : hasUnmatchedTermSuggestion
                ? "-"
                : "95%",
      tooltip:
        resolvedTermMatchScore !== null
          ? `Translated segment with a ${Math.round(resolvedTermMatchScore * 100)}% term match.`
          : hasEmptyTarget
            ? "This segment does not have a target translation yet."
            : hasNoTermAvailable
              ? "No translation memory term is available for this source segment."
              : hasUnmatchedTermSuggestion
                ? "A term suggestion exists for this source, but the current target does not match any suggested term."
                : "Translated segment. Review and confirm it to store it in the write translation memory (Ctrl + Enter to Confirm)",
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
    tooltip:
      "Pending segment. No confirmed translation has been saved yet (Ctrl + Enter to Confirm)",
    icon: CloseRoundedIcon,
    spinning: false,
  };
}

type HighlightedSourceFragment =
  | { text: string; isHighlighted: false }
  | {
      text: string;
      isHighlighted: true;
      glossaryItem: ProjectSegment["appliedGlossary"][number];
    };

function buildHighlightedSourceFragments(
  segment: ProjectSegment,
): HighlightedSourceFragment[] {
  if (!segment.appliedGlossary.length) {
    return [{ text: segment.sourceText, isHighlighted: false }];
  }

  const sortedItems = [...segment.appliedGlossary].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    const rightLongestSourceLength = getLongestGlossarySourceLength(right.source);
    const leftLongestSourceLength = getLongestGlossarySourceLength(left.source);

    if (rightLongestSourceLength !== leftLongestSourceLength) {
      return rightLongestSourceLength - leftLongestSourceLength;
    }

    return left.source.localeCompare(right.source);
  });

  const fragments: HighlightedSourceFragment[] = [];
  let currentIndex = 0;

  while (currentIndex < segment.sourceText.length) {
    const matchedItem = sortedItems.find((item) =>
      isGlossaryMatchAt(segment.sourceText, currentIndex, item),
    );

    if (!matchedItem) {
      fragments.push({
        text: segment.sourceText[currentIndex] ?? "",
        isHighlighted: false,
      });
      currentIndex += 1;
      continue;
    }

    fragments.push({
      text: segment.sourceText.slice(
        currentIndex,
        currentIndex + getGlossaryMatchLengthAt(segment.sourceText, currentIndex, matchedItem),
      ),
      isHighlighted: true,
      glossaryItem: matchedItem,
    });
    currentIndex += getGlossaryMatchLengthAt(segment.sourceText, currentIndex, matchedItem);
  }

  return compactHighlightedFragments(fragments);
}

function compactHighlightedFragments(
  fragments: HighlightedSourceFragment[],
) {
  return fragments.reduce<HighlightedSourceFragment[]>((result, fragment) => {
    const previousFragment = result[result.length - 1];
    if (!previousFragment) {
      result.push(fragment);
      return result;
    }

    if (!fragment.isHighlighted && !previousFragment.isHighlighted) {
      previousFragment.text += fragment.text;
      return result;
    }

    if (
      fragment.isHighlighted &&
      previousFragment.isHighlighted &&
      previousFragment.glossaryItem.id === fragment.glossaryItem.id
    ) {
      previousFragment.text += fragment.text;
      return result;
    }

    result.push(fragment);
    return result;
  }, []);
}

function isGlossaryMatchAt(
  sourceText: string,
  startIndex: number,
  glossaryItem: ProjectSegment["appliedGlossary"][number],
) {
  return getMatchedGlossarySourceVariantAt(sourceText, startIndex, glossaryItem) !== null;
}

function isWordCharacter(value: string) {
  return value.length > 0 && /[\p{L}\p{N}_]/u.test(value);
}

function getGlossaryMatchLengthAt(
  sourceText: string,
  startIndex: number,
  glossaryItem: ProjectSegment["appliedGlossary"][number],
) {
  return (
    getMatchedGlossarySourceVariantAt(sourceText, startIndex, glossaryItem)?.length ??
    0
  );
}

function getMatchedGlossarySourceVariantAt(
  sourceText: string,
  startIndex: number,
  glossaryItem: ProjectSegment["appliedGlossary"][number],
) {
  const sourceVariants = splitGlossarySourceVariants(glossaryItem.source).sort(
    (left, right) => right.length - left.length,
  );

  for (const sourceVariant of sourceVariants) {
    const candidateText = sourceText.slice(
      startIndex,
      startIndex + sourceVariant.length,
    );
    if (!candidateText) {
      continue;
    }

    const leftValue = glossaryItem.caseSensitive
      ? candidateText
      : candidateText.toLowerCase();
    const rightValue = glossaryItem.caseSensitive
      ? sourceVariant
      : sourceVariant.toLowerCase();

    if (leftValue !== rightValue) {
      continue;
    }

    if (!glossaryItem.wholeWord) {
      return sourceVariant;
    }

    const previousCharacter = sourceText[startIndex - 1] ?? "";
    const nextCharacter =
      sourceText[startIndex + sourceVariant.length] ?? "";

    if (
      !isWordCharacter(previousCharacter) &&
      !isWordCharacter(nextCharacter)
    ) {
      return sourceVariant;
    }
  }

  return null;
}

function splitGlossarySourceVariants(value: string) {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function getLongestGlossarySourceLength(value: string) {
  return splitGlossarySourceVariants(value).reduce(
    (maxLength, sourceVariant) => Math.max(maxLength, sourceVariant.length),
    0,
  );
}


function getTextareaCaretCoordinates(
  inputElement: HTMLTextAreaElement | HTMLInputElement,
  caretPosition: number,
) {
  const mirrorElement = document.createElement("div");
  const mirrorSpan = document.createElement("span");
  const computedStyle = window.getComputedStyle(inputElement);

  mirrorElement.style.position = "fixed";
  mirrorElement.style.visibility = "hidden";
  mirrorElement.style.pointerEvents = "none";
  mirrorElement.style.top = "0";
  mirrorElement.style.left = "0";
  mirrorElement.style.whiteSpace = "pre-wrap";
  mirrorElement.style.wordBreak = "break-word";
  mirrorElement.style.overflowWrap = "anywhere";
  mirrorElement.style.boxSizing = computedStyle.boxSizing;
  mirrorElement.style.width = computedStyle.width;
  mirrorElement.style.padding = computedStyle.padding;
  mirrorElement.style.border = computedStyle.border;
  mirrorElement.style.font = computedStyle.font;
  mirrorElement.style.fontFamily = computedStyle.fontFamily;
  mirrorElement.style.fontSize = computedStyle.fontSize;
  mirrorElement.style.fontWeight = computedStyle.fontWeight;
  mirrorElement.style.fontStyle = computedStyle.fontStyle;
  mirrorElement.style.letterSpacing = computedStyle.letterSpacing;
  mirrorElement.style.lineHeight = computedStyle.lineHeight;
  mirrorElement.style.textTransform = computedStyle.textTransform;
  mirrorElement.style.textIndent = computedStyle.textIndent;

  const beforeCaretText = inputElement.value.slice(0, caretPosition) || " ";
  mirrorElement.textContent = beforeCaretText;
  mirrorSpan.textContent = inputElement.value.slice(caretPosition) || " ";
  mirrorElement.appendChild(mirrorSpan);
  document.body.appendChild(mirrorElement);

  const top = mirrorSpan.offsetTop - inputElement.scrollTop;
  const left = mirrorSpan.offsetLeft - inputElement.scrollLeft;
  document.body.removeChild(mirrorElement);

  return { top, left };
}
