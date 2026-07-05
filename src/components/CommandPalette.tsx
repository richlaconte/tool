import { useEffect, useMemo, useRef, useState } from 'react'

import {
  findExactCommandOption,
  getFilteredCommandOptions,
  getNextCommandOptionIndex,
} from '../commandPaletteLogic'

export type CommandPaletteScope = 'global' | 'page' | 'area'

export type CommandPaletteOption = {
  id: string
  title: string
  description: string
  aliases?: string[]
  scope?: CommandPaletteScope
  disabled?: boolean
  kind?: 'command' | 'area-search-result'
  matchField?: string
  status?: string
  areaId?: string
}

type CommandPaletteProps = {
  query: string
  options: CommandPaletteOption[]
  onQueryChange: (query: string) => void
  onOpenOption: (option: CommandPaletteOption) => void
  onClose: () => void
  onEscape?: () => boolean | void
  placeholder?: string
  shouldFilterOptions?: boolean
}

const CommandPalette = ({
  query,
  options,
  onQueryChange,
  onOpenOption,
  onClose,
  onEscape,
  placeholder = 'Search commands',
  shouldFilterOptions = true,
}: CommandPaletteProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const selectedOptionRefs = useRef(new Map<string, HTMLButtonElement>())
  const listId = 'command-palette-list'
  const filteredOptions = useMemo(
    () =>
      shouldFilterOptions
        ? getFilteredCommandOptions(options, query)
        : options,
    [options, query, shouldFilterOptions]
  )
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const exactOption = findExactCommandOption(
      filteredOptions,
      query
    )

    return exactOption ? filteredOptions.indexOf(exactOption) : 0
  })
  const visibleSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredOptions.length - 1)
  )
  const selectedOption = filteredOptions[visibleSelectedIndex]
  const selectedOptionId = selectedOption
    ? `command-palette-option-${selectedOption.id}`
    : undefined

  useEffect(() => {
    const previousActiveElement = document.activeElement

    previousActiveElementRef.current =
      previousActiveElement instanceof HTMLElement
        ? previousActiveElement
        : null

    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const selectedOption = filteredOptions[visibleSelectedIndex]

    if (!selectedOption) return

    selectedOptionRefs.current
      .get(selectedOption.id)
      ?.scrollIntoView({ block: 'nearest' })
  }, [filteredOptions, visibleSelectedIndex])

  const closeAndRestoreFocus = () => {
    const previousActiveElement = previousActiveElementRef.current

    onClose()

    requestAnimationFrame(() => {
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus()
      }
    })
  }

  const openSelectedOption = () => {
    const selectedOption = filteredOptions[visibleSelectedIndex]

    if (!selectedOption) {
      closeAndRestoreFocus()
      return
    }

    if (selectedOption.disabled) return

    onOpenOption(selectedOption)
  }

  return (
    <div
      className="command-palette-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closeAndRestoreFocus()
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          aria-activedescendant={selectedOptionId}
          aria-controls={listId}
          aria-expanded="true"
          className="command-palette-input"
          role="combobox"
          value={query}
          onChange={(e) => {
            const nextQuery = e.currentTarget.value
            const nextFilteredOptions = shouldFilterOptions
              ? getFilteredCommandOptions(options, nextQuery)
              : options
            const exactOption = findExactCommandOption(
              nextFilteredOptions,
              nextQuery
            )

            setSelectedIndex(
              exactOption
                ? nextFilteredOptions.indexOf(exactOption)
                : 0
            )
            onQueryChange(nextQuery)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              if (onEscape?.()) return

              closeAndRestoreFocus()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              openSelectedOption()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelectedIndex((currentIndex) =>
                getNextCommandOptionIndex(
                  Math.min(
                    currentIndex,
                    Math.max(0, filteredOptions.length - 1)
                  ),
                  1,
                  filteredOptions.length
                )
              )
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelectedIndex((currentIndex) =>
                getNextCommandOptionIndex(
                  Math.min(
                    currentIndex,
                    Math.max(0, filteredOptions.length - 1)
                  ),
                  -1,
                  filteredOptions.length
                )
              )
            }
          }}
          placeholder={placeholder}
        />

        <div
          aria-label="Commands"
          className="command-palette-list"
          id={listId}
          role="listbox"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, optionIndex) => (
              <button
                ref={(element) => {
                  if (element) {
                    selectedOptionRefs.current.set(option.id, element)
                  } else {
                    selectedOptionRefs.current.delete(option.id)
                  }
                }}
                className={`command-palette-option${
                  optionIndex === visibleSelectedIndex
                    ? ' command-palette-option--selected'
                    : ''
                }`}
                aria-selected={optionIndex === visibleSelectedIndex}
                id={`command-palette-option-${option.id}`}
                key={option.id}
                disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) onOpenOption(option)
                }}
                onPointerEnter={() => {
                  if (!option.disabled) setSelectedIndex(optionIndex)
                }}
                role="option"
                type="button"
              >
                <span>{option.title}</span>
                <small>
                  {option.matchField && (
                    <span className="command-palette-result-badge">
                      {option.matchField}
                    </span>
                  )}
                  {option.status && (
                    <span className="command-palette-result-status">
                      {option.status}
                    </span>
                  )}
                  {option.description}
                </small>
              </button>
            ))
          ) : (
            <div className="command-palette-empty">
              No commands found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
