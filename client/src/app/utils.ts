import type { LanguageOption } from './types'

const fallbackLanguageLabels: Record<string, string> = {
  auto: 'Auto detect',
  en: 'English',
  ja: 'Japanese',
  vi: 'Vietnamese',
  'zh-CN': 'Chinese (Simplified)',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
}

export function formatProcessingTime(processingTimeMs: number) {
  if (processingTimeMs < 1000) {
    return `${processingTimeMs} ms`
  }

  return `${(processingTimeMs / 1000).toFixed(2)} s`
}

export function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function loadStoredValue(storageKey: string, fallbackValue: string) {
  const storedValue = localStorage.getItem(storageKey)
  return storedValue && storedValue.trim().length > 0 ? storedValue : fallbackValue
}

export function hasLanguageOption(
  languages: LanguageOption[],
  selectedCode: string,
) {
  return languages.some((language) => language.code === selectedCode)
}

export function getLanguageLabel(languageCode: string) {
  return fallbackLanguageLabels[languageCode] ?? languageCode
}

export function formatLanguageRoute(sourceLanguage: string, targetLanguage: string) {
  return `${getLanguageLabel(sourceLanguage)} to ${getLanguageLabel(targetLanguage)}`
}
