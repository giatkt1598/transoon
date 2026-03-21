export const translationMemorySchemaSql = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sourceLang TEXT NOT NULL,
  targetLang TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fileName TEXT NOT NULL,
  documentType TEXT,
  contentSha256 TEXT,
  storagePath TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  externalSegmentId TEXT NOT NULL,
  sourceLanguage TEXT NOT NULL,
  targetLanguage TEXT NOT NULL,
  sourceText TEXT NOT NULL,
  sourceTextNormalized TEXT NOT NULL,
  sourceTextHash TEXT NOT NULL,
  targetText TEXT NOT NULL DEFAULT '',
  targetTextNormalized TEXT NOT NULL DEFAULT '',
  targetTextHash TEXT,
  tokensJson TEXT NOT NULL,
  position INTEGER NOT NULL,
  translationStatus TEXT NOT NULL DEFAULT 'pending'
    CHECK (translationStatus IN ('pending', 'translated', 'reviewed', 'rejected')),
  providerName TEXT,
  reviewedByHuman INTEGER NOT NULL DEFAULT 0 CHECK (reviewedByHuman IN (0, 1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(documentId, position),
  UNIQUE(documentId, externalSegmentId)
);

CREATE TABLE IF NOT EXISTS segment_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segmentId TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  tokenIndex INTEGER NOT NULL,
  tokenType TEXT NOT NULL
    CHECK (tokenType IN ('text', 'tag', 'placeholder', 'line_break', 'other')),
  tokenValue TEXT NOT NULL,
  UNIQUE(segmentId, tokenIndex)
);

CREATE TABLE IF NOT EXISTS translation_units (
  id TEXT PRIMARY KEY,
  projectId TEXT REFERENCES projects(id) ON DELETE SET NULL,
  sourceLanguage TEXT NOT NULL,
  targetLanguage TEXT NOT NULL,
  sourceText TEXT NOT NULL,
  sourceTextNormalized TEXT NOT NULL,
  sourceTextHash TEXT NOT NULL,
  targetText TEXT NOT NULL,
  targetTextNormalized TEXT NOT NULL,
  targetTextHash TEXT NOT NULL,
  tokensJson TEXT NOT NULL,
  originDocumentId TEXT REFERENCES documents(id) ON DELETE SET NULL,
  originSegmentId TEXT REFERENCES segments(id) ON DELETE SET NULL,
  providerName TEXT,
  matchQuality TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (matchQuality IN ('unreviewed', 'machine', 'fuzzy', 'exact', 'human_approved')),
  useCount INTEGER NOT NULL DEFAULT 0,
  lastUsedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_project
  ON documents(projectId, createdAt);

CREATE INDEX IF NOT EXISTS idx_segments_document_position
  ON segments(documentId, position);

CREATE INDEX IF NOT EXISTS idx_segments_language_hash
  ON segments(sourceLanguage, targetLanguage, sourceTextHash);

CREATE INDEX IF NOT EXISTS idx_segments_language_normalized
  ON segments(sourceLanguage, targetLanguage, sourceTextNormalized);

CREATE INDEX IF NOT EXISTS idx_segment_tokens_segment
  ON segment_tokens(segmentId, tokenIndex);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_units_exact
  ON translation_units(sourceLanguage, targetLanguage, sourceTextHash, targetTextHash);

CREATE INDEX IF NOT EXISTS idx_translation_units_lookup
  ON translation_units(sourceLanguage, targetLanguage, sourceTextNormalized);

CREATE INDEX IF NOT EXISTS idx_translation_units_project_lookup
  ON translation_units(projectId, sourceLanguage, targetLanguage, sourceTextNormalized);

CREATE INDEX IF NOT EXISTS idx_translation_units_last_used
  ON translation_units(lastUsedAt);

CREATE TRIGGER IF NOT EXISTS trg_segments_updated_at
AFTER UPDATE ON segments
FOR EACH ROW
BEGIN
  UPDATE segments
  SET updatedAt = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_translation_units_updated_at
AFTER UPDATE ON translation_units
FOR EACH ROW
BEGIN
  UPDATE translation_units
  SET updatedAt = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
`;
