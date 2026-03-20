import { Box } from '@mui/material'
import './App.css'
import { DocumentIntakePanel } from './components/document-intake-panel'
import { PipelineOutputPanel } from './components/pipeline-output-panel'

function App() {
  return (
    <Box component="main" className="shell">
      <Box component="section" className="workspace">
        <DocumentIntakePanel />
        <PipelineOutputPanel />
      </Box>
    </Box>
  )
}

export default App
