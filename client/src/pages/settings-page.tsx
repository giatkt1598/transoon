import { Box, MenuItem, TextField, Typography } from "@mui/material";
import { ProjectPageHeader } from "../project-management/components/project-page-header";
import { useSettingsPage } from "../settings-management/hooks/use-settings-page";

export function SettingsPage() {
  const {
    translateProviders,
    formValues,
    isLoading,
    isSaving,
    error,
    handleInlineTranslateProviderChange,
    handleTermFuzzyMatchThresholdChange,
    handleSaveSettings,
  } = useSettingsPage();

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title="Settings"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Settings" }]}
        actionLabel="Save"
        onActionClick={() => void handleSaveSettings()}
        actionDisabled={
          isLoading || isSaving || translateProviders.length === 0
        }
      />

      <Box className="project-editor-shell settings-shell">
        <Box className="project-editor-section-head">
          <Typography component="h2" className="project-editor-title">
            Translation preferences
          </Typography>
          <Typography component="p" className="project-editor-copy">
            Configure the provider used for inline translation shortcuts in the
            alignment workspace.
          </Typography>
        </Box>

        <Box className="project-editor-form settings-form" sx={{ gap: 4 }}>
          {isLoading ? (
            <Typography component="p">Loading settings...</Typography>
          ) : (
            <>
              <TextField
                select
                label="Inline Translate Provider (Ctrl + Space)"
                value={formValues.inlineTranslateProvider}
                onChange={(event) =>
                  handleInlineTranslateProviderChange(event.target.value)
                }
                fullWidth
              >
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
                  const nextPercentValue = Number.parseFloat(
                    event.target.value,
                  );
                  if (!Number.isFinite(nextPercentValue)) {
                    handleTermFuzzyMatchThresholdChange(0);
                    return;
                  }

                  const nextThresholdValue =
                    Math.min(Math.max(nextPercentValue, 0), 100) / 100;
                  handleTermFuzzyMatchThresholdChange(nextThresholdValue);
                }}
                fullWidth
                inputProps={{
                  min: 0,
                  max: 100,
                  step: 1,
                }}
                helperText="Minimum score required for term suggestions."
              />
            </>
          )}
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
