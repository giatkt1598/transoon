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

  const renderedContributionMap = useMemo(() => {
    const nextRenderedContributionMap = new Map<string, PreviewTextContribution[]>()

    segments.forEach((segment) => {
      const segmentText =
        segment.targetText.trim().length > 0 ? segment.targetText : segment.sourceText
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
        nextRenderedContributionMap.set(previewExternalSegmentId, currentContributions)
      })
    })

    return nextRenderedContributionMap
  }, [segments])

  const renderedTextMap = useMemo(() => {
    const nextRenderedTextMap = new Map<string, string>()

    renderedContributionMap.forEach((contributions, previewExternalSegmentId) => {
      nextRenderedTextMap.set(
        previewExternalSegmentId,
        joinPreviewTextContributions(contributions),
      )
    })

    return nextRenderedTextMap
  }, [renderedContributionMap])

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

      renderPreviewBlock(element, block, renderedContributionMap)
    })
  }, [preview.blocks, renderedContributionMap, renderedHtml, renderedTextMap])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    container
      .querySelectorAll<HTMLElement>('[data-preview-contribution-owner]')
      .forEach((element) => element.classList.remove('active'))

    container
      .querySelectorAll<HTMLElement>('[data-preview-block-id]')
      .forEach((element) => element.classList.remove('active'))

    if (!activeSegmentExternalId) {
      return
    }

    const activeSegmentElements = Array.from(
      container.querySelectorAll<HTMLElement>('[data-preview-contribution-owner]'),
    ).filter((element) =>
      element.dataset.previewContributionOwner === activeSegmentExternalId,
    )
    if (activeSegmentElements.length === 0) {
      return
    }

    activeSegmentElements.forEach((activeSegmentElement) => {
      activeSegmentElement.classList.add('active')
      activeSegmentElement
        .closest<HTMLElement>('[data-preview-block-id]')
        ?.classList.add('active')
    })
    activeSegmentElements[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeSegmentExternalId, renderedContributionMap, renderedHtml, preview.blocks, renderedTextMap])

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
  renderedContributionMap: Map<string, PreviewTextContribution[]>,
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
    const contributions = renderedContributionMap.get(segmentId) ?? []
    appendPreviewContributionSpans(element, segmentId, contributions)

    const separatorText = block.separatorTexts?.[index]
    if (separatorText) {
      element.appendChild(element.ownerDocument.createTextNode(separatorText))
    }
  })

  if (block.suffixText) {
    element.appendChild(element.ownerDocument.createTextNode(block.suffixText))
  }
}

type PreviewTextContribution = {
  ownerExternalSegmentId: string
  text: string
}

function appendPreviewContributionSpans(
  element: HTMLElement,
  previewSegmentId: string,
  contributions: PreviewTextContribution[],
) {
  contributions.forEach((contribution, index) => {
    if (index > 0 && shouldInsertImplicitPreviewWhitespace(contributions[index - 1]?.text, contribution.text)) {
      element.appendChild(element.ownerDocument.createTextNode(' '))
    }

    const span = element.ownerDocument.createElement('span')
    span.className = 'docx-preview-segment'
    span.setAttribute('data-preview-segment-id', previewSegmentId)
    span.setAttribute('data-preview-contribution-owner', contribution.ownerExternalSegmentId)
    span.textContent = contribution.text
    element.appendChild(span)
  })
}

function shouldInsertImplicitPreviewWhitespace(
  leftText: string | undefined,
  rightText: string | undefined,
) {
  if (!leftText || !rightText) {
    return false
  }

  const trimmedLeftText = leftText.trim()
  const trimmedRightText = rightText.trim()
  if (!trimmedLeftText || !trimmedRightText) {
    return false
  }

  return /[\p{L}\p{N}]$/u.test(trimmedLeftText) && /^[\p{L}\p{N}]/u.test(trimmedRightText)
}

function joinPreviewSegmentTexts(leftText: string, rightText: string) {
  if (!leftText) {
    return rightText
  }

  if (!rightText) {
    return leftText
  }

  return shouldInsertImplicitPreviewWhitespace(leftText, rightText)
    ? `${leftText} ${rightText}`
    : `${leftText}${rightText}`
}

function joinPreviewTextContributions(contributions: PreviewTextContribution[]) {
  let nextText = ''

  contributions.forEach((contribution) => {
    nextText = joinPreviewSegmentTexts(nextText, contribution.text)
  })

  return nextText
}
