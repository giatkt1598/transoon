import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import type { TranslationMemorySummary } from '../../app/types'
import { deleteTranslationMemory, fetchTranslationMemories } from '../api'

type UseTranslationMemoryListOptions = {
  searchTerm: string
}

export function useTranslationMemoryList({
  searchTerm,
}: UseTranslationMemoryListOptions) {
  const [translationMemories, setTranslationMemories] = useState<TranslationMemorySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadTranslationMemories() {
      try {
        setIsLoading(true)
        setError(null)
        setTranslationMemories(await fetchTranslationMemories(controller.signal))
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load translation memories.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadTranslationMemories()

    return () => controller.abort()
  }, [])

  const filteredTranslationMemories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) {
      return translationMemories
    }

    return translationMemories.filter((translationMemory) =>
      [translationMemory.name, translationMemory.sourceLanguage, translationMemory.targetLanguage].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      ),
    )
  }, [searchTerm, translationMemories])

  async function handleDeleteTranslationMemory(translationMemoryId: string) {
    const translationMemory = translationMemories.find((item) => item.id === translationMemoryId)
    const shouldDelete = window.confirm(
      `Delete "${translationMemory?.name ?? 'this translation memory'}"? This action cannot be undone.`,
    )

    if (!shouldDelete) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await deleteTranslationMemory(translationMemoryId)
      setTranslationMemories((current) =>
        current.filter((translationMemory) => translationMemory.id !== translationMemoryId),
      )
      toast.success('Translation memory deleted successfully.')
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Could not delete translation memory.'
      setError(message)
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return {
    filteredTranslationMemories,
    isLoading,
    isDeleting,
    error,
    handleDeleteTranslationMemory,
  }
}
