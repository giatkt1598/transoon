import { Box, Typography } from '@mui/material'

type PlaceholderPageProps = {
  eyebrow: string
  title: string
  description: string
}

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <Box className="placeholder-page">
      <Typography className="eyebrow">{eyebrow}</Typography>
      <Typography component="h1" className="placeholder-title">
        {title}
      </Typography>
      <Typography className="placeholder-copy">{description}</Typography>
    </Box>
  )
}
