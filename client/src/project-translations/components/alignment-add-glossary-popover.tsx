import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Popover,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import type { GlossaryItem, ProjectGlossaryConfig } from "../../app/types";
import {
  createGlossaryItem,
  fetchGlossaryItems,
  updateGlossaryItem,
} from "../../glossary-management/api";

type AlignmentAddGlossaryPopoverProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  projectGlossaries: ProjectGlossaryConfig[];
  defaultSource: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export function AlignmentAddGlossaryPopover({
  anchorEl,
  open,
  projectGlossaries,
  defaultSource,
  onClose,
  onSaved,
}: AlignmentAddGlossaryPopoverProps) {
  const [selectedGlossaryId, setSelectedGlossaryId] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [existingItems, setExistingItems] = useState<GlossaryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const targetInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedGlossaryId((currentValue) =>
      currentValue && projectGlossaries.some((glossary) => glossary.glossaryId === currentValue)
        ? currentValue
        : (projectGlossaries[0]?.glossaryId ?? ""),
    );
    setSource(defaultSource);
    setTarget("");
    setCaseSensitive(true);
  }, [defaultSource, open, projectGlossaries]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      targetInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [open, selectedGlossaryId]);

  useEffect(() => {
    if (!open || !selectedGlossaryId) {
      setExistingItems([]);
      return;
    }

    const controller = new AbortController();

    async function loadGlossaryItems() {
      try {
        setIsLoadingItems(true);
        const nextItems = await fetchGlossaryItems(selectedGlossaryId, controller.signal);
        setExistingItems(nextItems);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        toast.error(
          error instanceof Error ? error.message : "Could not load glossary items.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingItems(false);
        }
      }
    }

    void loadGlossaryItems();

    return () => controller.abort();
  }, [open, selectedGlossaryId]);

  const hasDuplicateSource = useMemo(() => {
    const draftItem = {
      id: "__draft__",
      glossaryId: selectedGlossaryId,
      source,
      sourceNormalized: "",
      target: "",
      targetNormalized: "",
      caseSensitive,
      wholeWord: true,
      priority: 1,
      lastModifiedAt: "",
      lastUsedAt: null,
      createdAt: "",
    } satisfies GlossaryItem;

    return existingItems.some((item) => isDuplicateGlossarySource(item, draftItem));
  }, [caseSensitive, existingItems, selectedGlossaryId, source]);

  const duplicateSourceAndTargetItem = useMemo(
    () =>
      existingItems.find((item) => {
        const existingSources = splitGlossarySourceValues(item.source);
        const draftSources = splitGlossarySourceValues(source);
        const hasSameSource = existingSources.some((existingSource) =>
          draftSources.some((draftSource) =>
            isSameGlossarySourceValue(
              existingSource,
              draftSource,
              item.caseSensitive,
              caseSensitive,
            ),
          ),
        );

        return (
          hasSameSource &&
          isSameGlossaryValue(
            item.target.trim(),
            target.trim(),
            item.caseSensitive,
            caseSensitive,
          )
        );
      }) ?? null,
    [caseSensitive, existingItems, source, target],
  );

  const appendToSameTargetItem = useMemo(
    () =>
      existingItems.find((item) => {
        if (
          !isSameGlossaryValue(
            item.target.trim(),
            target.trim(),
            item.caseSensitive,
            caseSensitive,
          )
        ) {
          return false;
        }

        const existingSources = splitGlossarySourceValues(item.source);
        const draftSources = splitGlossarySourceValues(source);
        return !existingSources.some((existingSource) =>
          draftSources.some((draftSource) =>
            isSameGlossarySourceValue(
              existingSource,
              draftSource,
              item.caseSensitive,
              caseSensitive,
            ),
          ),
        );
      }) ?? null,
    [caseSensitive, existingItems, source, target],
  );

  const canSave =
    Boolean(selectedGlossaryId) &&
    source.trim().length > 0 &&
    target.trim().length > 0 &&
    !hasDuplicateSource &&
    !duplicateSourceAndTargetItem &&
    !isLoadingItems &&
    !isSaving;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }

    try {
      setIsSaving(true);
      if (appendToSameTargetItem) {
        const existingSources = splitGlossarySourceValues(appendToSameTargetItem.source);
        const draftSources = splitGlossarySourceValues(source);
        const mergedSources = [...existingSources];

        draftSources.forEach((draftSource) => {
          if (
            !mergedSources.some((existingSource) =>
              isSameGlossarySourceValue(
                existingSource,
                draftSource,
                appendToSameTargetItem.caseSensitive,
                caseSensitive,
              ),
            )
          ) {
            mergedSources.push(draftSource);
          }
        });

        await updateGlossaryItem(selectedGlossaryId, appendToSameTargetItem.id, {
          source: mergedSources.join("; "),
          target: appendToSameTargetItem.target,
          caseSensitive: appendToSameTargetItem.caseSensitive,
          wholeWord: appendToSameTargetItem.wholeWord,
          priority: appendToSameTargetItem.priority,
        });
      } else {
        await createGlossaryItem(selectedGlossaryId, {
          source: source.trim(),
          target: target.trim(),
          caseSensitive,
          wholeWord: true,
          priority: 1,
        });
      }
      await onSaved();
      toast.success(
        appendToSameTargetItem
          ? "Glossary source appended successfully."
          : "Glossary item added successfully.",
      );
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create glossary item.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
    >
      <Box className="alignment-add-glossary-popover">
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
          Add New Glossary:
        </Typography>

        <TextField
          select
          label="Glossary"
          value={selectedGlossaryId}
          onChange={(event) => setSelectedGlossaryId(event.target.value)}
          disabled={isSaving}
        >
          {projectGlossaries.map((glossary) => (
            <MenuItem key={glossary.glossaryId} value={glossary.glossaryId}>
              {glossary.name}
            </MenuItem>
          ))}
        </TextField>

        <Box className="alignment-add-glossary-source-row">
          <TextField
            label="Source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            disabled={isSaving}
            fullWidth
          />
        </Box>

        <TextField
          label="Target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          disabled={isSaving}
          fullWidth
          inputRef={targetInputRef}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
              disabled={isSaving}
            />
          }
          label="Case-sensitive"
          className="alignment-add-glossary-checkbox"
        />

        {hasDuplicateSource ? (
          <Box className="alignment-add-glossary-warning-message">
            <WarningAmberRoundedIcon
              color="warning"
              fontSize="small"
              className="alignment-add-glossary-warning"
            />
            <Typography component="p" className="alignment-add-glossary-warning-text">
              A glossary item with the same source already exists in the selected glossary.
            </Typography>
          </Box>
        ) : null}

        {duplicateSourceAndTargetItem ? (
          <Box className="alignment-add-glossary-error-message">
            <WarningAmberRoundedIcon
              color="error"
              fontSize="small"
              className="alignment-add-glossary-warning"
            />
            <Typography component="p" className="alignment-add-glossary-error-text">
              A glossary item with the same source and target already exists.
            </Typography>
          </Box>
        ) : null}

        {!duplicateSourceAndTargetItem && appendToSameTargetItem ? (
          <Box className="alignment-add-glossary-info-message">
            <InfoOutlinedIcon
              color="info"
              fontSize="small"
              className="alignment-add-glossary-warning"
            />
            <Typography component="p" className="alignment-add-glossary-info-text">
              This source will be merged into the existing glossary item that already has the same target.
            </Typography>
          </Box>
        ) : null}

        {isLoadingItems ? (
          <Typography component="p" className="alignment-add-glossary-loading-text">
            Loading glossary items...
          </Typography>
        ) : null}

        <Box className="alignment-add-glossary-actions">
          <Button variant="outlined" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={!canSave}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </Box>
      </Box>
    </Popover>
  );
}

