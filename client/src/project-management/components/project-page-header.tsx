import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import { Box, Button, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

type BreadcrumbItem = {
  label: string
  to?: string
}

type ProjectPageHeaderProps = {
  title: string
  breadcrumbs: BreadcrumbItem[]
  actionLabel?: string
  actionTo?: string
  actionDisabled?: boolean
}

export function ProjectPageHeader({
  title,
  breadcrumbs,
  actionLabel,
  actionTo,
  actionDisabled = false,
}: ProjectPageHeaderProps) {
  return (
    <Box className="page-header">
      <Box>
        <Typography component="h1" className="page-title">
          {title}
        </Typography>
        <Box className="breadcrumb-row">
          {breadcrumbs.map((item, index) => (
            <Box key={`${item.label}-${index}`} className="breadcrumb-item">
              {item.to ? (
                <Typography component={RouterLink} to={item.to} className="breadcrumb-link">
                  {item.label}
                </Typography>
              ) : (
                <Typography component="span" className="breadcrumb-current">
                  {item.label}
                </Typography>
              )}
              {index < breadcrumbs.length - 1 ? <ArrowForwardIosRoundedIcon fontSize="inherit" /> : null}
            </Box>
          ))}
        </Box>
      </Box>

      {actionLabel && actionTo ? (
        <Button
          component={RouterLink}
          to={actionTo}
          variant="contained"
          className="page-header-action"
          startIcon={<AddRoundedIcon />}
          disabled={actionDisabled}
        >
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  )
}
