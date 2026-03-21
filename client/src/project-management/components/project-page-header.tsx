import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
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
  onActionClick?: () => void
  actionDisabled?: boolean
}

export function ProjectPageHeader({
  title,
  breadcrumbs,
  actionLabel,
  actionTo,
  onActionClick,
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

      {actionLabel && (actionTo || onActionClick) ? (
        <Button
          component={actionTo ? RouterLink : 'button'}
          to={actionTo}
          variant="contained"
          className="page-header-action"
          startIcon={onActionClick ? <SaveRoundedIcon /> : <AddRoundedIcon />}
          disabled={actionDisabled}
          onClick={onActionClick}
        >
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  )
}
