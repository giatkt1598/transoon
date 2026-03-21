import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { ProjectPageHeader } from '../project-management/components/project-page-header'
import { useSettingsPage } from '../settings-management/hooks/use-settings-page'

export function SettingsPage() {
  const {
    translateProviders,
    formValues,
    selectedProvider,
    isLoading,
    isSaving,
    error,
    handleInlineTranslateProviderChange,
    handleSaveSettings,
  } = useSettingsPage()

  return (
    <Box className="project-page">
      <ProjectPageHeader
        title="Settings"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Settings' },
        ]}
        actionLabel="Save"
        onActionClick={() => void handleSaveSettings()}
        actionDisabled={isLoading || isSaving || translateProviders.length === 0}
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

        <Box className="project-editor-form settings-form">
          {isLoading ? (
            <Typography component="p">Loading settings...</Typography>
          ) : (
            <>
              <TextField
                select
                label="Inline Translate Provider (Ctrl + Space)"
                value={formValues.inlineTranslateProvider}
                onChange={(event) => handleInlineTranslateProviderChange(event.target.value)}
                fullWidth
              >
                {translateProviders.map((provider) => (
                  <MenuItem key={provider.name} value={provider.name}>
                    {provider.name}
                  </MenuItem>
                ))}
              </TextField>

              {selectedProvider ? (
                <Typography component="p" className="settings-provider-copy">
                  {selectedProvider.description}
                </Typography>
              ) : null}
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
  )
}
