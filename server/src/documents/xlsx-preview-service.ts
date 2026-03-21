import { DOMParser } from "@xmldom/xmldom";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import path from "path";
import { Log } from "../logger";
import { rebuildSegmentedText } from "./segmentation/text-segmentation";
import {
  buildXlsxExtractionPlan,
  buildXlsxSegmentLookupKey,
  type XlsxExtractionPlan,
  type XlsxSegmentBlock,
} from "./xlsx-segmentation";

const WORKBOOK_PATH = "xl/workbook.xml";
const WORKBOOK_RELATIONSHIPS_PATH = "xl/_rels/workbook.xml.rels";
const SHARED_STRINGS_PATH = "xl/sharedStrings.xml";

const parser = new DOMParser();

type WorksheetEntry = {
  name: string;
  path: string;
};

type CellSegmentBinding = {
  segmentIds: string[];
  prefixText: string;
  separatorTexts: string[];
  suffixText: string;
  displayText: string;
};

type MergePreview = {
  isRoot: boolean;
  hidden: boolean;
  rowSpan: number;
  colSpan: number;
};

export type XlsxPreviewDocument = {
  documentType: "xlsx";
  fileName: string;
  sheets: XlsxPreviewSheet[];
};

export type XlsxPreviewSheet = {
  sheetId: string;
  name: string;
  columns: XlsxPreviewColumn[];
  rows: XlsxPreviewRow[];
};

export type XlsxPreviewColumn = {
  field: string;
  headerName: string;
  columnNumber: number;
  width: number;
};

export type XlsxPreviewRow = {
  rowId: string;
  rowNumber: number;
  height: number | null;
  cells: Record<string, XlsxPreviewCell>;
};

export type XlsxPreviewCell = {
  address: string;
  displayText: string;
  segmentIds: string[];
  prefixText: string;
  separatorTexts: string[];
  suffixText: string;
  style: XlsxPreviewCellStyle;
  merge: MergePreview;
};

export type XlsxPreviewCellStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number | null;
  fontColor: string | null;
  backgroundColor: string | null;
  horizontalAlign: string | null;
  verticalAlign: string | null;
  wrapText: boolean;
};

export async function buildXlsxPreviewDocument(
  fileName: string,
  buffer: Buffer,
): Promise<XlsxPreviewDocument> {
  const logger = Log.forContext({
    preview: "xlsx",
    fileName,
  });
  const zip = await JSZip.loadAsync(buffer);
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = Uint8Array.from(buffer).buffer;
  await workbook.xlsx.load(workbookBuffer);
  const extractionPlan = await buildXlsxExtractionPlan(zip, logger);
  const blockLookup = buildSegmentBlockLookup(extractionPlan);
  const sharedStringLookup = buildSharedStringLookup(extractionPlan);
  const worksheetEntries = await buildWorksheetEntries(zip);
  const sheets: XlsxPreviewSheet[] = [];

  for (const worksheetEntry of worksheetEntries) {
    const worksheet = workbook.getWorksheet(worksheetEntry.name);
    if (!worksheet) {
      continue;
    }

    const cellSegmentLookup = await buildWorksheetCellSegmentLookup(
      zip,
      worksheetEntry.path,
      blockLookup,
      sharedStringLookup,
    );

    sheets.push(buildPreviewSheet(worksheetEntry, worksheet, cellSegmentLookup));
  }

  return {
    documentType: "xlsx",
    fileName,
    sheets,
  };
}

function buildSegmentBlockLookup(plan: XlsxExtractionPlan) {
  return new Map(
    plan.blocks.map((block) => [
      buildXlsxSegmentLookupKey(block.entryType, block.entryName, block.itemIndex),
      block,
    ] as const),
  );
}

function buildSharedStringLookup(plan: XlsxExtractionPlan) {
  const lookup = new Map<number, XlsxSegmentBlock>();

  plan.blocks.forEach((block) => {
    if (
      block.entryType === "shared-string" &&
      block.entryName === SHARED_STRINGS_PATH
    ) {
      lookup.set(block.itemIndex, block);
    }
  });

  return lookup;
}

