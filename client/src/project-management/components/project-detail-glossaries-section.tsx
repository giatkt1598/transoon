import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import type { GlossarySummary, ProjectGlossaryConfig } from "../../app/types";
import { formatLanguageRoute } from "../../app/utils";

type GlossaryConfigForm = {
  glossaryId: string;
};

type ProjectDetailGlossariesSectionProps = {
  projectGlossaries: ProjectGlossaryConfig[];
  availableGlossaries: GlossarySummary[];
  glossaryConfigForm: GlossaryConfigForm;
  isGlossaryDialogOpen: boolean;
  hasPendingChanges: boolean;
  draggedGlossaryId: string | null;
  isSaving: boolean;
  isReadOnly: boolean;
  onFieldChange: <K extends keyof GlossaryConfigForm>(
    field: K,
    value: GlossaryConfigForm[K],
  ) => void;
  onOpenAddDialog: () => void;
  onCloseConfigDialog: () => void;
  onAdd: () => void;
  onDelete: (glossaryId: string) => Promise<void>;
  onDragStart: (glossaryId: string) => void;
  onDragEnd: () => void;
  onDropOnRow: (glossaryId: string) => void;
  onSaveAll: () => Promise<void>;
};

export function ProjectDetailGlossariesSection({
  projectGlossaries,
  availableGlossaries,
  glossaryConfigForm,
  isGlossaryDialogOpen,
  hasPendingChanges,
  draggedGlossaryId,
  isSaving,
  isReadOnly,
  onFieldChange,
  onOpenAddDialog,
  onCloseConfigDialog,
  onAdd,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropOnRow,
  onSaveAll,
}: ProjectDetailGlossariesSectionProps) {
  return (
    <Paper className="detail-section-card" elevation={0}>
      <Box className="panel-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            Glossaries
          </Typography>
          <Typography component="h2" variant="h4">
            Project terminology sources
          </Typography>
        </Box>
        <Button
          className="page-header-action"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          disabled={isSaving || isReadOnly}
          onClick={onOpenAddDialog}
        >
          Add glossary
        </Button>
      </Box>

      {isReadOnly ? (
        <Alert severity="warning" className="project-processing-warning">
          Glossaries are locked while auto translate is processing this project
          in the background.
        </Alert>
      ) : null}

      <Box className="detail-memory-table-shell">
        <Box className="detail-memory-table-head">
          <span></span>
          <span>Glossary</span>
          <span>Language route</span>
          <span>Priority</span>
          <span>Actions</span>
        </Box>

        {projectGlossaries.length === 0 ? (
          <Box className="empty-state detail-memory-empty">
            <Typography component="p">
              No glossary is attached to this project yet.
            </Typography>
          </Box>
        ) : (
          <Box className="detail-memory-table-body">
            {projectGlossaries.map((config) => (
              <Box
                key={config.glossaryId}
                className={`detail-memory-table-row${
                  draggedGlossaryId === config.glossaryId ? " dragging" : ""
                }`}
                draggable={!isSaving && !isReadOnly}
                onDragStart={() => onDragStart(config.glossaryId)}
                onDragEnd={onDragEnd}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropOnRow(config.glossaryId)}
              >
                <Box className="detail-drag-cell">
                  <DragIndicatorRoundedIcon fontSize="small" />
                </Box>

                <Box className="shared-primary-cell">
                  <Box>
                    <Typography component="p" className="shared-row-title">
                      {config.name}
                    </Typography>
                    <Typography component="p" className="shared-row-subtitle">
                      {config.itemCount} glossary items
                    </Typography>
                  </Box>
                </Box>

                <Box className="shared-created-cell">
                  <Typography component="p">
                    {formatLanguageRoute(
                      config.sourceLanguage,
                      config.targetLanguage,
                    )}
                  </Typography>
                  <Typography component="span">existing glossary</Typography>
                </Box>

                <Box className="shared-segment-cell">
                  <Typography component="p">{config.priority}</Typography>
                  <Typography component="span">drag to reorder</Typography>
                </Box>

                <Box className="shared-action-cell">
                  <IconButton
                    size="small"
                    disabled={isSaving || isReadOnly}
                    onClick={() => void onDelete(config.glossaryId)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box className="detail-memory-save-row">
        <Button
          className="submit-button"
          variant="contained"
          disabled={isSaving || isReadOnly || !hasPendingChanges}
          onClick={() => void onSaveAll()}
        >
          Save glossary
        </Button>
      </Box>

      <Dialog
        open={isGlossaryDialogOpen}
        onClose={onCloseConfigDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add glossary to project</DialogTitle>
        <DialogContent dividers>
          <Box className="detail-memory-dialog-body">
            <TextField
              select
              label="Glossary"
              value={glossaryConfigForm.glossaryId}
              onChange={(event) => onFieldChange("glossaryId", event.target.value)}
              disabled={isSaving}
            >
              {availableGlossaries.map((glossary) => (
                <MenuItem key={glossary.id} value={glossary.id}>
                  {glossary.name} (
                  {formatLanguageRoute(
                    glossary.sourceLanguage,
                    glossary.targetLanguage,
                  )}
                  )
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={onCloseConfigDialog}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onAdd}
            disabled={isSaving || !glossaryConfigForm.glossaryId}
          >
            Add glossary
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
