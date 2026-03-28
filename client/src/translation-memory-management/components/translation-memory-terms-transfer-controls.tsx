import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import type { TranslationMemoryTerm } from "../../app/types";
import {
  buildTranslationMemoryExportFile,
  parseTranslationMemoryImportFile,
  type TranslationMemoryTermDraft,
  type TranslationMemoryTransferFormat,
} from "../translation-memory-term-transfer";

type TranslationMemoryTermsTransferControlsProps = {
  translationMemoryName: string;
  terms: TranslationMemoryTerm[];
  sourceLanguageCode: string;
  targetLanguageCode: string;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  onImportItems: (items: TranslationMemoryTermDraft[]) => void | Promise<void>;
};

type ImportPreviewState = {
  fileName: string;
  format: TranslationMemoryTransferFormat;
  items: TranslationMemoryTermDraft[];
};

export function TranslationMemoryTermsTransferControls({
  translationMemoryName,
  terms,
  sourceLanguageCode,
  targetLanguageCode,
  sourceLanguageLabel,
  targetLanguageLabel,
  onImportItems,
}: TranslationMemoryTermsTransferControlsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [isParsingImportFile, setIsParsingImportFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = (format: TranslationMemoryTransferFormat) => {
    const { blob, extension } = buildTranslationMemoryExportFile(format, terms, {
      sourceLanguageCode,
      targetLanguageCode,
    });
    const fileName = `${sanitizeFileName(translationMemoryName || "translation-memory-terms")}.${extension}`;
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = objectUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(objectUrl);
    setExportAnchorEl(null);
  };

  const handleImportFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    try {
      setIsParsingImportFile(true);
      const fileText = await selectedFile.text();
      const parsedImport = parseTranslationMemoryImportFile(selectedFile.name, fileText, {
        sourceLanguageCode,
        targetLanguageCode,
      });
      setImportPreview({
        fileName: selectedFile.name,
        format: parsedImport.format,
        items: parsedImport.items,
      });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Could not parse the selected translation memory file.",
      );
    } finally {
      setIsParsingImportFile(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) {
      return;
    }

    try {
      setIsImporting(true);
      await onImportItems(importPreview.items);
      setImportPreview(null);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        <Button
          sx={{ borderRadius: "8px" }}
          variant="contained"
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsingImportFile || isImporting}
        >
          Import
        </Button>
        <Button
          sx={{ borderRadius: "8px" }}
          variant="contained"
          endIcon={<ArrowDropDownRoundedIcon />}
          onClick={(event) => setExportAnchorEl(event.currentTarget)}
          disabled={terms.length === 0 || isParsingImportFile || isImporting}
        >
          Export
        </Button>
      </Stack>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tmx"
        hidden
        onChange={handleImportFileSelected}
      />

      <Popover
        open={Boolean(exportAnchorEl)}
        anchorEl={exportAnchorEl}
        onClose={() => setExportAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        elevation={1}
      >
        <Box sx={{ minWidth: 180, py: 0.5 }}>
          <MenuItem onClick={() => handleExport("csv")}>
            <DownloadRoundedIcon fontSize="small" sx={{ mr: 1 }} />
            Export as CSV
          </MenuItem>
          <MenuItem onClick={() => handleExport("tmx")}>
            <DownloadRoundedIcon fontSize="small" sx={{ mr: 1 }} />
            Export as TMX
          </MenuItem>
        </Box>
      </Popover>

      <Dialog
        open={isParsingImportFile || Boolean(importPreview)}
        onClose={() => {
          if (isParsingImportFile || isImporting) {
            return;
          }

          setImportPreview(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Import translation memory terms</DialogTitle>
        <DialogContent dividers>
          {isParsingImportFile ? (
            <Stack spacing={2}>
              <Typography component="p">
                Reading translation memory file and building an import preview...
              </Typography>
              <LinearProgress />
            </Stack>
          ) : importPreview ? (
            <Stack spacing={2.5}>
              <Box>
                <Typography component="p" sx={{ fontWeight: 600 }}>
                  {importPreview.fileName}
                </Typography>
                <Typography component="p" color="text.secondary">
                  {`${importPreview.format.toUpperCase()} import for ${sourceLanguageLabel} -> ${targetLanguageLabel}`}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 2,
                }}
              >
                <ImportInfo label="Detected items" value={String(importPreview.items.length)} />
                <ImportInfo
                  label="Language pair"
                  value={`${sourceLanguageCode} -> ${targetLanguageCode}`}
                />
              </Box>

              {isImporting ? <LinearProgress /> : null}

              <Box>
                <Typography component="p" sx={{ fontWeight: 600, mb: 1 }}>
                  Preview
                </Typography>
                <Stack spacing={1}>
                  {importPreview.items.slice(0, 5).map((item, index) => (
                    <Box
                      key={`${item.sourceTerm}-${item.targetTerm}-${index}`}
                      sx={{
                        border: "1px solid rgba(36, 23, 15, 0.12)",
                        borderRadius: 2,
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Typography component="p" sx={{ fontWeight: 600 }}>
                        {item.sourceTerm}
                      </Typography>
                      <Typography component="p" color="text.secondary">
                        {item.targetTerm}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                {importPreview.items.length > 5 ? (
                  <Typography component="p" color="text.secondary" sx={{ mt: 1 }}>
                    {`+${importPreview.items.length - 5} more items will be added to the current draft.`}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setImportPreview(null)}
            disabled={isParsingImportFile || isImporting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadFileRoundedIcon />}
            onClick={() => void handleConfirmImport()}
            disabled={
              isParsingImportFile ||
              isImporting ||
              !importPreview ||
              importPreview.items.length === 0
            }
          >
            Confirm import
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ImportInfo({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        border: "1px solid rgba(36, 23, 15, 0.12)",
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
      }}
    >
      <Typography component="span" color="text.secondary">
        {label}
      </Typography>
      <Typography component="p" sx={{ fontWeight: 600, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

function sanitizeFileName(value: string) {
  const sanitizedValue = value.trim().replace(/[<>:"/\\|?*]+/gu, "-");
  return sanitizedValue.length > 0 ? sanitizedValue : "translation-memory-terms";
}
