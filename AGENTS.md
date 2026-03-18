# agents.md — Translation Pipeline for AI Coding Agent

## Overview

This document defines the full translation workflow for an AI coding agent.
The goal is to translate documents (Word, PDF, Excel, text) while preserving formatting, ensuring consistency, and supporting reuse of previously translated phrases.

---

## Core Principles

1. **Deterministic pipeline over ad-hoc calls**
2. **Preserve original structure and formatting**
3. **Reuse previous translations whenever possible**
4. **Process text in chunks to avoid context overflow**
5. **Be resilient to partial failures (retry-safe)**

---

## High-Level Flow

```
Input File
   ↓
Parse → Extract Structure
   ↓
Chunking
   ↓
Cache Lookup (Phrase Memory)
   ↓
Translate (LLM / Model)
   ↓
Post-process / Normalize
   ↓
Merge Back to Original Structure
   ↓
Output File
```

---

## Module Responsibilities

### 1. File Parser

**Input:** File (PDF, DOCX, XLSX, TXT)
**Output:** Structured representation

Responsibilities:

- Extract text while preserving structure (paragraphs, tables, runs)
- Assign unique IDs to each segment
- Keep formatting metadata (bold, italic, line breaks, table cells)

Example output:

```json
[
  {
    "id": "p1",
    "type": "paragraph",
    "text": "こんにちは世界",
    "style": { "bold": false }
  }
]
```

---

### 2. Chunking Engine

**Goal:** Split text into manageable pieces for translation.

Rules:

- Max tokens per chunk (e.g., 300–800 tokens)
- Keep semantic boundaries (sentence/paragraph)
- Avoid splitting inside:
  - sentences
  - table cells
  - inline formatting

Output:

```json
[
  {
    "chunkId": "c1",
    "text": "..."
  }
]
```

---

### 3. Phrase Memory (Cache Layer)

**Storage:**

- SQLite or JSON

**Purpose:**

- Ensure consistency
- Reduce cost and latency

Lookup priority:

1. Exact match
2. Normalized match (trim, lowercase)
3. Fuzzy match (optional with embeddings)

Example:

```json
{
  "こんにちは": "Hello",
  "世界": "World"
}
```

---

### 4. Translation Engine

**Input:** Chunk
**Output:** Translated chunk

Supports:

- Local models (e.g., Ollama)
- Remote APIs

Prompt template:

```
Translate the following text to English.
Keep formatting and meaning consistent.

Text:
{{chunk}}
```

Rules:

- No hallucination
- Preserve placeholders
- Keep line breaks

---

### 5. Post-Processing

Tasks:

- Normalize whitespace
- Restore placeholders
- Apply consistent terminology
- Fix obvious formatting issues

Optional:

- Run validation checks
- Compare length ratios

---

### 6. Merge Engine

**Goal:** Rebuild original document

Steps:

1. Map translated chunks back to original segments
2. Restore formatting (bold, tables, layout)
3. Ensure ordering is preserved

---

### 7. Output Writer

Export formats:

- DOCX
- PDF
- XLSX
- TXT

Requirements:

- Maintain original layout as much as possible
- Preserve metadata (styles, tables)

---

## Error Handling Strategy

- Each chunk is independently retryable
- Failed chunks are logged and retried
- Partial output is allowed

Log format:

```json
{
  "chunkId": "c3",
  "error": "timeout",
  "retryCount": 2
}
```

---

## Performance Optimization

- Parallel chunk processing (configurable concurrency)
- Cache-first strategy (avoid duplicate translations)
- Streaming translation (if supported)

---

## Optional Enhancements

### Embedding Matching

- Use vector similarity to find near-duplicate sentences
- Improves reuse beyond exact matches

### Glossary Enforcement

- Define fixed translations for key terms
- Override model output if needed

### Incremental Translation

- Only process changed content
- Useful for large documents

---

## Minimal API Interface (Optional)

```
POST /translate
{
  "file": <binary>,
  "sourceLang": "ja",
  "targetLang": "en"
}
```

Response:

```
{
  "status": "completed",
  "downloadUrl": "..."
}
```

---

## Agent Execution Summary

1. Parse file → structured nodes
2. Split into chunks
3. Check cache for each chunk
4. Translate missing chunks
5. Post-process results
6. Merge into original structure
7. Export final file

---

## Notes for AI Coding Agent

- Do NOT translate blindly → always check cache first
- Do NOT break formatting boundaries
- Always keep mapping between original and translated segments
- Prefer deterministic logic over “smart guessing”
- Log every step for debugging

---

## End of Document
