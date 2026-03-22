import type {
  CellClassParams,
  CellStyle,
  ColDef,
  ColSpanParams,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowSpanParams,
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ProjectDocumentPreview,
  ProjectSegment,
  XlsxPreviewCell,
} from "../../app/types";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type XlsxDocumentPreviewProps = {
  preview: Extract<ProjectDocumentPreview, { documentType: "xlsx" }>;
  segments: ProjectSegment[];
  activeSegmentExternalId: string | null;
};

type XlsxGridRow = {
  __rowId: string;
  __rowNumber: number;
  __height: number | null;
  [field: string]: XlsxPreviewCell | string | number | null;
};

type PreviewTextContribution = {
  ownerExternalSegmentId: string;
  text: string;
};

const defaultColDef: ColDef<XlsxGridRow> = {
  sortable: false,
  resizable: false,
  editable: false,
  suppressMovable: true,
};

export function XlsxDocumentPreview({
  preview,
  segments,
  activeSegmentExternalId,
}: XlsxDocumentPreviewProps) {
  const [selectedSheetId, setSelectedSheetId] = useState(
    () => preview.sheets[0]?.sheetId ?? "",
  );
  const gridApiRef = useRef<GridApi<XlsxGridRow> | null>(null);

  const renderedContributionMap = useMemo(
    () => {
      const nextRenderedContributionMap = new Map<string, PreviewTextContribution[]>()

      segments.forEach((segment) => {
        const segmentText =
          segment.targetText.trim().length > 0
            ? segment.targetText
            : segment.sourceText
        const previewExternalSegmentIds =
          segment.previewExternalSegmentIds.length > 0
            ? segment.previewExternalSegmentIds
            : [segment.externalSegmentId]

        previewExternalSegmentIds.forEach((previewExternalSegmentId, index) => {
          const currentContributions =
            nextRenderedContributionMap.get(previewExternalSegmentId) ?? []
          const nextText = index === 0 ? segmentText : ''
          if (!nextText) {
            return
          }

          currentContributions.push({
            ownerExternalSegmentId: segment.externalSegmentId,
            text: nextText,
          })
          nextRenderedContributionMap.set(
            previewExternalSegmentId,
            currentContributions,
          )
        })
      })

      return nextRenderedContributionMap
    },
    [segments],
  );

  const renderedTextMap = useMemo(() => {
    const nextRenderedTextMap = new Map<string, string>();

    renderedContributionMap.forEach((contributions, previewExternalSegmentId) => {
      nextRenderedTextMap.set(
        previewExternalSegmentId,
        joinPreviewTextContributions(contributions),
      );
    });

    return nextRenderedTextMap;
  }, [renderedContributionMap]);

  const cellPositionLookup = useMemo(() => {
    const lookup = new Map<
      string,
      { sheetIndex: number; rowIndex: number; field: string }
    >();

    preview.sheets.forEach((sheet, sheetIndex) => {
      sheet.rows.forEach((row, rowIndex) => {
        Object.entries(row.cells).forEach(([field, cell]) => {
          cell.segmentIds.forEach((segmentId) => {
            if (!lookup.has(segmentId)) {
              lookup.set(segmentId, { sheetIndex, rowIndex, field });
            }
          });
        });
      });
    });

    return lookup;
  }, [preview.sheets]);

  const activePreviewSegmentIds = useMemo(
    () =>
      activeSegmentExternalId
        ? (segments
            .find((segment) => segment.externalSegmentId === activeSegmentExternalId)
            ?.previewExternalSegmentIds.filter(
              (previewExternalSegmentId) =>
                (renderedTextMap.get(previewExternalSegmentId) ?? "").length > 0,
            ) ?? [])
        : [],
    [activeSegmentExternalId, renderedTextMap, segments],
  );
  const activeCellPosition =
    activePreviewSegmentIds
      .map((previewExternalSegmentId) => cellPositionLookup.get(previewExternalSegmentId) ?? null)
      .find((position) => position !== null) ?? null;
  const activeSheetId = activeCellPosition
    ? (preview.sheets[activeCellPosition.sheetIndex]?.sheetId ?? null)
    : null;
  const resolvedSelectedSheetId =
    activeSheetId ??
    (preview.sheets.some((sheet) => sheet.sheetId === selectedSheetId)
      ? selectedSheetId
      : (preview.sheets[0]?.sheetId ?? ""));
  const selectedSheetIndex = Math.max(
    0,
    preview.sheets.findIndex(
      (sheet) => sheet.sheetId === resolvedSelectedSheetId,
    ),
  );
  const selectedSheet =
    preview.sheets[selectedSheetIndex] ?? preview.sheets[0] ?? null;

  const rowData = useMemo<XlsxGridRow[]>(
    () =>
      selectedSheet?.rows.map((row) => ({
        __rowId: row.rowId,
        __rowNumber: row.rowNumber,
        __height: row.height,
        ...row.cells,
      })) ?? [],
    [selectedSheet],
  );

  const columnDefs = useMemo<ColDef<XlsxGridRow>[]>(() => {
    if (!selectedSheet) {
      return [];
    }

    return [
      {
        headerName: "",
        field: "__rowNumber",
        pinned: "left",
        lockPinned: true,
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        cellClass: "xlsx-preview-row-number",
        headerClass: "xlsx-preview-corner-cell",
        cellRenderer: (params: ICellRendererParams<XlsxGridRow>) =>
          params.data?.__rowNumber ?? "",
      },
      ...selectedSheet.columns.map((column) => ({
        headerName: column.headerName,
        field: column.field,
        width: column.width,
        minWidth: Math.max(72, Math.min(column.width, 120)),
        cellClass: (params: CellClassParams<XlsxGridRow>) =>
          buildCellClasses(getPreviewCell(params.value)),
        cellStyle: (params: CellClassParams<XlsxGridRow>) =>
          buildCellContainerStyle(getPreviewCell(params.value)),
        cellRenderer: (params: ICellRendererParams<XlsxGridRow>) =>
          renderPreviewCell(
            params,
            renderedContributionMap,
            activeSegmentExternalId,
          ),
        colSpan: (params: ColSpanParams<XlsxGridRow>) => {
          const cell = getPreviewCell(params.data?.[column.field]);
          if (!cell || cell.merge.hidden) {
            return 1;
          }

          return cell.merge.colSpan;
        },
        rowSpan: (params: RowSpanParams<XlsxGridRow>) => {
          const cell = getPreviewCell(params.data?.[column.field]);
          if (!cell || cell.merge.hidden) {
            return 1;
          }

          return cell.merge.rowSpan;
        },
      })),
    ];
  }, [activeSegmentExternalId, renderedContributionMap, selectedSheet]);

  useEffect(() => {
    if (
      !activeCellPosition ||
      activeCellPosition.sheetIndex !== selectedSheetIndex
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      gridApiRef.current?.ensureIndexVisible(
        activeCellPosition.rowIndex,
        "middle",
      );
      gridApiRef.current?.ensureColumnVisible(activeCellPosition.field);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeCellPosition, selectedSheetIndex, rowData.length]);

  if (preview.sheets.length === 0 || !selectedSheet) {
    return (
      <Box className="document-preview-placeholder">
        <Typography component="p">
          This workbook does not contain any previewable worksheet content.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="document-preview-xlsx">
      <Box className="ag-theme-quartz xlsx-preview-grid">
        <AgGridReact<XlsxGridRow>
          key={selectedSheet.sheetId}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowBuffer={10}
          suppressCellFocus
          suppressContextMenu
          suppressRowClickSelection
          suppressMovableColumns
          suppressRowTransform
          animateRows={false}
          enableCellTextSelection
          ensureDomOrder
          getRowId={(params) => params.data.__rowId}
          getRowHeight={(params) => params.data?.__height ?? 32}
          headerHeight={34}
          onGridReady={(event: GridReadyEvent<XlsxGridRow>) => {
            gridApiRef.current = event.api;
          }}
        />
      </Box>

      <Box className="xlsx-preview-sheet-tabs">
        <Tabs
          value={selectedSheetIndex}
          onChange={(_event, nextValue) =>
            setSelectedSheetId(preview.sheets[nextValue]?.sheetId ?? "")
          }
          variant="scrollable"
          scrollButtons="auto"
        >
          {preview.sheets.map((sheet, index) => (
            <Tab key={sheet.sheetId} value={index} label={sheet.name} />
          ))}
        </Tabs>
      </Box>
    </Box>
  );
}

function getPreviewCell(value: unknown) {
  if (!value || typeof value !== "object" || !("displayText" in value)) {
    return null;
  }

  return value as XlsxPreviewCell;
}

function buildCellClasses(
  cell: XlsxPreviewCell | null,
) {
  if (!cell) {
    return "xlsx-preview-grid-cell";
  }

  return [
    "xlsx-preview-grid-cell",
    cell.merge.hidden ? "xlsx-preview-grid-cell-hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCellContainerStyle(
  cell: XlsxPreviewCell | null,
): CellStyle | undefined {
  if (!cell) {
    return undefined;
  }

  const style: CellStyle = {};

  if (cell.style.backgroundColor) {
    style.backgroundColor = cell.style.backgroundColor;
  }

  if (cell.merge.hidden) {
    style.visibility = "hidden";
  }

  return style;
}

function renderPreviewCell(
  params: ICellRendererParams<XlsxGridRow>,
  renderedContributionMap: Map<string, PreviewTextContribution[]>,
  activeSegmentExternalId: string | null,
) {
  const cell = getPreviewCell(params.value);
  if (!cell) {
    return null;
  }

  const text = buildRenderedCellText(cell, renderedContributionMap);

  return (
    <div
      className="xlsx-preview-cell-content"
      style={buildCellContentStyle(cell)}
      title={text}
    >
      {renderPreviewCellContent(cell, renderedContributionMap, activeSegmentExternalId)}
    </div>
  );
}

function buildRenderedCellText(
  cell: XlsxPreviewCell,
  renderedContributionMap: Map<string, PreviewTextContribution[]>,
) {
  if (cell.segmentIds.length === 0) {
    return cell.displayText;
  }

  let nextText = cell.prefixText;
  cell.segmentIds.forEach((segmentId, index) => {
    const segmentText = joinPreviewTextContributions(
      renderedContributionMap.get(segmentId) ?? [],
    );
    const separatorText = cell.separatorTexts[index] ?? "";
    const nextSegmentId = cell.segmentIds[index + 1];
    const nextSegmentText = nextSegmentId
      ? joinPreviewTextContributions(renderedContributionMap.get(nextSegmentId) ?? [])
      : "";

    nextText += segmentText;
    nextText += separatorText || (shouldInsertImplicitPreviewWhitespace(segmentText, nextSegmentText) ? " " : "");
  });

  nextText += cell.suffixText;
  return nextText;
}

function renderPreviewCellContent(
  cell: XlsxPreviewCell,
  renderedContributionMap: Map<string, PreviewTextContribution[]>,
  activeSegmentExternalId: string | null,
) {
  if (cell.segmentIds.length === 0) {
    return cell.displayText || "\u00A0";
  }

  const content: ReactNode[] = [];

  if (cell.prefixText) {
    content.push(cell.prefixText);
  }

  let previousRenderedText = cell.prefixText ?? "";
  cell.segmentIds.forEach((segmentId, segmentIndex) => {
    const contributions = renderedContributionMap.get(segmentId) ?? [];
    const segmentText = joinPreviewTextContributions(contributions);
    const shouldPrefixSegmentWithWhitespace =
      segmentText &&
      shouldInsertImplicitPreviewWhitespace(previousRenderedText, segmentText);

    contributions.forEach((contribution, contributionIndex) => {
      const contributionText =
        shouldPrefixSegmentWithWhitespace && contributionIndex === 0
          ? ` ${contribution.text}`
          : contribution.text;

      if (
        contributionIndex > 0 &&
        shouldInsertImplicitPreviewWhitespace(
          contributions[contributionIndex - 1]?.text ?? "",
          contribution.text,
        )
      ) {
        content.push("\u00A0");
      }

      content.push(
        <span
          key={`${segmentId}-${contribution.ownerExternalSegmentId}-${contributionIndex}`}
          className={[
            "xlsx-preview-text-contribution",
            activeSegmentExternalId === contribution.ownerExternalSegmentId ? "active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-preview-contribution-owner={contribution.ownerExternalSegmentId}
        >
          {contributionText}
        </span>,
      );
    });

    const separatorText = cell.separatorTexts[segmentIndex] ?? "";
    if (separatorText) {
      content.push(separatorText);
      previousRenderedText = separatorText;
      return;
    }

    previousRenderedText = segmentText;
  });

  if (cell.suffixText) {
    content.push(cell.suffixText);
  }

  return content.length > 0 ? content : "\u00A0";
}

function shouldInsertImplicitPreviewWhitespace(
  leftText: string,
  rightText: string,
) {
  const trimmedLeftText = leftText.trim();
  const trimmedRightText = rightText.trim();

  if (!trimmedLeftText || !trimmedRightText) {
    return false;
  }

  return /[\p{L}\p{N}]$/u.test(trimmedLeftText) && /^[\p{L}\p{N}]/u.test(trimmedRightText);
}

function joinPreviewSegmentTexts(leftText: string, rightText: string) {
  if (!leftText) {
    return rightText;
  }

  if (!rightText) {
    return leftText;
  }

  return shouldInsertImplicitPreviewWhitespace(leftText, rightText)
    ? `${leftText} ${rightText}`
    : `${leftText}${rightText}`;
}

function joinPreviewTextContributions(contributions: PreviewTextContribution[]) {
  let nextText = "";

  contributions.forEach((contribution) => {
    nextText = joinPreviewSegmentTexts(nextText, contribution.text);
  });

  return nextText;
}

function buildCellContentStyle(cell: XlsxPreviewCell) {
  return {
    fontWeight: cell.style.bold ? 700 : 400,
    fontStyle: cell.style.italic ? "italic" : "normal",
    textDecoration: cell.style.underline ? "underline" : "none",
    fontSize: cell.style.fontSize
      ? `${Math.max(11, Math.round(cell.style.fontSize))}px`
      : undefined,
    color: cell.style.fontColor ?? undefined,
    textAlign: mapHorizontalAlign(cell.style.horizontalAlign),
    justifyContent: mapHorizontalAlignToFlex(cell.style.horizontalAlign),
    alignItems: mapVerticalAlign(cell.style.verticalAlign),
    whiteSpace: cell.style.wrapText ? "pre-wrap" : "pre-wrap",
  } as const;
}

function mapHorizontalAlign(value: string | null) {
  switch (value) {
    case "center":
    case "left":
    case "right":
    case "justify":
      return value;
    default:
      return "left";
  }
}

function mapHorizontalAlignToFlex(value: string | null) {
  switch (value) {
    case "center":
      return "center";
    case "right":
      return "flex-end";
    case "justify":
      return "stretch";
    default:
      return "flex-start";
  }
}

function mapVerticalAlign(value: string | null) {
  switch (value) {
    case "middle":
    case "center":
      return "center";
    case "bottom":
      return "flex-end";
    default:
      return "flex-start";
  }
}
