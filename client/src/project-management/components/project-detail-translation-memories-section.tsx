import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
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
import type {
  ProjectDetail,
  ProjectTranslationMemoryConfig,
  TranslationMemorySummary,
} from "../../app/types";
import { formatLanguageRoute } from "../../app/utils";

type TranslationMemoryConfigForm = {
  mode: "create" | "existing";
  translationMemoryId: string;
  name: string;
  accessMode: "read" | "write";
};

type ProjectDetailTranslationMemoriesSectionProps = {
  projectDetail: ProjectDetail;
  translationMemories: ProjectTranslationMemoryConfig[];
  availableTranslationMemories: TranslationMemorySummary[];
  configForm: TranslationMemoryConfigForm;
  isConfigDialogOpen: boolean;
  editingConfigId: string | null;
  draggedTranslationMemoryId: string | null;
  isSaving: boolean;
  isReadOnly: boolean;
  onFieldChange: <K extends keyof TranslationMemoryConfigForm>(
    field: K,
    value: TranslationMemoryConfigForm[K],
  ) => void;
  onOpenAddDialog: () => void;
  onOpenEditDialog: (translationMemoryId: string) => void;
  onCloseConfigDialog: () => void;
  onAdd: () => void;
  onDelete: (translationMemoryId: string) => Promise<void>;
  onAccessModeChange: (
    translationMemoryId: string,
    accessMode: "read" | "write",
  ) => void;
  onDragStart: (translationMemoryId: string) => void;
  onDragEnd: () => void;
  onDropOnRow: (translationMemoryId: string) => void;
};

export function ProjectDetailTranslationMemoriesSection({
  projectDetail,
  translationMemories,
  availableTranslationMemories,
  configForm,
  isConfigDialogOpen,
  editingConfigId,
  draggedTranslationMemoryId,
  isSaving,
  isReadOnly,
  onFieldChange,
  onOpenAddDialog,
  onOpenEditDialog,
  onCloseConfigDialog,
  onAdd,
  onDelete,
  onAccessModeChange,
  onDragStart,
  onDragEnd,
  onDropOnRow,
}: ProjectDetailTranslationMemoriesSectionProps) {
  return (
    <Paper className="detail-section-card" elevation={0}>
      <Box className="panel-heading">
        <Box>
          <Typography component="p" className="panel-kicker">
            Translation Memories
          </Typography>
          <Typography component="h2" variant="h4">
            Project lookup datasources
          </Typography>
        </Box>
        <Button
          className="page-header-action"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          disabled={isSaving || isReadOnly}
          onClick={onOpenAddDialog}
        >
          Add TM
        </Button>
      </Box>

      {isReadOnly ? (
        <Alert severity="warning" className="project-processing-warning">
          Translation memories are locked while auto translate is processing
          this project in the background.
        </Alert>
      ) : null}

      <Box className="detail-memory-table-shell">
        <Box className="detail-memory-table-head">
          <span></span>
          <span>Translation memory</span>
          <span>Access mode</span>
          <span>Actions</span>
        </Box>

        {translationMemories.length === 0 ? (
          <Box className="empty-state detail-memory-empty">
            <Typography component="p">
              No translation memory is attached to this project yet.
            </Typography>
          </Box>
        ) : (
          <Box className="detail-memory-table-body">
            {translationMemories.map((config) => (
              <Box
                key={config.translationMemoryId}
                className={`detail-memory-table-row${
                  draggedTranslationMemoryId === config.translationMemoryId
                    ? " dragging"
                    : ""
                }`}
                draggable={!isSaving && !isReadOnly}
                onDragStart={() => onDragStart(config.translationMemoryId)}
                onDragEnd={onDragEnd}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropOnRow(config.translationMemoryId)}
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
                      {config.termCount} terms
                    </Typography>
                  </Box>
                </Box>

                <TextField
                  select
                  size="small"
                  value={config.accessMode}
                  onChange={(event) =>
                    onAccessModeChange(
                      config.translationMemoryId,
                      event.target.value as "read" | "write",
                    )
                  }
                  disabled={isSaving || isReadOnly}
                  className="detail-access-select"
                >
                  <MenuItem value="read">Read</MenuItem>
                  <MenuItem value="write">Write</MenuItem>
                </TextField>

                <Box className="shared-action-cell">
                  <IconButton
                    size="small"
                    disabled={isSaving || isReadOnly}
                    onClick={() => onOpenEditDialog(config.translationMemoryId)}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={isSaving || isReadOnly}
                    onClick={() => void onDelete(config.translationMemoryId)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Dialog
        open={isConfigDialogOpen}
        onClose={onCloseConfigDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingConfigId
            ? "Edit project TM"
            : "Add translation memory to project"}
        </DialogTitle>
        <DialogContent dividers>
          <Box className="detail-memory-dialog-body">
            {!editingConfigId ? (
              <Box className="detail-memory-dialog-toggle">
                {configForm.mode === "create" ? (
                  <Button
                    variant="text"
                    onClick={() => onFieldChange("mode", "existing")}
                    disabled={isSaving}
                  >
                    Use existing translation memory
                  </Button>
                ) : (
                  <Button
                    variant="text"
                    onClick={() => onFieldChange("mode", "create")}
                    disabled={isSaving}
                  >
                    Create new translation memory
                  </Button>
                )}
              </Box>
            ) : null}

            {editingConfigId ? (
              <TextField
                label="Translation memory"
                value={configForm.name}
                disabled
              />
            ) : configForm.mode === "create" ? (
              <>
                <TextField
                  label="Translation memory name"
                  value={configForm.name}
                  onChange={(event) =>
                    onFieldChange("name", event.target.value)
                  }
                  disabled={isSaving}
                  placeholder="Product glossary EN -> JA"
                />
                <TextField
                  label="Language route"
                  value={formatLanguageRoute(
                    projectDetail.sourceLang,
                    projectDetail.targetLang,
                  )}
                  disabled
                />
              </>
            ) : (
              <TextField
                select
                label="Translation memory"
                value={configForm.translationMemoryId}
                onChange={(event) =>
                  onFieldChange("translationMemoryId", event.target.value)
                }
                disabled={Boolean(editingConfigId) || isSaving}
              >
                {availableTranslationMemories.map((translationMemory) => (
                  <MenuItem
                    key={translationMemory.id}
                    value={translationMemory.id}
                  >
                    {translationMemory.name} (
                    {formatLanguageRoute(
                      translationMemory.sourceLanguage,
                      translationMemory.targetLanguage,
                    )}
                    )
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              label="Access mode"
              value={configForm.accessMode}
              onChange={(event) =>
                onFieldChange(
                  "accessMode",
                  event.target.value as "read" | "write",
                )
              }
              disabled={isSaving}
            >
              <MenuItem value="read">Read</MenuItem>
              <MenuItem value="write">Write</MenuItem>
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
            disabled={
              isSaving ||
              (editingConfigId
                ? false
                : configForm.mode === "create"
                  ? !configForm.name.trim()
                  : !configForm.translationMemoryId)
            }
          >
            {editingConfigId ? "Update TM" : "Add TM"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
