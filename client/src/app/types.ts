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

export type AppSettings = {
  inlineTranslateProvider: string | null
  termFuzzyMatchThreshold: number
}

export type AppliedGlossaryItem = {
  id: string
  glossaryId: string
  source: string
  target: string
  caseSensitive: boolean
  wholeWord: boolean
  priority: number
}

export type TranslationResponse = {
  requestId: string
  sourceLanguage: string
  targetLanguage: string
  providerName: string
  documentType: 'docx' | 'txt' | 'xlsx' | 'csv' | 'pptx'
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
  phase: 'queued' | 'translating' | 'completed' | 'failed' | 'cancelled'
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
  wordCount: number
  characterCount: number
  lastModifiedAt: string | null
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

export type ProjectGlossaryConfig = GlossarySummary & {
  projectId: string
  glossaryId: string
  priority: number
  linkedAt: string
}

export type ProjectDetail = ProjectSummary & {
  translationMemories: ProjectTranslationMemoryConfig[]
  glossaries: ProjectGlossaryConfig[]
}

export type ProjectSegment = {
  id: string
  documentId: string
  externalSegmentId: string
  previewExternalSegmentIds: string[]
  appliedGlossary: AppliedGlossaryItem[]
  sourceText: string
  targetText: string
  position: number
  translationStatus: 'pending' | 'translated' | 'reviewed' | 'rejected'
}

export type ProjectSegmentsResponse = {
  segments: ProjectSegment[]
}

export type InlineTranslatedProjectSegmentResponse = {
  segmentId: string
  targetText: string
  providerName: string
  appliedGlossary: AppliedGlossaryItem[]
}

export type ConfirmedProjectSegmentResponse = {
  project: ProjectDetail | null
  segment: ProjectSegment
  insertedIntoWriteTranslationMemory: boolean
  writeTranslationMemoryId: string | null
  termConflict: boolean
}

export type MergedProjectSegmentsResponse = {
  project: ProjectDetail | null
  segments: ProjectSegment[]
  mergedSegment: ProjectSegment
}

export type SplitProjectSegmentResponse = {
  project: ProjectDetail | null
  segments: ProjectSegment[]
  segmentsCreated: ProjectSegment[]
}

export type DocxPreviewBlock = {
  blockId: string
  segmentIds: string[]
  kind: 'paragraph' | 'table-cell'
  prefixText?: string
  separatorTexts?: string[]
  suffixText?: string
}

export type XlsxPreviewCellStyle = {
  bold: boolean
  italic: boolean
  underline: boolean
  fontSize: number | null
  fontColor: string | null
  backgroundColor: string | null
  horizontalAlign: string | null
  verticalAlign: string | null
  wrapText: boolean
}

export type XlsxPreviewCell = {
  address: string
  displayText: string
  segmentIds: string[]
  prefixText: string
  separatorTexts: string[]
  suffixText: string
  style: XlsxPreviewCellStyle
  merge: {
    isRoot: boolean
    hidden: boolean
    rowSpan: number
    colSpan: number
  }
}

export type XlsxPreviewColumn = {
  field: string
  headerName: string
  columnNumber: number
  width: number
}

export type XlsxPreviewRow = {
  rowId: string
  rowNumber: number
  height: number | null
  cells: Record<string, XlsxPreviewCell>
}

export type XlsxPreviewSheet = {
  sheetId: string
  name: string
  columns: XlsxPreviewColumn[]
  rows: XlsxPreviewRow[]
}

export type ProjectDocumentPreview =
  | {
      documentType: 'docx'
      fileName: string
      html: string
      blocks: DocxPreviewBlock[]
    }
  | {
      documentType: 'xlsx'
      fileName: string
      sheets: XlsxPreviewSheet[]
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

export type GlossarySummary = {
  id: string
  name: string
  sourceLanguage: string
  targetLanguage: string
  lastModifiedAt: string
  lastUsedAt: string | null
  createdAt: string
  itemCount: number
}

export type GlossariesResponse = {
  glossaries: GlossarySummary[]
}

export type GlossaryItem = {
  id: string
  glossaryId: string
  source: string
  sourceNormalized: string
  target: string
  targetNormalized: string
  caseSensitive: boolean
  wholeWord: boolean
  priority: number
  lastModifiedAt: string
  lastUsedAt: string | null
  createdAt: string
}

export type GlossaryItemsResponse = {
  items: GlossaryItem[]
}

export type TranslationMemoriesResponse = {
  translationMemories: TranslationMemorySummary[]
}

export type TranslationMemoryTerm = {
  id: string
  translationMemoryId: string
  sourceTerm: string
  sourceTermNormalized: string
  targetTerm: string
  targetTermNormalized: string
  lastModifiedAt: string
  lastUsedAt: string | null
  createdAt: string
}

export type TranslationMemoryTermsResponse = {
  terms: TranslationMemoryTerm[]
}

export type ProjectTerm = {
  id: string
  translationMemoryId: string
  sourceTerm: string
  sourceTermNormalized: string
  targetTerm: string
  targetTermNormalized: string
  lastModifiedAt: string
  lastUsedAt: string | null
  createdAt: string
  name: string
  sourceLanguage: string
  targetLanguage: string
  accessMode: 'read' | 'write'
  priority: number
}

export type ProjectTermsResponse = {
  terms: ProjectTerm[]
}
