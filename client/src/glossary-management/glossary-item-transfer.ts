import type { GlossaryItem } from "../app/types";
import type { GlossaryItemDraft } from "./types";

export type GlossaryTransferFormat = "csv" | "tbx";

export type ParsedGlossaryImport = {
  format: GlossaryTransferFormat;
  items: GlossaryItemDraft[];
};

export function detectGlossaryTransferFormat(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();
  if (normalizedFileName.endsWith(".csv")) {
    return "csv" satisfies GlossaryTransferFormat;
  }

  if (normalizedFileName.endsWith(".tbx")) {
    return "tbx" satisfies GlossaryTransferFormat;
  }

  throw new Error("Only .csv and .tbx glossary files are supported.");
}

export function parseGlossaryImportFile(
  fileName: string,
  fileText: string,
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
): ParsedGlossaryImport {
  const format = detectGlossaryTransferFormat(fileName);

  if (format === "csv") {
    const items = parseGlossaryCsv(fileText);
    return {
      format,
      items,
    };
  }

  const items = parseGlossaryTbx(fileText, languages);
  return {
    format,
    items,
  };
}

export function buildGlossaryExportFile(
  format: GlossaryTransferFormat,
  items: GlossaryItem[],
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
) {
  const sanitizedItems = items
    .map((item): GlossaryItemDraft | null => {
      const source = item.source.trim();
      const target = item.target.trim();
      if (!source || !target) {
        return null;
      }

      return {
        source,
        target,
        caseSensitive: item.caseSensitive,
        wholeWord: true,
        priority: 1,
      };
    })
    .filter((item): item is GlossaryItemDraft => item !== null);

  if (format === "csv") {
    return {
      blob: new Blob([buildGlossaryCsv(sanitizedItems)], {
        type: "text/csv;charset=utf-8",
      }),
      extension: "csv",
    };
  }

  return {
    blob: new Blob(
      [
        buildGlossaryTbx(sanitizedItems, {
          sourceLanguageCode: languages.sourceLanguageCode,
          targetLanguageCode: languages.targetLanguageCode,
        }),
      ],
      { type: "application/xml;charset=utf-8" },
    ),
    extension: "tbx",
  };
}

function parseGlossaryCsv(fileText: string) {
  const rows = parseCsvRows(fileText);
  if (rows.length === 0) {
    return [] as GlossaryItemDraft[];
  }

  const [headerRow, ...dataRows] = rows;
  const headerIndexes = buildCsvHeaderIndexes(headerRow);
  if (headerIndexes.source < 0 || headerIndexes.target < 0) {
    throw new Error(
      "CSV glossary import requires at least Source and Target columns.",
    );
  }

  return dataRows
    .map((row): GlossaryItemDraft | null => {
      const source = (row[headerIndexes.source] ?? "").trim();
      const target = (row[headerIndexes.target] ?? "").trim();
      if (!source || !target) {
        return null;
      }

      return {
        source,
        target,
        caseSensitive: parseBooleanLikeValue(
          row[headerIndexes.caseSensitive] ?? "",
          false,
        ),
        wholeWord: true,
        priority: 1,
      };
    })
    .filter((item): item is GlossaryItemDraft => item !== null);
}

