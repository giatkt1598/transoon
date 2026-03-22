import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLayoutEffect, useRef } from "react";

type SplitSegmentDialogProps = {
  open: boolean;
  sourceText: string;
  caretPosition: number;
  onCaretPositionChange: (caretPosition: number) => void;
  onClose: () => void;
  onSplit: () => void;
};

export function SplitSegmentDialog({
  open,
  sourceText,
  caretPosition,
  onCaretPositionChange,
  onClose,
  onSplit,
}: SplitSegmentDialogProps) {
  const sourceInputRef = useRef<HTMLTextAreaElement | null>(null);
  const boundedCaretPosition = Math.max(
    0,
    Math.min(caretPosition, sourceText.length),
  );
  const sourcePartOne = sourceText.slice(0, boundedCaretPosition).trim();
  const sourcePartTwo = sourceText.slice(boundedCaretPosition).trim();
  const canSplit =
    sourcePartOne.trim().length > 0 && sourcePartTwo.trim().length > 0;

  const handleSubmitSplit = () => {
    if (!canSplit) {
      return;
    }

    onSplit();
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const inputElement = sourceInputRef.current;
      if (!inputElement) {
        return;
      }

      inputElement.focus();
      inputElement.setSelectionRange(
        boundedCaretPosition,
        boundedCaretPosition,
      );
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [boundedCaretPosition, open]);

  const updateCaretFromInput = () => {
    const inputElement = sourceInputRef.current;
    if (!inputElement) {
      return;
    }

    onCaretPositionChange(inputElement.selectionStart ?? 0);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ className: "alignment-split-dialog-paper" }}
    >
      <DialogTitle>Split segment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Source"
            value={sourceText}
            inputRef={sourceInputRef}
            inputProps={{
              className: "alignment-split-source-input",
            }}
            multiline
            minRows={1}
            maxRows={12}
            onChange={() => {}}
            onClick={updateCaretFromInput}
            onKeyUp={updateCaretFromInput}
            onMouseUp={updateCaretFromInput}
            onSelect={updateCaretFromInput}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !canSplit) {
                return;
              }

              event.preventDefault();
              handleSubmitSplit();
            }}
            fullWidth
          />

          <Typography component="p" className="alignment-split-label">
            Split to:
          </Typography>

          <TextField
            label="Source 1"
            value={sourcePartOne}
            InputProps={{ readOnly: true }}
            multiline
            minRows={1}
            fullWidth
          />

          <TextField
            label="Source 2"
            value={sourcePartTwo}
            InputProps={{ readOnly: true }}
            multiline
            minRows={1}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmitSplit}
          disabled={!canSplit}
        >
          Split
        </Button>
      </DialogActions>
    </Dialog>
  );
}
