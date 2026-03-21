import type { DocumentHandler, ExtractedDocument } from "../document-types";
import {
  rebuildSegmentedText,
  segmentTextBlock,
  type SegmentedTextBlock,
  type TextBlockKind,
} from "../segmentation/text-segmentation";

type TextFileBlockPlan = {
  segmentedText: SegmentedTextBlock;
  segmentIds: string[];
  segmentTexts: string[];
  separatorAfter: string;
};

export class TxtDocumentHandler implements DocumentHandler {
  readonly supportedExtensions = [".txt"];

  async extract(fileName: string, buffer: Buffer): Promise<ExtractedDocument> {
    const text = buffer.toString("utf8").replace(/\r\n?/g, "\n");
    const { blocks, leadingText } = buildTextFilePlan(text);

    return {
      documentType: "txt",
      fileName,
      segments: blocks.flatMap((block) =>
        block.segmentIds.map((segmentId, index) => ({
          id: segmentId,
          text: block.segmentTexts[index] ?? "",
        })),
      ),
      replaceSegments: async (nextSegments: string[]) => {
        let replacementIndex = 0;
        let nextText = leadingText;

        blocks.forEach((block) => {
          const replacementTexts = block.segmentTexts.map((segmentText) => {
            const replacement = nextSegments[replacementIndex] ?? segmentText;
            replacementIndex += 1;
            return replacement;
          });

          nextText += rebuildSegmentedText(block.segmentedText, replacementTexts);
          nextText += block.separatorAfter;
        });

        return Buffer.from(nextText, "utf8");
      },
    };
  }
}

function buildTextFilePlan(text: string) {
  const lines = text.split("\n");
  const blocks: TextFileBlockPlan[] = [];
  let leadingText = "";
  let segmentCounter = 0;

  lines.forEach((line, index) => {
    const separator = index < lines.length - 1 ? "\n" : "";

    if (line.trim().length === 0) {
      if (blocks.length === 0) {
        leadingText += line + separator;
      } else {
        blocks[blocks.length - 1]!.separatorAfter += line + separator;
      }

      return;
    }

    const blockKind = classifyTextLine(line);
    const segmentedText = segmentTextBlock(line, blockKind);

    if (segmentedText.segmentTexts.length === 0) {
      if (blocks.length === 0) {
        leadingText += line + separator;
      } else {
        blocks[blocks.length - 1]!.separatorAfter += line + separator;
      }

      return;
    }

    const segmentIds = segmentedText.segmentTexts.map(
      (_entry, innerIndex) => `txt-${segmentCounter + innerIndex + 1}`,
    );
    segmentCounter += segmentedText.segmentTexts.length;

    blocks.push({
      segmentedText,
      segmentIds,
      segmentTexts: segmentedText.segmentTexts,
      separatorAfter: separator,
    });
  });

  return { blocks, leadingText };
}

function classifyTextLine(line: string): TextBlockKind {
  const trimmedLine = line.trim();

  if (/^(?:[-*•]\s+|\d+[.)]\s+)/u.test(trimmedLine)) {
    return "list-item";
  }

  if (
    trimmedLine.length <= 100 &&
    !/[.!?;:]$/u.test(trimmedLine) &&
    (/^[A-Z0-9][A-Z0-9\s/&-]+$/u.test(trimmedLine) ||
      /^[A-Z][A-Za-z0-9\s/&-]{0,99}$/u.test(trimmedLine))
  ) {
    return "heading";
  }

  return "plain-text";
}
