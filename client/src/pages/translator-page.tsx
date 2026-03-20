import { Box } from '@mui/material'
import { DocumentIntakePanel } from '../components/document-intake-panel'
import { PipelineOutputPanel } from '../components/pipeline-output-panel'

export function TranslatorPage() {
  return (
    <>
      {/* TranslatorHero is temporarily disabled. */}

      <Box component="section" className="workspace">
        <DocumentIntakePanel />
        <PipelineOutputPanel />
      </Box>
    </>
  )
}
