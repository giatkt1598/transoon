import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { Box, Button, TextField } from '@mui/material'
import { useId, useRef } from 'react'

type ProjectDocumentUploadFieldProps = {
  value: string
  disabled?: boolean
  onFileChange: (file: File | null) => void
}

export function ProjectDocumentUploadField({
  value,
  disabled = false,
  onFileChange,
}: ProjectDocumentUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <Box className="project-upload-field">
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="project-upload-input"
        accept=".txt,.docx,.xlsx,.csv,.pptx"
        disabled={disabled}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />

      <TextField
        label="Document file"
        value={value}
        placeholder="No file selected"
        fullWidth
        InputProps={{
          readOnly: true,
        }}
        disabled={disabled}
      />

      <Button
        type="button"
        variant="outlined"
        className="project-upload-button"
        startIcon={<UploadFileRoundedIcon />}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Browse file
      </Button>
    </Box>
  )
}
