import type { DocumentHandler, ExtractedDocument } from "../document-types";
import {
  rebuildSegmentedText,
  segmentTextBlock,
  type SegmentedTextBlock,
  type TextBlockKind,
} from "../segmentation/text-segmentation";

type CsvCellPlan = {
  rowIndex: number;
  columnIndex: number;
  segmentedText: SegmentedTextBlock;
  segmentIds: string[];
  segmentTexts: string[];
};

type ParsedCsvDocument = {
  rows: string[][];
  delimiter: string;
  lineEnding: string;
  hasBom: boolean;
};

export class CsvDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".csv"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const parsedDocument = parseCsvDocument(buffer);
    const cellPlans: CsvCellPlan[] = [];
    let segmentCounter = 0;

    parsedDocument.rows.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (!cell.trim()) {
          return;
        }

        const segmentedText = segmentTextBlock(cell, classifyCsvCellText(cell));
        if (segmentedText.segmentTexts.length === 0) {
          return;
        }

        const segmentIds = segmentedText.segmentTexts.map(
          (_entry, innerIndex) =>
            `csv-r${rowIndex + 1}-c${columnIndex + 1}-s${segmentCounter + innerIndex + 1}`,
        );
        segmentCounter += segmentedText.segmentTexts.length;

        cellPlans.push({
          rowIndex,
          columnIndex,
          segmentedText,
          segmentIds,
          segmentTexts: segmentedText.segmentTexts,
        });
      });
    });

    return {
      documentType: "csv",
      fileName,
      segments: cellPlans.flatMap((cellPlan) =>
        cellPlan.segmentIds.map((segmentId, index) => ({
          id: segmentId,
          text: cellPlan.segmentTexts[index] ?? "",
        })),
      ),
      replaceSegments: async (nextSegments: string[]) => {
        const nextRows = parsedDocument.rows.map((row) => [...row]);
        let replacementIndex = 0;

        cellPlans.forEach((cellPlan) => {
          const replacementTexts = cellPlan.segmentTexts.map((segmentText) => {
            const replacement = nextSegments[replacementIndex] ?? segmentText;
            replacementIndex += 1;
            return replacement;
          });

          nextRows[cellPlan.rowIndex]![cellPlan.columnIndex] = rebuildSegmentedText(
            cellPlan.segmentedText,
            replacementTexts,
          );
        });

        const serializedCsv = serializeCsvDocument(
          nextRows,
          parsedDocument.delimiter,
          parsedDocument.lineEnding,
          parsedDocument.hasBom,
        );

        return Buffer.from(serializedCsv, "utf8");
      },
    };
  }
}

function parseCsvDocument(buffer: Buffer): ParsedCsvDocument {
  const hasBom =
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf;
  const rawText = buffer.toString("utf8");
  const text = hasBom ? rawText.replace(/^\uFEFF/u, "") : rawText;
  const delimiter = detectCsvDelimiter(text);
  const lineEnding = text.includes("\r\n") ? "\r\n" : "\n";
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let index = 0;
  let inQuotes = false;

  while (index < text.length) {
    const char = text[index]!;
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 2;
        continue;
      }

      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentCell);
      currentCell = "";
      index += 1;
      continue;
    }

    if (!inQuotes && char === "\r") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      index += nextChar === "\n" ? 2 : 1;
      continue;
    }

    if (!inQuotes && char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      index += 1;
      continue;
    }

    currentCell += char;
    index += 1;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return {
    rows,
    delimiter,
    lineEnding,
    hasBom,
  };
}

function serializeCsvDocument(
  rows: string[][],
  delimiter: string,
  lineEnding: string,
  hasBom: boolean,
) {
  const body = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter))
    .join(lineEnding);

  return hasBom ? `\uFEFF${body}` : body;
}

function escapeCsvCell(value: string, delimiter: string) {
  if (
    value.includes('"') ||
    value.includes(delimiter) ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function detectCsvDelimiter(text: string) {
  const sampleLines = text
    .split(/\r\n|\n|\r/u)
    .filter((line) => line.trim().length > 0)
    .slice(0, 5);
  const candidates = [",", ";", "\t"];
  let bestDelimiter = ",";
  let bestScore = -1;

  candidates.forEach((candidate) => {
    const score = sampleLines.reduce(
      (total, line) => total + countDelimiterOutsideQuotes(line, candidate),
      0,
    );

    if (score > bestScore) {
      bestDelimiter = candidate;
      bestScore = score;
    }
  });

  return bestDelimiter;
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let inQuotes = false;
  let count = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function classifyCsvCellText(value: string): TextBlockKind {
  const trimmedValue = value.trim();

  if (/^(?:[-*•]\s+|\d+[.)]\s+)/u.test(trimmedValue)) {
    return "list-item";
  }

  if (
    trimmedValue.length <= 100 &&
    !/[.!?;:]$/u.test(trimmedValue) &&
    (/^[A-Z0-9][A-Z0-9\s/&-]+$/u.test(trimmedValue) ||
      /^[A-Z][A-Za-z0-9\s/&-]{0,99}$/u.test(trimmedValue))
  ) {
    return "heading";
  }

  return "plain-text";
}
