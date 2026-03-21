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

export type ProjectAutoTranslateProgressResponse = {
  projectId: string
  phase: 'queued' | 'translating' | 'completed' | 'failed'
  completedSegments: number
  totalSegments: number
  progressPercent: number
  message: string
  updatedAt: string
}

export type ProjectSummary = {
  id: string
  name: string
  description: string
  sourceLang: string
  targetLang: string
  status: 'idle' | 'auto-translate-processing'
  createdAt: string
  documentCount: number
  segmentCount: number
  translatedSegmentCount: number
  progressPercent: number
  documentFileName: string | null
}

export type ProjectsResponse = {
  projects: ProjectSummary[]
}

export type ProjectTranslationMemoryConfig = TranslationMemorySummary & {
  projectId: string
  translationMemoryId: string
  accessMode: 'read' | 'write'
  priority: number
  linkedAt: string
}

export type ProjectDetail = ProjectSummary & {
  translationMemories: ProjectTranslationMemoryConfig[]
}

export type ProjectSegment = {
  id: string
  documentId: string
  externalSegmentId: string
  sourceText: string
  targetText: string
  position: number
  translationStatus: 'pending' | 'translated' | 'reviewed' | 'rejected'
}

export type ProjectSegmentsResponse = {
  segments: ProjectSegment[]
}

export type DocxPreviewBlock = {
  blockId: string
  segmentIds: string[]
  kind: 'paragraph' | 'table'
}

export type ProjectDocumentPreview =
  | {
      documentType: 'docx'
      fileName: string
      html: string
      blocks: DocxPreviewBlock[]
    }
  | {
      documentType: string | null
      fileName: string
      supported: false
      message: string
    }

export type TranslationMemorySummary = {
  id: string
  name: string
  sourceLanguage: string
  targetLanguage: string
  lastModifiedAt: string
  lastUsedAt: string | null
  createdAt: string
  termCount: number
}

export type TranslationMemoriesResponse = {
  translationMemories: TranslationMemorySummary[]
}