async function buildWorksheetEntries(zip: JSZip) {
  const workbookXml = await zip.file(WORKBOOK_PATH)?.async("text");
  const workbookRelationshipsXml = await zip
    .file(WORKBOOK_RELATIONSHIPS_PATH)
    ?.async("text");

  if (!workbookXml || !workbookRelationshipsXml) {
    throw new Error("The XLSX file is missing workbook metadata.");
  }

  const workbookDocument = parser.parseFromString(workbookXml, "text/xml");
  const relationshipsDocument = parser.parseFromString(
    workbookRelationshipsXml,
    "text/xml",
  );
  const relationshipTargetLookup = new Map<string, string>();

  findElementsByLocalName(relationshipsDocument, ["Relationship"]).forEach(
    (relationship) => {
      const relationshipId = relationship.getAttribute("Id");
      const target = relationship.getAttribute("Target");

      if (!relationshipId || !target) {
        return;
      }

      relationshipTargetLookup.set(
        relationshipId,
        normalizeRelationshipTarget(target),
      );
    },
  );

  return findElementsByLocalName(workbookDocument, ["sheet"])
    .map((sheet) => {
      const name = sheet.getAttribute("name");
      const relationshipId =
        sheet.getAttribute("r:id") ?? sheet.getAttribute("id");

      if (!name || !relationshipId) {
        return null;
      }

      const path = relationshipTargetLookup.get(relationshipId);
      if (!path) {
        return null;
      }

      return { name, path } satisfies WorksheetEntry;
    })
    .filter((entry): entry is WorksheetEntry => entry !== null);
}

async function buildWorksheetCellSegmentLookup(
  zip: JSZip,
  worksheetPath: string,
  blockLookup: Map<string, XlsxSegmentBlock>,
  sharedStringLookup: Map<number, XlsxSegmentBlock>,
) {
  const worksheetXml = await zip.file(worksheetPath)?.async("text");
  if (!worksheetXml) {
    return new Map<string, CellSegmentBinding>();
  }

  const worksheetDocument = parser.parseFromString(worksheetXml, "text/xml");
  const cellLookup = new Map<string, CellSegmentBinding>();
  let inlineStringIndex = 0;

  findElementsByLocalName(worksheetDocument, ["c"]).forEach((cellElement) => {
    const address = cellElement.getAttribute("r") ?? "";
    if (!address) {
      return;
    }

    if (findDirectChildByLocalName(cellElement, "is")) {
      const block = blockLookup.get(
        buildXlsxSegmentLookupKey(
          "inline-string",
          worksheetPath,
          inlineStringIndex,
        ),
      );
      inlineStringIndex += 1;

      if (block) {
        cellLookup.set(address, toCellSegmentBinding(block));
      }
      return;
    }

    if (cellElement.getAttribute("t") !== "s") {
      return;
    }

    const valueElement = findDirectChildByLocalName(cellElement, "v");
    const sharedStringIndex = Number(valueElement?.textContent ?? "");
    if (!Number.isInteger(sharedStringIndex)) {
      return;
    }

    const block = sharedStringLookup.get(sharedStringIndex);
    if (block) {
      cellLookup.set(address, toCellSegmentBinding(block));
    }
  });

  return cellLookup;
}

function buildPreviewSheet(
  worksheetEntry: WorksheetEntry,
  worksheet: ExcelJS.Worksheet,
  cellSegmentLookup: Map<string, CellSegmentBinding>,
): XlsxPreviewSheet {
  const mergeLookup = buildMergeLookup(worksheet);
  const rowNumbers = collectUsedRowNumbers(worksheet, mergeLookup);
  const columnNumbers = collectUsedColumnNumbers(worksheet, mergeLookup);

  return {
    sheetId: worksheetEntry.path,
    name: worksheet.name,
    columns: columnNumbers.map((columnNumber) => ({
      field: buildColumnField(columnNumber),
      headerName: columnNumberToLabel(columnNumber),
      columnNumber,
      width: getColumnWidthPixels(worksheet.getColumn(columnNumber).width),
    })),
    rows: rowNumbers.map((rowNumber) =>
      buildPreviewRow(
        worksheet,
        rowNumber,
        columnNumbers,
        mergeLookup,
        cellSegmentLookup,
      ),
    ),
  };
}

function buildPreviewRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumbers: number[],
  mergeLookup: Map<string, MergePreview>,
  cellSegmentLookup: Map<string, CellSegmentBinding>,
): XlsxPreviewRow {
  const row = worksheet.getRow(rowNumber);
  const cells: Record<string, XlsxPreviewCell> = {};

  columnNumbers.forEach((columnNumber) => {
    const address = `${columnNumberToLabel(columnNumber)}${rowNumber}`;
    const merge = mergeLookup.get(address) ?? {
      isRoot: true,
      hidden: false,
      rowSpan: 1,
      colSpan: 1,
    };
    const binding = cellSegmentLookup.get(address);
    const cell = row.getCell(columnNumber);
    const displayText = binding?.displayText ?? getCellDisplayText(cell);
    const hasMeaningfulContent =
      displayText.length > 0 || merge.hidden || merge.rowSpan > 1 || merge.colSpan > 1;

    if (!hasMeaningfulContent && !hasMeaningfulStyle(cell)) {
      return;
    }

    cells[buildColumnField(columnNumber)] = {
      address,
      displayText,
      segmentIds: binding?.segmentIds ?? [],
      prefixText: binding?.prefixText ?? "",
      separatorTexts: binding?.separatorTexts ?? [],
      suffixText: binding?.suffixText ?? "",
      style: serializeCellStyle(cell),
      merge,
    };
  });

  return {
    rowId: `${worksheet.id ?? worksheet.name}-${rowNumber}`,
    rowNumber,
    height: row.height ? getRowHeightPixels(row.height) : null,
    cells,
  };
}

function collectUsedRowNumbers(
  worksheet: ExcelJS.Worksheet,
  mergeLookup: Map<string, MergePreview>,
) {
  const rowNumbers = new Set<number>();

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, () => {
      rowNumbers.add(row.number);
    });
  });

  for (const [address, merge] of mergeLookup.entries()) {
    if (!merge.isRoot && !merge.hidden) {
      continue;
    }

    const rowNumber = getAddressRowNumber(address);
    if (rowNumber !== null) {
      rowNumbers.add(rowNumber);
    }
  }

  return [...rowNumbers].sort((left, right) => left - right);
}

function collectUsedColumnNumbers(
  worksheet: ExcelJS.Worksheet,
  mergeLookup: Map<string, MergePreview>,
) {
  const columnNumbers = new Set<number>();

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (_cell, columnNumber) => {
      columnNumbers.add(columnNumber);
    });
  });

  for (const address of mergeLookup.keys()) {
    const columnNumber = getAddressColumnNumber(address);
    if (columnNumber !== null) {
      columnNumbers.add(columnNumber);
    }
  }

  return [...columnNumbers].sort((left, right) => left - right);
}

function buildMergeLookup(worksheet: ExcelJS.Worksheet) {
  const lookup = new Map<string, MergePreview>();
  const merges = worksheet.model.merges ?? [];

  merges.forEach((mergeRange) => {
    const parsedRange = parseRange(mergeRange);
    if (!parsedRange) {
      return;
    }

    for (
      let rowNumber = parsedRange.startRow;
      rowNumber <= parsedRange.endRow;
      rowNumber += 1
    ) {
      for (
        let columnNumber = parsedRange.startColumn;
        columnNumber <= parsedRange.endColumn;
        columnNumber += 1
      ) {
        const address = `${columnNumberToLabel(columnNumber)}${rowNumber}`;
        const isRoot =
          rowNumber === parsedRange.startRow &&
          columnNumber === parsedRange.startColumn;

        lookup.set(address, {
          isRoot,
          hidden: !isRoot,
          rowSpan: parsedRange.endRow - parsedRange.startRow + 1,
          colSpan: parsedRange.endColumn - parsedRange.startColumn + 1,
        });
      }
    }
  });

  return lookup;
}

function toCellSegmentBinding(block: XlsxSegmentBlock): CellSegmentBinding {
  return {
    segmentIds: block.segmentIds,
    prefixText: block.segmentedText.prefixText,
    separatorTexts: block.segmentedText.separatorTexts,
    suffixText: block.segmentedText.suffixText,
    displayText: rebuildSegmentedText(block.segmentedText, block.segmentTexts),
  };
}

