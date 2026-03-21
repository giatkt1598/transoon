import { apiBaseUrl } from '../app/config'
import type {
  LanguagesResponse,
  TranslationMemoriesResponse,
  TranslationMemorySummary,
} from '../app/types'
import type { TranslationMemoryFormValues } from './types'

const fallbackLanguages: LanguagesResponse = {
  defaultSourceLanguage: 'en',
  defaultTargetLanguage: 'ja',
  languages: [
    { code: 'auto', label: 'Auto detect' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: 'Japanese' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'zh-CN', label: 'Chinese (Simplified)' },
    { code: 'ko', label: 'Korean' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'es', label: 'Spanish' },
  ],
}

export const defaultTranslationMemoryFormValues: TranslationMemoryFormValues = {
  name: '',
  sourceLanguage: fallbackLanguages.defaultSourceLanguage,
  targetLanguage: fallbackLanguages.defaultTargetLanguage,
}

async function readJsonResponse<T>(response: Response) {
  const responseText = await response.text()

  try {
    return JSON.parse(responseText) as T
  } catch {
    throw new Error(
      responseText.startsWith('<')
        ? 'The server returned HTML instead of JSON. Check that the API server is running and the route completed successfully.'
        : 'The server returned an invalid JSON response.',
    )
  }
}

export async function fetchLanguages(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/languages`, { signal })
  if (!response.ok) {
    throw new Error('Could not load language options.')
  }

  return readJsonResponse<LanguagesResponse>(response)
}

export async function fetchTranslationMemories(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/translation-memories`, { signal })
  const data = await readJsonResponse<TranslationMemoriesResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data
        ? data.error ?? 'Could not load translation memories.'
        : 'Could not load translation memories.',
    )
  }

  return (data as TranslationMemoriesResponse).translationMemories
}

export async function fetchTranslationMemory(translationMemoryId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/translation-memories/${translationMemoryId}`, { signal })
  const data = await readJsonResponse<TranslationMemorySummary | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data
        ? data.error ?? 'Could not load translation memory.'
        : 'Could not load translation memory.',
    )
  }

  return data as TranslationMemorySummary
}

export async function saveTranslationMemory(
  translationMemoryId: string | null,
  formValues: TranslationMemoryFormValues,
) {
  const response = await fetch(
    translationMemoryId
      ? `${apiBaseUrl}/api/translation-memories/${translationMemoryId}`
      : `${apiBaseUrl}/api/translation-memories`,
    {
      method: translationMemoryId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formValues),
    },
  )

  const data = await readJsonResponse<TranslationMemorySummary | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error(
      'error' in data
        ? data.error ?? 'Could not save translation memory.'
        : 'Could not save translation memory.',
    )
  }

  return data as TranslationMemorySummary
}

export async function deleteTranslationMemory(translationMemoryId: string) {
  const response = await fetch(`${apiBaseUrl}/api/translation-memories/${translationMemoryId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response)
    throw new Error(data.error ?? 'Could not delete translation memory.')
  }
}