function isDuplicateGlossarySource(left: GlossaryItem, right: GlossaryItem) {
  const leftSources = splitGlossarySourceValues(left.source);
  const rightSources = splitGlossarySourceValues(right.source);
  if (leftSources.length === 0 || rightSources.length === 0) {
    return false;
  }

  return leftSources.some((leftSource) =>
    rightSources.some((rightSource) => {
      return isSameGlossarySourceValue(
        leftSource,
        rightSource,
        left.caseSensitive,
        right.caseSensitive,
      );
    }),
  );
}

function isSameGlossarySourceValue(
  leftSource: string,
  rightSource: string,
  leftCaseSensitive: boolean,
  rightCaseSensitive: boolean,
) {
  return isSameGlossaryValue(
    leftSource,
    rightSource,
    leftCaseSensitive,
    rightCaseSensitive,
  );
}

function isSameGlossaryValue(
  leftValue: string,
  rightValue: string,
  leftCaseSensitive: boolean,
  rightCaseSensitive: boolean,
) {
  if (leftValue === rightValue) {
    return true;
  }

  return (
    leftValue.toLocaleLowerCase() === rightValue.toLocaleLowerCase() &&
    (!leftCaseSensitive || !rightCaseSensitive)
  );
}

function splitGlossarySourceValues(value: string) {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
