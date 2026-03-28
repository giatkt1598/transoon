import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Box, Button, Grow, MenuItem, Popover, TextField, Typography } from "@mui/material";

export type AlignmentFindStatusOption = {
  value: "all" | "pending" | "translated" | "reviewed" | "rejected";
  label: string;
  count: number;
  icon: ReactNode;
};

type AlignmentFindPopoverProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  keyword: string;
  goToValue: string;
  goToPlaceholder: string;
  maxGoToValue: number;
  selectedStatus: AlignmentFindStatusOption["value"];
  statusOptions: AlignmentFindStatusOption[];
  onKeywordChange: (value: string) => void;
  onGoToValueChange: (value: string) => void;
  onStatusChange: (value: AlignmentFindStatusOption["value"]) => void;
  onGoTo: () => void;
  onFind: () => void;
  onReset: () => void;
  onClose: () => void;
};

export function AlignmentFindPopover({
  anchorEl,
  open,
  keyword,
  goToValue,
  goToPlaceholder,
  maxGoToValue,
  selectedStatus,
  statusOptions,
  onKeywordChange,
  onGoToValueChange,
  onStatusChange,
  onGoTo,
  onFind,
  onReset,
  onClose,
}: AlignmentFindPopoverProps) {
  const keywordInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const toolbarWidth = anchorEl?.clientWidth ?? 920;

  useEffect(() => {
    if (!open) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      keywordInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [open]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slots={{ transition: Grow }}
      slotProps={{
        paper: {
          className: "alignment-find-popover-paper",
          style: {
            width: toolbarWidth,
            maxWidth: toolbarWidth,
          },
        },
      }}
    >
      <Box className="alignment-find-popover">
        <TextField
          label="Index"
          type="number"
          value={goToValue}
          onChange={(event) => onGoToValueChange(event.target.value)}
          inputProps={{ min: 1, max: maxGoToValue }}
          placeholder={goToPlaceholder}
          slotProps={{ inputLabel: { shrink: true } }}
          className="alignment-find-index-field"
        />
        <Button variant="outlined" onClick={onGoTo}>
          Go to
        </Button>
        <TextField
          select
          label="Status"
          value={selectedStatus}
          onChange={(event) => onStatusChange(event.target.value as AlignmentFindStatusOption["value"])}
          slotProps={{ inputLabel: { shrink: true } }}
          className="alignment-find-status-field"
        >
          {statusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              <Box className="alignment-find-status-option">
                <Box className="alignment-find-status-option-icon">{option.icon}</Box>
                <Typography component="span">{`${option.label} (${option.count})`}</Typography>
              </Box>
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Keyword"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onFind();
            }
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          inputRef={keywordInputRef}
          className="alignment-find-keyword-field"
        />
        <Button variant="contained" onClick={onFind}>
          Find
        </Button>
        <Button variant="outlined" onClick={onReset}>
          Reset
        </Button>
      </Box>
    </Popover>
  );
}
