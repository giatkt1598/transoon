import { Box } from '@mui/material'
import { useEffect, useMemo, useRef } from 'react'
import type { ProjectDocumentPreview, ProjectSegment } from '../../app/types'

type DocxDocumentPreviewProps = {
  preview: Extract<ProjectDocumentPreview, { documentType: 'docx' }>
  segments: ProjectSegment[]
  activeSegmentExternalId: string | null
}

export function DocxDocumentPreview({
  preview,
  segments,
  activeSegmentExternalId,
}: DocxDocumentPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const renderedHtml = useMemo(() => preview.html, [preview.html])

  const renderedTextMap = useMemo(() => {
    return new Map(
      segments.map((segment) => [
        segment.externalSegmentId,
        segment.targetText.trim().length > 0 ? segment.targetText : segment.sourceText,
      ]),
    )
  }, [segments])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const candidateElements = collectBlockElements(container)
    preview.blocks.forEach((block, index) => {
      const element = candidateElements[index]
      if (!element) {
        return
      }

      element.setAttribute('data-preview-block-id', block.blockId)
      element.classList.add('docx-preview-html-block')
      if (block.kind === 'table-cell') {
        element.classList.add('docx-preview-html-table-cell')
      }

      renderPreviewBlock(element, block, renderedTextMap)
    })
  }, [preview.blocks, renderedHtml, renderedTextMap])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    container
      .querySelectorAll<HTMLElement>('[data-preview-segment-id]')
      .forEach((element) => element.classList.remove('active'))

    container
      .querySelectorAll<HTMLElement>('[data-preview-block-id]')
      .forEach((element) => element.classList.remove('active'))

    if (!activeSegmentExternalId) {
      return
    }

    const activeSegmentElement =
      Array.from(container.querySelectorAll<HTMLElement>('[data-preview-segment-id]')).find(
        (element) => element.dataset.previewSegmentId === activeSegmentExternalId,
      ) ?? null
    if (!activeSegmentElement) {
      return
    }

    activeSegmentElement.classList.add('active')
    activeSegmentElement
      .closest<HTMLElement>('[data-preview-block-id]')
      ?.classList.add('active')
    activeSegmentElement.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeSegmentExternalId, renderedHtml, preview.blocks, renderedTextMap])

  return (
    <Box className="document-preview-docx">
      <Box
        ref={containerRef}
        className="docx-preview-html-root"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </Box>
  )
}

function collectBlockElements(root: HTMLElement) {
  const blockElements: HTMLElement[] = []

  Array.from(root.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      return
    }

    const tagName = child.tagName
    if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
      blockElements.push(child)
      return
    }

    if (tagName === 'UL' || tagName === 'OL') {
      blockElements.push(
        ...Array.from(child.children).filter(
          (item): item is HTMLElement => item instanceof HTMLElement && item.tagName === 'LI',
        ),
      )
      return
    }

    if (tagName === 'TABLE') {
      blockElements.push(...collectTableBlockElements(child))
    }
  })

  return blockElements
}

function collectTableBlockElements(table: HTMLElement) {
  const cellParagraphs = Array.from(table.querySelectorAll('td > p, th > p')).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  )

  if (cellParagraphs.length > 0) {
    return cellParagraphs
  }

  return Array.from(table.querySelectorAll('td, th')).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  )
}

function renderPreviewBlock(
  element: HTMLElement,
  block: Extract<ProjectDocumentPreview, { documentType: 'docx' }>['blocks'][number],
  renderedTextMap: Map<string, string>,
) {
  if (block.segmentIds.length === 0) {
    return
  }

  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }

  if (block.prefixText) {
    element.appendChild(element.ownerDocument.createTextNode(block.prefixText))
  }

  block.segmentIds.forEach((segmentId, index) => {
    const segmentText = renderedTextMap.get(segmentId)
    if (segmentText !== undefined) {
      const span = element.ownerDocument.createElement('span')
      span.className = 'docx-preview-segment'
      span.setAttribute('data-preview-segment-id', segmentId)
      span.textContent = segmentText
      element.appendChild(span)
    }

    const separatorText = block.separatorTexts?.[index]
    if (separatorText) {
      element.appendChild(element.ownerDocument.createTextNode(separatorText))
    }
  })

  if (block.suffixText) {
    element.appendChild(element.ownerDocument.createTextNode(block.suffixText))
  }
}