function getCellDisplayText(cell: ExcelJS.Cell) {
  if (typeof cell.text === "string" && cell.text.length > 0) {
    return cell.text;
  }

  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "object") {
    const richTextValue = value as { richText?: Array<{ text?: string }> };
    if (Array.isArray(richTextValue.richText)) {
      return richTextValue.richText.map((item) => item.text ?? "").join("");
    }

    const textValue = value as {
      text?: string;
      hyperlink?: string;
      result?: unknown;
      formula?: string;
    };
    if (typeof textValue.text === "string") {
      return textValue.text;
    }
    if (typeof textValue.result === "string" || typeof textValue.result === "number") {
      return String(textValue.result);
    }
    if (typeof textValue.hyperlink === "string") {
      return textValue.hyperlink;
    }
    if (typeof textValue.formula === "string") {
      return textValue.formula;
    }
  }

  return "";
}

function hasMeaningfulStyle(cell: ExcelJS.Cell) {
  const font = cell.font;
  const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
  const alignment = cell.alignment;

  return Boolean(
    font?.bold ||
      font?.italic ||
      font?.underline ||
      font?.size ||
      font?.color?.argb ||
      fill?.fgColor?.argb ||
      alignment?.horizontal ||
      alignment?.vertical ||
      alignment?.wrapText,
  );
}

function serializeCellStyle(cell: ExcelJS.Cell): XlsxPreviewCellStyle {
  const font = cell.font;
  const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;

  return {
    bold: Boolean(font?.bold),
    italic: Boolean(font?.italic),
    underline: Boolean(font?.underline),
    fontSize: typeof font?.size === "number" ? font.size : null,
    fontColor: toCssColor(font?.color?.argb),
    backgroundColor: toCssColor(fill?.fgColor?.argb),
    horizontalAlign: cell.alignment?.horizontal ?? null,
    verticalAlign: cell.alignment?.vertical ?? null,
    wrapText: Boolean(cell.alignment?.wrapText),
  };
}

function normalizeRelationshipTarget(target: string) {
  const normalizedTarget = target.replace(/^\/+/, "");
  if (normalizedTarget.startsWith("xl/")) {
    return path.posix.normalize(normalizedTarget);
  }

  return path.posix.normalize(path.posix.join("xl", normalizedTarget));
}

function findElementsByLocalName(root: Document | Element, localNames: string[]) {
  const lookup = new Set(localNames);
  const result: Element[] = [];
  const nodes =
    root.nodeType === root.DOCUMENT_NODE
      ? (root as Document).getElementsByTagName("*")
      : (root as Element).getElementsByTagName("*");

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (node && lookup.has(getLocalName(node))) {
      result.push(node);
    }
  }

  return result;
}

function findDirectChildByLocalName(element: Element, localName: string) {
  const children = element.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    const child = children.item(index);
    if (
      child?.nodeType === child.ELEMENT_NODE &&
      getLocalName(child as Element) === localName
    ) {
      return child as Element;
    }
  }

  return null;
}

function getLocalName(node: Element) {
  return node.localName ?? node.nodeName.split(":").pop() ?? node.nodeName;
}

function buildColumnField(columnNumber: number) {
  return `c${columnNumber}`;
}

function columnNumberToLabel(columnNumber: number) {
  let remainder = columnNumber;
  let label = "";

  while (remainder > 0) {
    const modulo = (remainder - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    remainder = Math.floor((remainder - modulo) / 26);
  }

  return label || "A";
}

function getAddressRowNumber(address: string) {
  const match = address.match(/\d+$/u);
  return match ? Number(match[0]) : null;
}

function getAddressColumnNumber(address: string) {
  const match = address.match(/^[A-Z]+/iu);
  if (!match) {
    return null;
  }

  return columnLabelToNumber(match[0].toUpperCase());
}

function columnLabelToNumber(label: string) {
  return Array.from(label).reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}

function parseRange(range: string) {
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/iu);
  if (!match) {
    return null;
  }

  return {
    startColumn: columnLabelToNumber(match[1].toUpperCase()),
    startRow: Number(match[2]),
    endColumn: columnLabelToNumber(match[3].toUpperCase()),
    endRow: Number(match[4]),
  };
}

function getColumnWidthPixels(width?: number) {
  if (!width) {
    return 96;
  }

  return Math.max(72, Math.round(width * 7 + 16));
}

function getRowHeightPixels(height: number) {
  return Math.max(28, Math.round(height * (96 / 72)));
}

function toCssColor(argb?: string | null) {
  if (!argb || !/^[A-Fa-f0-9]{8}$/u.test(argb)) {
    return null;
  }

  return `#${argb.slice(2)}`;
}
