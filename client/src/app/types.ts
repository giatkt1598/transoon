export type LanguageOption = {
  code: string
  label: string
}

export type LanguagesResponse = {
  defaultSourceLanguage: string
  defaultTargetLanguage: string
  languages: LanguageOption[]
}

export type TranslateProviderOption = {
  name: string
  description: string
}

export type TranslateProvidersResponse = {
  defaultTranslateProvider: string
  translateProviders: TranslateProviderOption[]
}

export type TranslationResponse = {
  requestId: string
  sourceLanguage: string
  targetLanguage: string
  providerName: string
  documentType: 'docx' | 'txt' | 'xlsx' | 'pptx'
  originalFileName: string
  outputFileName: string
  provider: string
  warnings: string[]
  segmentCount: number
  processingTimeMs: number
  preview: string[]
  downloadUrl: string
}

export type PromptPreviewResponse = {
  providerName: string
  sourceLanguage: string
  targetLanguage: string
  supported: boolean
  content: string | null
}

export type TranslationProgressResponse = {
  requestId: string
  phase: 'queued' | 'extracting' | 'translating' | 'merging' | 'completed' | 'failed'
  totalChunks: number
  completedChunks: number
  progressPercent: number
  message: string
  updatedAt: string
}

export type ProjectSummary = {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  createdAt: string
  documentCount: number
  segmentCount: number
  translatedSegmentCount: number
  progressPercent: number
}

export type ProjectsResponse = {
  projects: ProjectSummary[]
}
