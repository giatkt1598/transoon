import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useAutoTranslateNotifications } from "../app/auto-translate-notifications-context";
import { LoadingPageSkeleton } from "../components/loading-skeleton";
import { ProjectPageHeader } from "../project-management/components/project-page-header";
import { useSettingsPage } from "../settings-management/hooks/use-settings-page";

export function SettingsPage() {
  const { notifications, clearAllNotifications } = useAutoTranslateNotifications();
  const [clearAnchorEl, setClearAnchorEl] = useState<HTMLElement | null>(null);
  const [showClearSuccess, setShowClearSuccess] = useState(false);
  const {
    translateProviders,
    formValues,
    isLoading,
    error,
    handleInlineTranslateProviderChange,
    handleTermFuzzyMatchThresholdChange,
  } = useSettingsPage();

  if (isLoading) {
    return <LoadingPageSkeleton />;
  }

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title="Settings"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Settings" }]}
      />

      <Box className="project-editor-shell settings-shell">
        <Box className="project-editor-section-head">
          <Typography component="h2" className="project-editor-title">
            Translation preferences
          </Typography>
          <Typography component="p" className="project-editor-copy">
            Configure the provider used for inline translation shortcuts in the alignment workspace.
          </Typography>
        </Box>

        <Box className="project-editor-form settings-form" sx={{ gap: 4 }}>
          <TextField
            select
            label="Inline Translate Provider (Ctrl + Space)"
            value={formValues.inlineTranslateProvider ?? ''}
            onChange={(event) =>
              handleInlineTranslateProviderChange(
                event.target.value ? event.target.value : null,
              )
            }
            fullWidth
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                const selectedValue = typeof value === "string" ? value : ""
                return selectedValue ? (
                  selectedValue
                ) : (
                  <span style={{ color: "rgba(89, 67, 45, 0.54)" }}>
                    No provider selected
                  </span>
                )
              },
            }}
            InputProps={{
              endAdornment:
                formValues.inlineTranslateProvider !== null ? (
                  <InputAdornment position="end" sx={{ mr: 3 }}>
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="Clear inline translate provider"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleInlineTranslateProviderChange(null)
                      }}
                    >
                      <ClearRoundedIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
            }}
            InputLabelProps={{
              shrink: true,
            }}
            helperText={
              formValues.inlineTranslateProvider === null
                ? 'Inline translate is disabled. Translation Memory suggestions still work with Ctrl + Space.'
                : 'Choose which provider is used for inline translation shortcuts.'
            }
          >
            <MenuItem value="" sx={{ display: "none" }} />
            {translateProviders.map((provider) => (
              <MenuItem key={provider.name} value={provider.name}>
                {provider.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Term Fuzzy Match Threshold (%)"
            type="number"
            value={Math.round(formValues.termFuzzyMatchThreshold * 100)}
            onChange={(event) => {
              const nextPercentValue = Number.parseFloat(event.target.value);
              if (!Number.isFinite(nextPercentValue)) {
                handleTermFuzzyMatchThresholdChange(0);
                return;
              }

              const nextThresholdValue = Math.min(Math.max(nextPercentValue, 0), 100) / 100;
              handleTermFuzzyMatchThresholdChange(nextThresholdValue);
            }}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: 0,
              max: 100,
              step: 1,
            }}
            helperText="Minimum score required for term suggestions."
          />
        </Box>
      </Box>

      <Box className="project-editor-shell settings-shell">
        <Box className="project-editor-section-head">
          <Typography component="h2" className="project-editor-title">
            Notifications
          </Typography>
          <Typography component="p" className="project-editor-copy">
            Manage background translation notifications shown in the header notification center.
          </Typography>
        </Box>

        <Box
          className="project-editor-form settings-form"
          sx={{
            gap: 2,
            alignItems: "flex-start",
          }}
        >
          <Typography component="p" className="project-editor-copy">
            Stored notifications: {notifications.length}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Button
              type="button"
              variant="contained"
              color="primary"
              disabled={notifications.length === 0}
              onClick={(event) => {
                setShowClearSuccess(false);
                setClearAnchorEl(event.currentTarget);
              }}
              startIcon={<DeleteSweepRoundedIcon fontSize="small" />}
            >
              Clear all notifications
            </Button>
            {showClearSuccess ? (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: "#2e7d32",
                }}
              >
                <CheckCircleRoundedIcon fontSize="small" />
                <Typography component="span" sx={{ color: "inherit", fontSize: "0.9rem", fontWeight: 600 }}>
                  Cleared successfully
                </Typography>
              </Box>
            ) : null}
          </Box>
          <Popover
            open={Boolean(clearAnchorEl)}
            anchorEl={clearAnchorEl}
            onClose={() => setClearAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                p: 2,
                maxWidth: 280,
              }}
            >
              <Typography component="p" sx={{ fontWeight: 600, color: "#24170f" }}>
                Clear all notifications?
              </Typography>
              <Typography component="p" sx={{ color: "#7d634f", fontSize: "0.9rem" }}>
                This will remove all stored notifications from the notification center.
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setClearAnchorEl(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    clearAllNotifications();
                    setClearAnchorEl(null);
                    setShowClearSuccess(true);
                  }}
                >
                  Clear
                </Button>
              </Box>
            </Box>
          </Popover>
        </Box>
      </Box>

      {error ? (
        <Typography component="p" className="status error">
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
