import { useEffect, useState } from 'react'
import type { ProjectDocumentPreview } from '../../app/types'
import { fetchProjectDocumentPreview } from '../../project-management/api'

type UseProjectDocumentPreviewOptions = {
  projectId?: string
  documentFileName?: string | null
}

export function useProjectDocumentPreview({
  projectId,
  documentFileName,
}: UseProjectDocumentPreviewOptions) {
  const [preview, setPreview] = useState<ProjectDocumentPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      return
    }

    if (!documentFileName?.toLowerCase().endsWith('.docx')) {
      setPreview(null)
      setPreviewError(null)
      return
    }

    const resolvedProjectId = projectId
    const controller = new AbortController()

    async function loadPreview() {
      try {
        setIsLoadingPreview(true)
        setPreviewError(null)
        const nextPreview = await fetchProjectDocumentPreview(resolvedProjectId, controller.signal)
        setPreview(nextPreview)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setPreviewError(loadError instanceof Error ? loadError.message : 'Could not load document preview.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPreview(false)
        }
      }
    }

    void loadPreview()

    return () => controller.abort()
  }, [documentFileName, projectId])

  return {
    preview,
    isLoadingPreview,
    previewError,
  }
}
