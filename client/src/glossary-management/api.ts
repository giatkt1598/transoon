import { apiBaseUrl } from '../app/config'
import type {
  GlossariesResponse,
  GlossaryItem,
  GlossaryItemsResponse,
  GlossarySummary,
  LanguagesResponse,
} from '../app/types'
import type { GlossaryFormValues, GlossaryItemDraft } from './types'

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

export const defaultGlossaryFormValues: GlossaryFormValues = {
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

export async function fetchGlossaries(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/glossaries`, { signal })
  const data = await readJsonResponse<GlossariesResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load glossaries.' : 'Could not load glossaries.')
  }

  return (data as GlossariesResponse).glossaries
}

export async function fetchGlossary(glossaryId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/glossaries/${glossaryId}`, { signal })
  const data = await readJsonResponse<GlossarySummary | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load glossary.' : 'Could not load glossary.')
  }

  return data as GlossarySummary
}

export async function fetchGlossaryItems(glossaryId: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/glossaries/${glossaryId}/items`, { signal })
  const data = await readJsonResponse<GlossaryItemsResponse | { error?: string }>(response)

  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not load glossary items.' : 'Could not load glossary items.')
  }

  return (data as GlossaryItemsResponse).items
}

export async function saveGlossary(glossaryId: string | null, formValues: GlossaryFormValues) {
  const response = await fetch(
    glossaryId ? `${apiBaseUrl}/api/glossaries/${glossaryId}` : `${apiBaseUrl}/api/glossaries`,
    {
      method: glossaryId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formValues),
    },
  )

  const data = await readJsonResponse<GlossarySummary | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not save glossary.' : 'Could not save glossary.')
  }

  return data as GlossarySummary
}

export async function deleteGlossary(glossaryId: string) {
  const response = await fetch(`${apiBaseUrl}/api/glossaries/${glossaryId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response)
    throw new Error(data.error ?? 'Could not delete glossary.')
  }
}

export async function createGlossaryItem(glossaryId: string, item: GlossaryItemDraft) {
  const response = await fetch(`${apiBaseUrl}/api/glossaries/${glossaryId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  })

  const data = await readJsonResponse<GlossaryItem | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not create glossary item.' : 'Could not create glossary item.')
  }

  return data as GlossaryItem
}

export async function updateGlossaryItem(glossaryId: string, glossaryItemId: string, item: GlossaryItemDraft) {
  const response = await fetch(`${apiBaseUrl}/api/glossaries/${glossaryId}/items/${glossaryItemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  })

  const data = await readJsonResponse<GlossaryItem | { error?: string }>(response)
  if (!response.ok || 'error' in data) {
    throw new Error('error' in data ? data.error ?? 'Could not update glossary item.' : 'Could not update glossary item.')
  }

  return data as GlossaryItem
}

export async function deleteGlossaryItem(glossaryId: string, glossaryItemId: string) {
  const response = await fetch(`${apiBaseUrl}/api/glossaries/${glossaryId}/items/${glossaryItemId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response)
    throw new Error(data.error ?? 'Could not delete glossary item.')
  }
}
