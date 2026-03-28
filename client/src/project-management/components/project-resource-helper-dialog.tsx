import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  IconButton,
  Typography,
} from "@mui/material";
import { useState } from "react";

type ProjectResourceHelperDialogProps = {
  buttonLabel: string;
  dialogTitle: string;
  summary: string;
  bullets: string[];
  examplesTitle: string;
  examples: Array<{
    title: string;
    description: string;
  }>;
};

export function ProjectResourceHelperDialog({
  buttonLabel,
  dialogTitle,
  summary,
  bullets,
  examplesTitle,
  examples,
}: ProjectResourceHelperDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        size="small"
        aria-label={buttonLabel}
        className="detail-section-helper-button"
        onClick={() => setOpen(true)}
      >
        <HelpOutlineRoundedIcon fontSize="small" />
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent dividers>
          <Box className="detail-resource-helper-dialog">
            <Typography component="p">{summary}</Typography>

            <Box className="detail-resource-helper-list">
              {bullets.map((bullet) => (
                <Typography key={bullet} component="p">
                  • {bullet}
                </Typography>
              ))}
            </Box>

            <Box className="detail-resource-helper-examples">
              <Typography component="h3" variant="subtitle2">
                {examplesTitle}
              </Typography>
              {examples.map((example) => (
                <Box key={example.title} className="detail-resource-helper-example">
                  <Typography component="p" className="detail-resource-helper-example-title">
                    {example.title}
                  </Typography>
                  <Typography component="p">{example.description}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
