import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import type { ProjectSegment } from "../../app/types";

type AlignmentTermConflictDialogProps = {
  currentSegmentId: string;
  translationMemoryTarget: string;
  conflictingSegments: ProjectSegment[];
  onGoToSegment: (segmentId: string) => void;
  onApplyTranslationMemoryTargetToMatchingSourceSegments: () => void;
  onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments: () => Promise<void> | void;
};

export function AlignmentTermConflictDialog({
  currentSegmentId,
  translationMemoryTarget,
  conflictingSegments,
  onGoToSegment,
  onApplyTranslationMemoryTargetToMatchingSourceSegments,
  onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments,
}: AlignmentTermConflictDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isApplyingAndConfirming, setIsApplyingAndConfirming] = useState(false);

  const sortedConflictingSegments = useMemo(
    () => [...conflictingSegments].sort((left, right) => left.position - right.position),
    [conflictingSegments],
  );

  return (
    <>
      <Tooltip
        title="A term with the same source already exists in translation memory with a different target."
        placement="left"
        arrow
      >
        <Box className="alignment-score-conflict-indicator" onClick={() => setIsOpen(true)}>
          <WarningAmberRoundedIcon fontSize="inherit" />
        </Box>
      </Tooltip>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Conflicting Segments</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gap: 2 }}>
            <Typography component="p" color="text.secondary">
              {`${sortedConflictingSegments.length} segment(s) share the same source but currently use a different target.`}
            </Typography>

            <Box
              sx={{
                border: "1px solid rgba(36, 23, 15, 0.12)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "72px minmax(0, 1fr) 84px",
                  gap: 0,
                  background: "#f3f0ea",
                  color: "#6f5b4c",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <Box sx={{ px: 1.5, py: 1 }}>No.</Box>
                <Box sx={{ px: 1.5, py: 1 }}>Target</Box>
                <Box sx={{ px: 1.5, py: 1 }}></Box>
              </Box>

              <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
                {sortedConflictingSegments.map((segment) =>
                  (() => {
                    const isCurrentSegment = segment.id === currentSegmentId;

                    return (
                      <Box
                        key={segment.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "72px minmax(0, 1fr) 100px",
                          borderTop: "1px solid rgba(36, 23, 15, 0.08)",
                          alignItems: "center",
                          background: "#fff",
                        }}
                      >
                        <Box sx={{ px: 1.5, py: 1.25, color: "#6f5b4c", fontWeight: 700 }}>{segment.position}.</Box>
                        <Typography
                          component="p"
                          sx={{
                            px: 1.5,
                            py: 1.25,
                            color: "#24170f",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={segment.targetText || "(Empty target)"}
                        >
                          {segment.targetText || "(Empty target)"}
                        </Typography>
                        <Box sx={{ width: "100%", px: 1.5, py: 1, display: "flex", justifyContent: "flex-end" }}>
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            disabled={isCurrentSegment}
                            onClick={() => {
                              setIsOpen(false);
                              onGoToSegment(segment.id);
                            }}
                          >
                            {isCurrentSegment ? "Current" : "Go to"}
                          </Button>
                        </Box>
                      </Box>
                    );
                  })(),
                )}
              </Box>
            </Box>

            <Box sx={{ display: "grid", gap: 0.5 }}>
              <Typography component="p" sx={{ fontWeight: 600 }}>
                Apply the target to all segments with the same source?
              </Typography>
              <Typography component="p" color="text.secondary">
                {`Target: ${translationMemoryTarget}`}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setIsOpen(false)} disabled={isApplyingAndConfirming}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isApplyingAndConfirming}
            onClick={() => {
              onApplyTranslationMemoryTargetToMatchingSourceSegments();
              setIsOpen(false);
            }}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            disabled={isApplyingAndConfirming}
            onClick={async () => {
              try {
                setIsApplyingAndConfirming(true);
                await onApplyAndConfirmTranslationMemoryTargetToMatchingSourceSegments();
                setIsOpen(false);
              } finally {
                setIsApplyingAndConfirming(false);
              }
            }}
          >
            {isApplyingAndConfirming ? "Applying..." : "Apply & Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
