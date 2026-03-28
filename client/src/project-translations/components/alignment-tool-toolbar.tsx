import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FindReplaceOutlinedIcon from "@mui/icons-material/FindReplaceOutlined";
import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { Box, Button, Paper, Popover, Tooltip, Typography } from "@mui/material";
import { useState } from "react";

type AlignmentToolToolbarProps = {
  isReadOnly: boolean;
  isBusy: boolean;
  isSaving: boolean;
  isExporting: boolean;
  hasPendingChanges: boolean;
  isPreviewVisible: boolean;
  canSplitCurrent: boolean;
  canConfirmCurrent: boolean;
  canClearAll: boolean;
  canAddGlossary: boolean;
  showMergeTooltip: boolean;
  onSaveAll: () => void;
  onClearAll: () => void;
  onOpenAddGlossary: (anchorElement: HTMLElement | null) => void;
  onOpenSplitDialog: () => void;
  onConfirmCurrent: () => void;
  onJoinSelected: () => void;
  onExport: () => void;
  onOpenAutoTranslate: () => void;
  onShowPreview: () => void;
};

export function AlignmentToolToolbar({
  isReadOnly,
  isBusy,
  isSaving,
  isExporting,
  hasPendingChanges,
  isPreviewVisible,
  canSplitCurrent,
  canConfirmCurrent,
  canClearAll,
  canAddGlossary,
  showMergeTooltip,
  onSaveAll,
  onClearAll,
  onOpenAddGlossary,
  onOpenSplitDialog,
  onConfirmCurrent,
  onJoinSelected,
  onExport,
  onOpenAutoTranslate,
  onShowPreview,
}: AlignmentToolToolbarProps) {
  const [clearAllAnchorEl, setClearAllAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Paper className="alignment-toolbar-shell" elevation={0}>
      <Box className="alignment-toolbar-actions">
        <Tooltip title="Ctrl + S" arrow placement="bottom">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveOutlinedIcon fontSize="small" />}
              disabled={isReadOnly || isSaving}
              onClick={onSaveAll}
              className="alignment-toolbar-button"
            >
              {isSaving ? "Saving..." : hasPendingChanges ? "Save*" : "Save"}
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadRoundedIcon fontSize="small" />}
          disabled={isReadOnly || isExporting || isBusy}
          onClick={onExport}
          className="alignment-toolbar-button"
        >
          {isExporting ? "Exporting..." : "Export"}
        </Button>
        {!isPreviewVisible ? (
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionOutlinedIcon fontSize="small" />}
            onClick={onShowPreview}
            className="alignment-toolbar-button"
          >
            Preview
          </Button>
        ) : null}
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoFixHighRoundedIcon fontSize="small" />}
          disabled={isReadOnly || isBusy}
          onClick={onOpenAutoTranslate}
          className="alignment-toolbar-button"
        >
          Auto Translate
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<LibraryAddOutlinedIcon fontSize="small" />}
          disabled={isReadOnly || !canAddGlossary}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => onOpenAddGlossary(event.currentTarget)}
          className="alignment-toolbar-button"
        >
          Add Glossary
        </Button>
        <Tooltip title="Ctrl + Enter" arrow placement="bottom">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CheckCircleRoundedIcon fontSize="small" />}
              disabled={!canConfirmCurrent}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onConfirmCurrent}
              className="alignment-toolbar-button"
            >
              Confirm
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={"Ctrl + \\"} arrow placement="bottom">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CallSplitOutlinedIcon fontSize="small" />}
              disabled={!canSplitCurrent}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onOpenSplitDialog}
              className="alignment-toolbar-button"
            >
              Split
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          arrow
          placement="bottom"
          open={showMergeTooltip ? undefined : false}
          disableHoverListener={!showMergeTooltip}
          disableFocusListener={!showMergeTooltip}
          disableTouchListener={!showMergeTooltip}
          title={
            <Box>
              <Typography variant="body2">1. Press Shift to show checkboxes.</Typography>
              <Typography variant="body2">2. Check 2 adjacent rows.</Typography>
              <Typography variant="body2">3. Click Merge again to apply.</Typography>
            </Box>
          }
        >
          <Button
            variant="outlined"
            size="small"
            startIcon={<MergeTypeOutlinedIcon fontSize="small" />}
            data-alignment-merge-button="true"
            onClick={onJoinSelected}
            className="alignment-toolbar-button"
          >
            Merge
          </Button>
        </Tooltip>
        <Button
          variant="outlined"
          size="small"
          startIcon={<BackspaceOutlinedIcon fontSize="small" />}
          disabled={!canClearAll}
          onClick={(event) => setClearAllAnchorEl(event.currentTarget)}
          className="alignment-toolbar-button"
        >
          Clear All
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FindReplaceOutlinedIcon fontSize="small" />}
          disabled
          className="alignment-toolbar-button"
        >
          Find
        </Button>
      </Box>

      <Popover
        open={Boolean(clearAllAnchorEl)}
        anchorEl={clearAllAnchorEl}
        onClose={() => setClearAllAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 280, display: "grid", gap: 1.5 }}>
          <Typography component="p" sx={{ fontWeight: 700 }}>
            Clear all target values?
          </Typography>
          <Typography component="p" color="text.secondary">
            This only clears targets on the browser. Nothing will be saved until you click Save.
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="outlined" onClick={() => setClearAllAnchorEl(null)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                onClearAll();
                setClearAllAnchorEl(null);
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Popover>
    </Paper>
  );
}
