import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { useId, useRef } from 'react'
import { DocumentIcon } from '../../components/document-icon'

type ProjectDocumentUploadFieldProps = {
  value: string
  label?: string
  placeholder?: string
  helperText?: ReactNode
  emptyButtonLabel?: string
  buttonLabel?: string
  browseButtonLabel?: string
  accept?: string
  buttonMode?: boolean
  disabled?: boolean
  onFileChange: (file: File | null) => void
}

export function ProjectDocumentUploadField({
  value,
  label,
  placeholder = 'No file selected',
  helperText,
  emptyButtonLabel = 'Choose document file',
  buttonLabel,
  browseButtonLabel = 'Browse file',
  accept = '.txt,.docx,.xlsx,.csv,.pptx',
  buttonMode = false,
  disabled = false,
  onFileChange,
}: ProjectDocumentUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const openFileBrowser = () => {
    if (disabled) {
      return
    }

    inputRef.current?.click()
  }

  const shouldRenderAsButton = buttonMode && !value

  return (
    <Box className="project-upload-field">
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="project-upload-input"
        accept={accept}
        disabled={disabled}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />

      {shouldRenderAsButton ? (
        <Button
          type="button"
          variant="outlined"
          className="project-upload-trigger"
          startIcon={<UploadFileRoundedIcon />}
          disabled={disabled}
          onClick={openFileBrowser}
        >
          {buttonLabel || value || emptyButtonLabel}
        </Button>
      ) : (
        <TextField
          label={label}
          value={value}
          placeholder={placeholder}
          fullWidth
          className="project-upload-text-field"
          onClick={openFileBrowser}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openFileBrowser()
            }
          }}
          inputProps={{
            readOnly: true,
            tabIndex: disabled ? -1 : 0,
          }}
          InputLabelProps={{
            shrink: Boolean(label),
          }}
          InputProps={{
            readOnly: true,
            startAdornment: value ? (
              <InputAdornment position="start">
                <DocumentIcon fileName={value} size={22} />
              </InputAdornment>
            ) : undefined,
            sx: {
              cursor: disabled ? 'default' : 'pointer',
            },
          }}
          disabled={disabled}
          sx={{
            '& .MuiInputBase-input': {
              cursor: disabled ? 'default' : 'pointer',
            },
            '& .MuiInputLabel-root': {
              cursor: disabled ? 'default' : 'pointer',
            },
          }}
        />
      )}

      <Button
        type="button"
        variant="outlined"
        className="project-upload-button"
        startIcon={<UploadFileRoundedIcon />}
        disabled={disabled}
        onClick={openFileBrowser}
      >
        {browseButtonLabel}
      </Button>

      {helperText ? (
        <Typography component="small" className="project-upload-helper">
          {helperText}
        </Typography>
      ) : null}
    </Box>
  )
}
