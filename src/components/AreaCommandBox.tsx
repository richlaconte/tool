import { useEffect, useMemo, useRef, useState } from 'react'

import {
  getCommandBoxPlacement,
  getCommandBoxSuggestions,
  parseCommandBoxDraft,
} from '../areaCommandBox'
import { getNextCommandOptionIndex } from '../commandPaletteLogic'
import type { CssSupportChecker } from '../cssSlashCommand'

type AreaCommandBoxProps = {
  anchorAreaId: string
  draft: string
  targetCount: number
  targetLabel: string
  supportsDeclaration: CssSupportChecker
  onDraftChange: (draft: string) => void
  onCommit: (property: string, value: string) => void
  onClose: (committed: boolean) => void
}

const LIST_ID = 'area-command-box-list'

const AreaCommandBox = ({
  anchorAreaId,
  draft,
  targetCount,
  targetLabel,
  supportsDeclaration,
  onDraftChange,
  onCommit,
  onClose,
}: AreaCommandBoxProps) => {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] =
    useState(0)
  const [showCommitError, setShowCommitError] = useState(false)

  const suggestions = useMemo(
    () => getCommandBoxSuggestions(draft),
    [draft]
  )
  const suggestionsVisible = suggestions.length > 0
  const visibleSuggestionIndex = Math.min(
    selectedSuggestionIndex,
    Math.max(0, suggestions.length - 1)
  )
  const selectedSuggestion = suggestions[visibleSuggestionIndex]
  const parsed = useMemo(
    () => parseCommandBoxDraft(draft, supportsDeclaration),
    [draft, supportsDeclaration]
  )

  // Anchor tracking: recompute every frame so the box follows the Area
  // through pan, zoom, move, and resize without drifting or jumping.
  useEffect(() => {
    let frame = 0

    const trackAnchor = () => {
      const box = boxRef.current
      const anchor = document.querySelector(
        `[data-area-id="${anchorAreaId}"]`
      )

      if (box && anchor instanceof HTMLElement) {
        const anchorRect = anchor.getBoundingClientRect()
        const boxRect = box.getBoundingClientRect()
        const placement = getCommandBoxPlacement({
          anchorRect,
          boxHeight: boxRect.height,
          boxWidth: boxRect.width,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        })

        box.style.top = `${placement.top}px`
        box.style.left = `${placement.left}px`
        box.dataset.placement = placement.side
      }

      frame = requestAnimationFrame(trackAnchor)
    }

    frame = requestAnimationFrame(trackAnchor)

    return () => cancelAnimationFrame(frame)
  }, [anchorAreaId])

  useEffect(() => {
    const previousActiveElement = document.activeElement

    previousActiveElementRef.current =
      previousActiveElement instanceof HTMLElement
        ? previousActiveElement
        : null

    inputRef.current?.focus()

    return () => {
      const element = previousActiveElementRef.current

      if (element?.isConnected) {
        element.focus()
      }
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        boxRef.current &&
        e.target instanceof Node &&
        !boxRef.current.contains(e.target)
      ) {
        onClose(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onClose])

  // Reset transient UI state when the draft changes — adjusted during
  // render per the React docs "previous props" pattern, not an effect.
  const [lastDraft, setLastDraft] = useState(draft)

  if (draft !== lastDraft) {
    setLastDraft(draft)
    setShowCommitError(false)
    setSelectedSuggestionIndex(0)
  }

  const applySuggestion = (property: string) => {
    onDraftChange(`${property}: `)

    requestAnimationFrame(() => {
      const input = inputRef.current

      if (input) {
        input.focus()
        input.setSelectionRange(input.value.length, input.value.length)
      }
    })
  }

  const commitDraft = () => {
    if (parsed?.declarationIsValid) {
      onCommit(parsed.property, parsed.value)
      return
    }

    if (suggestionsVisible && selectedSuggestion) {
      applySuggestion(selectedSuggestion.property)
      return
    }

    setShowCommitError(true)
  }

  const getStatusLine = () => {
    if (!parsed) {
      return `No command matches “/${draft.trim()}”`
    }

    if (!parsed.propertyIsValid) {
      return `Unknown property “${parsed.property}”`
    }

    if (!parsed.declarationIsValid) {
      return parsed.value.length === 0
        ? `Add a value, e.g. ${parsed.property}: …`
        : `“${parsed.value}” is not a valid ${parsed.property} value`
    }

    return `✓ ${parsed.property}: ${parsed.value}`
  }

  const statusIsValid = Boolean(parsed?.declarationIsValid)

  return (
    <div
      aria-label="Area command"
      className="area-command-box"
      data-anchor-area-id={anchorAreaId}
      ref={boxRef}
      role="dialog"
    >
      <div className="area-command-box-input-row">
        <span aria-hidden="true" className="area-command-box-slash">
          /
        </span>
        <input
          aria-activedescendant={
            suggestionsVisible && selectedSuggestion
              ? `area-command-box-option-${selectedSuggestion.id}`
              : undefined
          }
          aria-controls={LIST_ID}
          aria-expanded={suggestionsVisible}
          aria-invalid={showCommitError || undefined}
          aria-label="CSS style command"
          autoComplete="off"
          className="area-command-box-input"
          ref={inputRef}
          role="combobox"
          spellCheck={false}
          value={draft}
          onChange={(e) => onDraftChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onClose(false)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            } else if (
              suggestionsVisible &&
              (e.key === 'ArrowDown' || e.key === 'ArrowUp')
            ) {
              e.preventDefault()
              setSelectedSuggestionIndex((currentIndex) =>
                getNextCommandOptionIndex(
                  Math.min(
                    currentIndex,
                    Math.max(0, suggestions.length - 1)
                  ),
                  e.key === 'ArrowDown' ? 1 : -1,
                  suggestions.length
                )
              )
            }
          }}
          placeholder="border: 1px solid red"
        />
        <span className="area-command-box-target">
          {targetCount > 1 ? `${targetCount} areas` : targetLabel}
        </span>
      </div>

      {suggestionsVisible ? (
        <div
          aria-label="Command suggestions"
          className="area-command-box-list"
          id={LIST_ID}
          role="listbox"
        >
          {suggestions.map((suggestion, suggestionIndex) => (
            <button
              aria-selected={suggestionIndex === visibleSuggestionIndex}
              className={`area-command-box-option${
                suggestionIndex === visibleSuggestionIndex
                  ? ' area-command-box-option--selected'
                  : ''
              }`}
              id={`area-command-box-option-${suggestion.id}`}
              key={suggestion.id}
              role="option"
              type="button"
              onClick={() => applySuggestion(suggestion.property)}
              onPointerEnter={() =>
                setSelectedSuggestionIndex(suggestionIndex)
              }
            >
              <span>{suggestion.property}</span>
              <small>{suggestion.description}</small>
            </button>
          ))}
        </div>
      ) : (
        <div
          aria-live="polite"
          className={`area-command-box-status${
            statusIsValid
              ? ' area-command-box-status--valid'
              : ' area-command-box-status--invalid'
          }`}
        >
          {getStatusLine()}
        </div>
      )}

      <div className="area-command-box-hints">
        {targetCount > 1
          ? `Applies to ${targetCount} selected areas · `
          : ''}
        ⏎ Apply · esc Cancel
      </div>
    </div>
  )
}

export default AreaCommandBox
