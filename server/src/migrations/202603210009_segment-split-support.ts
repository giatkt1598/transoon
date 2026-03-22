import type { SqlMigrationDefinition } from "./migration";

export const segmentSplitSupportMigration: SqlMigrationDefinition = {
  id: "202603210009_SegmentSplitSupport",
  productVersion: "1.0.0",
  name: "Add segment split support",
  up: `
    ALTER TABLE segments
    ADD COLUMN splitGroupId TEXT NULL REFERENCES segments(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_segments_document_split_lookup
      ON segments(documentId, splitGroupId, position);
  `,
  down: `
    DROP INDEX IF EXISTS idx_segments_document_split_lookup;
  `,
};
