import { Box } from '@mui/material'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type TranslationsSplitPaneProps = {
  alignmentPane: ReactNode
  previewPane: ReactNode
}

const SPLIT_PANE_STORAGE_KEY = 'transoon.translationsSplit.leftPercent'
const DEFAULT_LEFT_PERCENT = 68
const MIN_LEFT_PERCENT = 30
const MAX_LEFT_PERCENT = 80

export function TranslationsSplitPane({
  alignmentPane,
  previewPane,
}: TranslationsSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [leftPercent, setLeftPercent] = useState(() => loadLeftPercent())
  const [isDragging, setIsDragging] = useState(false)

  const gridTemplateColumns = useMemo(
    () => `${leftPercent}% 14px minmax(0, ${100 - leftPercent}%)`,
    [leftPercent],
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(SPLIT_PANE_STORAGE_KEY, String(leftPercent))
    } catch {
      // ignore storage write failures
    }
  }, [leftPercent])

  useEffect(() => {
    if (!isDragging) {
      document.body.classList.remove('pane-resizing')
      return
    }

    document.body.classList.add('pane-resizing')

    return () => {
      document.body.classList.remove('pane-resizing')
    }
  }, [isDragging])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) {
      return
    }

    event.preventDefault()
    setIsDragging(true)

    const rect = container.getBoundingClientRect()

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100
      setLeftPercent(clamp(nextPercent, MIN_LEFT_PERCENT, MAX_LEFT_PERCENT))
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  return (
    <Box
      ref={containerRef}
      className={`translations-split-pane${isDragging ? ' dragging' : ''}`}
      style={{ gridTemplateColumns }}
    >
      <Box className="translations-split-pane-panel">{alignmentPane}</Box>
      <Box
        className="translations-split-pane-divider"
        onPointerDown={handlePointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize translation workspace"
      >
        <Box className="translations-split-pane-divider-line" />
      </Box>
      <Box className="translations-split-pane-panel">{previewPane}</Box>
    </Box>
  )
}

export function loadTranslationsSplitPanePercent() {
  return loadLeftPercent()
}

export function resetTranslationsSplitPanePercent() {
  try {
    window.localStorage.setItem(SPLIT_PANE_STORAGE_KEY, String(DEFAULT_LEFT_PERCENT))
  } catch {
    // ignore storage write failures
  }
}

function loadLeftPercent() {
  try {
    const storedValue = window.localStorage.getItem(SPLIT_PANE_STORAGE_KEY)
    if (!storedValue) {
      return DEFAULT_LEFT_PERCENT
    }

    const parsed = Number(storedValue)
    if (Number.isFinite(parsed)) {
      return clamp(parsed, MIN_LEFT_PERCENT, MAX_LEFT_PERCENT)
    }
  } catch {
    // ignore storage read failures
  }

  return DEFAULT_LEFT_PERCENT
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
