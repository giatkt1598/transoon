import './App.css'
import { DocumentIntakePanel } from './components/document-intake-panel'
import { PipelineOutputPanel } from './components/pipeline-output-panel'

function App() {
  return (
    <main className="shell">
      <section className="workspace">
        <DocumentIntakePanel />
        <PipelineOutputPanel />
      </section>
    </main>
  )
}

export default App