function buildGlossaryCsv(items: GlossaryItemDraft[]) {
  const headerRow = ["Source", "Target", "Case sensitive"];
  const dataRows = items.map((item) => [
    item.source,
    item.target,
    item.caseSensitive ? "true" : "false",
  ]);

  return [headerRow, ...dataRows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

function parseGlossaryTbx(
  fileText: string,
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
) {
  const parser = new DOMParser();
  const document = parser.parseFromString(fileText, "application/xml");
  const parserErrors = document.getElementsByTagName("parsererror");
  if (parserErrors.length > 0) {
    throw new Error("The selected TBX file is not a valid XML document.");
  }

  const termEntries = Array.from(document.getElementsByTagName("termEntry"));
  const items = termEntries
    .map((termEntry): GlossaryItemDraft | null => {
      const langSets = Array.from(termEntry.getElementsByTagName("langSet"));
      const sourceTerm = extractTbxTerm(
        langSets,
        languages.sourceLanguageCode,
      );
      const targetTerm = extractTbxTerm(
        langSets,
        languages.targetLanguageCode,
      );

      if (!sourceTerm || !targetTerm) {
        return null;
      }

      return {
        source: sourceTerm.term,
        target: targetTerm.term,
        caseSensitive: sourceTerm.caseSensitive,
        wholeWord: true,
        priority: 1,
      };
    })
    .filter((item): item is GlossaryItemDraft => item !== null);

  if (termEntries.length > 0 && items.length === 0) {
    throw new Error(
      "The selected TBX file does not contain the glossary language pair configured for this glossary.",
    );
  }

  return items;
}

function buildGlossaryTbx(
  items: GlossaryItemDraft[],
  languages: {
    sourceLanguageCode: string;
    targetLanguageCode: string;
  },
) {
  const xmlSerializer = new XMLSerializer();
  const xmlDocument = window.document.implementation.createDocument(null, "tbx", null);
  const tbxElement = xmlDocument.documentElement;
  tbxElement.setAttribute("xmlns", "urn:iso:std:iso:30042:ed-2");
  tbxElement.setAttribute("style", "dca");

  const textElement = xmlDocument.createElement("text");
  const bodyElement = xmlDocument.createElement("body");

  items.forEach((item, index) => {
    const termEntryElement = xmlDocument.createElement("termEntry");
    termEntryElement.setAttribute("id", `term-${index + 1}`);

    const sourceLangSet = xmlDocument.createElement("langSet");
    sourceLangSet.setAttribute("xml:lang", languages.sourceLanguageCode);
    sourceLangSet.appendChild(
      buildTbxTermNode(xmlDocument, item.source, item.caseSensitive),
    );

    const targetLangSet = xmlDocument.createElement("langSet");
    targetLangSet.setAttribute("xml:lang", languages.targetLanguageCode);
    targetLangSet.appendChild(
      buildTbxTermNode(xmlDocument, item.target, item.caseSensitive),
    );

    termEntryElement.appendChild(sourceLangSet);
    termEntryElement.appendChild(targetLangSet);
    bodyElement.appendChild(termEntryElement);
  });

  textElement.appendChild(bodyElement);
  tbxElement.appendChild(textElement);

  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlSerializer.serializeToString(xmlDocument)}`;
}

function buildTbxTermNode(
  document: XMLDocument,
  term: string,
  caseSensitive: boolean,
) {
  const tigElement = document.createElement("tig");
  const termElement = document.createElement("term");
  termElement.textContent = term;

  const noteElement = document.createElement("termNote");
  noteElement.setAttribute("type", "caseSensitive");
  noteElement.textContent = caseSensitive ? "true" : "false";

  tigElement.appendChild(termElement);
  tigElement.appendChild(noteElement);
  return tigElement;
}

function extractTbxTerm(langSets: Element[], languageCode: string) {
  const matchingLangSet = langSets.find((langSet) =>
    normalizeLanguageCode(
      langSet.getAttribute("xml:lang") ??
        langSet.getAttribute("lang") ??
        "",
    ) === normalizeLanguageCode(languageCode),
  );

  if (!matchingLangSet) {
    return null;
  }

  const termElement =
    matchingLangSet.getElementsByTagName("term")[0] ?? null;
  if (!termElement?.textContent?.trim()) {
    return null;
  }

  const termNotes = Array.from(
    matchingLangSet.getElementsByTagName("termNote"),
  );
  const caseSensitiveNote = termNotes.find(
    (termNote) =>
      (termNote.getAttribute("type") ?? "").toLowerCase() === "casesensitive",
  );

  return {
    term: termElement.textContent.trim(),
    caseSensitive: parseBooleanLikeValue(
      caseSensitiveNote?.textContent ?? "",
      false,
    ),
  };
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

function buildCsvHeaderIndexes(headerRow: string[]) {
  const normalizedHeaderRow = headerRow.map((cell) =>
    cell.trim().toLowerCase(),
  );

  return {
    source: normalizedHeaderRow.findIndex((cell) => cell === "source"),
    target: normalizedHeaderRow.findIndex((cell) => cell === "target"),
    caseSensitive: normalizedHeaderRow.findIndex(
      (cell) => cell === "casesensitive" || cell === "case sensitive",
    ),
  };
}

function escapeCsvCell(value: string) {
  if (!/[",\r\n]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/gu, '""')}"`;
}

function parseBooleanLikeValue(value: string, fallbackValue: boolean) {
  const normalizedValue = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalizedValue)) {
    return false;
  }

  return fallbackValue;
}

function normalizeLanguageCode(value: string) {
  return value.trim().toLowerCase();
}
