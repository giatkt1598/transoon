import type { TranslationMemoryTerm } from "../app/types";

export type TranslationMemoryTermDraft = {
  sourceTerm: string;
  targetTerm: string;
};

export type TranslationMemoryTransferFormat = "csv" | "tmx";

export type ParsedTranslationMemoryImport = {
  format: TranslationMemoryTransferFormat;
  items: TranslationMemoryTermDraft[];
};

export function detectTranslationMemoryTransferFormat(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();
  if (normalizedFileName.endsWith(".csv")) {
    return "csv" satisfies TranslationMemoryTransferFormat;
  }

  if (normalizedFileName.endsWith(".tmx")) {
    return "tmx" satisfies TranslationMemoryTransferFormat;
  }

  throw new Error("Only .csv and .tmx translation memory files are supported.");
}

export function parseTranslationMemoryImportFile(
  fileName: string,
  fileText: string,
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
): ParsedTranslationMemoryImport {
  const format = detectTranslationMemoryTransferFormat(fileName);

  if (format === "csv") {
    return {
      format,
      items: parseTranslationMemoryCsv(fileText),
    };
  }

  return {
    format,
    items: parseTranslationMemoryTmx(fileText, languages),
  };
}

export function buildTranslationMemoryExportFile(
  format: TranslationMemoryTransferFormat,
  items: TranslationMemoryTerm[],
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
) {
  const sanitizedItems = items
    .map((item): TranslationMemoryTermDraft | null => {
      const sourceTerm = item.sourceTerm.trim();
      const targetTerm = item.targetTerm.trim();
      if (!sourceTerm || !targetTerm) {
        return null;
      }

      return {
        sourceTerm,
        targetTerm,
      };
    })
    .filter((item): item is TranslationMemoryTermDraft => item !== null);

  if (format === "csv") {
    return {
      blob: new Blob([buildTranslationMemoryCsv(sanitizedItems)], {
        type: "text/csv;charset=utf-8",
      }),
      extension: "csv",
    };
  }

  return {
    blob: new Blob(
      [
        buildTranslationMemoryTmx(sanitizedItems, {
          sourceLanguageCode: languages.sourceLanguageCode,
          targetLanguageCode: languages.targetLanguageCode,
        }),
      ],
      { type: "application/xml;charset=utf-8" },
    ),
    extension: "tmx",
  };
}

function parseTranslationMemoryCsv(fileText: string) {
  const rows = parseCsvRows(fileText);
  if (rows.length === 0) {
    return [] as TranslationMemoryTermDraft[];
  }

  const [headerRow, ...dataRows] = rows;
  const normalizedHeaderRow = headerRow.map((cell) => cell.trim().toLowerCase());
  const sourceIndex = normalizedHeaderRow.findIndex((cell) => cell === "source");
  const targetIndex = normalizedHeaderRow.findIndex((cell) => cell === "target");

  if (sourceIndex < 0 || targetIndex < 0) {
    throw new Error("CSV translation memory import requires Source and Target columns.");
  }

  return dataRows
    .map((row): TranslationMemoryTermDraft | null => {
      const sourceTerm = (row[sourceIndex] ?? "").trim();
      const targetTerm = (row[targetIndex] ?? "").trim();
      if (!sourceTerm || !targetTerm) {
        return null;
      }

      return {
        sourceTerm,
        targetTerm,
      };
    })
    .filter((item): item is TranslationMemoryTermDraft => item !== null);
}

function buildTranslationMemoryCsv(items: TranslationMemoryTermDraft[]) {
  const rows = [["Source", "Target"], ...items.map((item) => [item.sourceTerm, item.targetTerm])];
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function parseTranslationMemoryTmx(
  fileText: string,
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
) {
  const parser = new DOMParser();
  const document = parser.parseFromString(fileText, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("The selected TMX file is not a valid XML document.");
  }

  const translationUnits = Array.from(document.getElementsByTagName("tu"));
  const items = translationUnits
    .map((translationUnit): TranslationMemoryTermDraft | null => {
      const translationVariants = Array.from(translationUnit.getElementsByTagName("tuv"));
      const sourceVariant = extractTmxSegment(translationVariants, languages.sourceLanguageCode);
      const targetVariant = extractTmxSegment(translationVariants, languages.targetLanguageCode);

      if (!sourceVariant || !targetVariant) {
        return null;
      }

      return {
        sourceTerm: sourceVariant,
        targetTerm: targetVariant,
      };
    })
    .filter((item): item is TranslationMemoryTermDraft => item !== null);

  if (translationUnits.length > 0 && items.length === 0) {
    throw new Error(
      "The selected TMX file does not contain the translation memory language pair configured for this memory.",
    );
  }

  return items;
}

function buildTranslationMemoryTmx(
  items: TranslationMemoryTermDraft[],
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
) {
  const xmlDocument = window.document.implementation.createDocument(null, "tmx", null);
  const tmxElement = xmlDocument.documentElement;
  tmxElement.setAttribute("version", "1.4");

  const headerElement = xmlDocument.createElement("header");
  headerElement.setAttribute("creationtool", "transoon");
  headerElement.setAttribute("creationtoolversion", "1.0");
  headerElement.setAttribute("segtype", "sentence");
  headerElement.setAttribute("adminlang", "en");
  headerElement.setAttribute("srclang", languages.sourceLanguageCode);
  headerElement.setAttribute("datatype", "PlainText");

  const bodyElement = xmlDocument.createElement("body");
  items.forEach((item) => {
    const translationUnitElement = xmlDocument.createElement("tu");
    translationUnitElement.appendChild(
      buildTmxTranslationVariant(xmlDocument, languages.sourceLanguageCode, item.sourceTerm),
    );
    translationUnitElement.appendChild(
      buildTmxTranslationVariant(xmlDocument, languages.targetLanguageCode, item.targetTerm),
    );
    bodyElement.appendChild(translationUnitElement);
  });

  tmxElement.appendChild(headerElement);
  tmxElement.appendChild(bodyElement);

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(xmlDocument)}`;
}

function buildTmxTranslationVariant(
  document: XMLDocument,
  languageCode: string,
  text: string,
) {
  const tuvElement = document.createElement("tuv");
  tuvElement.setAttribute("xml:lang", languageCode);
  const segmentElement = document.createElement("seg");
  segmentElement.textContent = text;
  tuvElement.appendChild(segmentElement);
  return tuvElement;
}

function extractTmxSegment(translationVariants: Element[], languageCode: string) {
  const matchingVariant = translationVariants.find(
    (translationVariant) =>
      normalizeLanguageCode(
        translationVariant.getAttribute("xml:lang") ??
          translationVariant.getAttribute("lang") ??
          "",
      ) === normalizeLanguageCode(languageCode),
  );

  const segmentText =
    matchingVariant?.getElementsByTagName("seg")[0]?.textContent?.trim() ?? "";
  return segmentText || null;
}

function parseCsvRows(fileText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let isInsideQuotes = false;

  for (let index = 0; index < fileText.length; index += 1) {
    const character = fileText[index] ?? "";
    const nextCharacter = fileText[index + 1] ?? "";

    if (character === '"') {
      if (isInsideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      isInsideQuotes = !isInsideQuotes;
      continue;
    }

    if (!isInsideQuotes && character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!isInsideQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function escapeCsvCell(value: string) {
  if (!/[",\r\n]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/gu, '""')}"`;
}

function normalizeLanguageCode(value: string) {
  return value.trim().toLowerCase();
}
