import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { GlossarySummary } from '../../app/types'
import { deleteGlossary, fetchGlossaries } from '../api'

export function useGlossaryList() {
  const [glossaries, setGlossaries] = useState<GlossarySummary[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadGlossaries() {
      try {
        setIsLoading(true)
        setGlossaries(await fetchGlossaries(controller.signal))
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load glossaries.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadGlossaries()
    return () => controller.abort()
  }, [])

  const filteredGlossaries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) {
      return glossaries
    }

    return glossaries.filter((glossary) =>
      [glossary.name, glossary.sourceLanguage, glossary.targetLanguage].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      ),
    )
  }, [glossaries, searchTerm])

  async function handleDeleteGlossary(glossaryId: string) {
    const glossary = glossaries.find((item) => item.id === glossaryId)
    const shouldDelete = window.confirm(
      `Delete "${glossary?.name ?? 'this glossary'}"? This action cannot be undone.`,
    )
    if (!shouldDelete) {
      return
    }

    try {
      setIsDeleting(true)
      setError(null)
      await deleteGlossary(glossaryId)
      setGlossaries((current) => current.filter((glossary) => glossary.id !== glossaryId))
      toast.success('Glossary deleted successfully.')
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Could not delete glossary.'
      setError(message)
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return {
    filteredGlossaries,
    searchTerm,
    isLoading,
    isDeleting,
    error,
    setSearchTerm,
    handleDeleteGlossary,
  }
}
