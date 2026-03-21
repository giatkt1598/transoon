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
  const renderedHtml = useMemo(() => {
    const parser = new DOMParser()
    const document = parser.parseFromString(
      `<div class="docx-preview-html-root">${preview.html}</div>`,
      'text/html',
    )
    const root = document.body.firstElementChild as HTMLElement | null

    if (!root) {
      return preview.html
    }

    const candidateElements = collectBlockElements(root)
    preview.blocks.forEach((block, index) => {
      const element = candidateElements[index]
      if (!element) {
        return
      }

      element.setAttribute('data-preview-block-id', block.blockId)
      element.classList.add('docx-preview-html-block')
      if (block.kind === 'table') {
        element.classList.add('docx-preview-html-table')
      }
    })

    return root.innerHTML
  }, [preview.blocks, preview.html])

  const activeBlockId = useMemo(() => {
    if (!activeSegmentExternalId) {
      return null
    }

    return (
      preview.blocks.find((block) => block.segmentIds.includes(activeSegmentExternalId))
        ?.blockId ?? null
    )
  }, [activeSegmentExternalId, preview.blocks])

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

    container.querySelectorAll<HTMLElement>('[data-preview-block-id]').forEach((element) => {
      element.classList.remove('active')
    })

    if (!activeBlockId) {
      return
    }

    const activeElement = container.querySelector<HTMLElement>(`[data-preview-block-id="${activeBlockId}"]`)
    activeElement?.classList.add('active')
    activeElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeBlockId, renderedHtml])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    preview.blocks.forEach((block) => {
      const element = container.querySelector<HTMLElement>(`[data-preview-block-id="${block.blockId}"]`)
      if (!element || block.segmentIds.length === 0) {
        return
      }

      const replacementSegments = block.segmentIds
        .map((segmentId) => renderedTextMap.get(segmentId))
        .filter((text): text is string => typeof text === 'string')
      const replacementText = buildReplacementText(block, replacementSegments)

      if (!replacementText) {
        return
      }

      if (element.tagName === 'TABLE') {
        return
      }

      element.textContent = replacementText
    })
  }, [preview.blocks, renderedTextMap, renderedHtml])

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
    if (['P', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
      blockElements.push(child)
      return
    }

    if (tagName === 'UL' || tagName === 'OL') {
      blockElements.push(
        ...Array.from(child.children).filter(
          (item): item is HTMLElement => item instanceof HTMLElement && item.tagName === 'LI',
        ),
      )
    }
  })

  if (blockElements.length === 0) {
    blockElements.push(
      ...Array.from(
        root.querySelectorAll(':scope > p, :scope > table, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'),
      ).filter((item): item is HTMLElement => item instanceof HTMLElement),
    )
  }

  return blockElements
}

function buildReplacementText(
  block: Extract<ProjectDocumentPreview, { documentType: 'docx' }>['blocks'][number],
  replacementSegments: string[],
) {
  if (replacementSegments.length === 0) {
    return ''
  }

  let nextText = block.prefixText ?? ''

  replacementSegments.forEach((segmentText, index) => {
    nextText += segmentText
    nextText += block.separatorTexts?.[index] ?? ''
  })

  nextText += block.suffixText ?? ''
  return nextText
}
