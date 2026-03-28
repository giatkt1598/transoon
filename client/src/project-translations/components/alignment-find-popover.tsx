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
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slots={{ transition: Grow }}
      slotProps={{
        paper: {
          className: "alignment-find-popover-paper",
        },
      }}
    >
      <Box className="alignment-find-popover">
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
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          inputRef={keywordInputRef}
        />

        <Box className="alignment-find-goto-row">
          <TextField
            label="Index"
            type="number"
            value={goToValue}
            onChange={(event) => onGoToValueChange(event.target.value)}
            inputProps={{ min: 1, max: maxGoToValue }}
            placeholder={goToPlaceholder}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="outlined" onClick={onGoTo}>
            Go to
          </Button>
        </Box>

        <TextField
          select
          label="Status"
          value={selectedStatus}
          onChange={(event) => onStatusChange(event.target.value as AlignmentFindStatusOption["value"])}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
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

        <Box className="alignment-find-actions">
          <Button variant="outlined" onClick={onReset}>
            Reset
          </Button>
          <Button variant="contained" onClick={onFind}>
            Find
          </Button>
        </Box>
      </Box>
    </Popover>
  );
}
