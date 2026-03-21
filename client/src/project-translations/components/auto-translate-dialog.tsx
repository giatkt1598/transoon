import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import type { TranslateProviderOption } from '../../app/types'

type AutoTranslateDialogProps = {
  open: boolean
  isSubmitting: boolean
  providerName: string
  providers: TranslateProviderOption[]
  onProviderChange: (providerName: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function AutoTranslateDialog({
  open,
  isSubmitting,
  providerName,
  providers,
  onProviderChange,
  onClose,
  onConfirm,
}: AutoTranslateDialogProps) {
  const selectedProvider = providers.find((provider) => provider.name === providerName)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Start auto translate</DialogTitle>
      <DialogContent dividers className="auto-translate-dialog-body">
        <Typography component="p" className="auto-translate-dialog-copy">
          Choose the translation provider for the background auto-translate job. The project will be locked for manual
          edits until the job finishes.
        </Typography>

        <TextField
          select
          label="Translate provider"
          value={providerName}
          onChange={(event) => onProviderChange(event.target.value)}
          disabled={isSubmitting}
        >
          {providers.map((provider) => (
            <MenuItem key={provider.name} value={provider.name}>
              {provider.name}
            </MenuItem>
          ))}
        </TextField>

        {selectedProvider ? (
          <Typography component="span" className="auto-translate-provider-copy">
            {selectedProvider.description}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={isSubmitting} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={isSubmitting || !providerName} onClick={onConfirm}>
          {isSubmitting ? 'Starting...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
