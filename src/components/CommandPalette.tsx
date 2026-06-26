import { useEffect, useMemo, useRef, useState } from 'react'

import {
  findExactCommandOption,
  getFilteredCommandOptions,
  getNextCommandOptionIndex,
} from '../commandPaletteLogic'

export type CommandPaletteOption = {
  id: string
  title: string
  description: string
}

type CommandPaletteProps = {
  query: string
  options: CommandPaletteOption[]
  onQueryChange: (query: string) => void
  onOpenOption: (option: CommandPaletteOption) => void
  onClose: () => void
}

const CommandPalette = ({
  query,
  options,
  onQueryChange,
  onOpenOption,
  onClose,
}: CommandPaletteProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedOptionRefs = useRef(new Map<string, HTMLButtonElement>())
  const filteredOptions = useMemo(
    () => getFilteredCommandOptions(options, query),
    [options, query]
  )
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const exactOption = findExactCommandOption(
      filteredOptions,
      query
    )

    return exactOption ? filteredOptions.indexOf(exactOption) : 0
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const selectedOption = filteredOptions[selectedIndex]

    if (!selectedOption) return

    selectedOptionRefs.current
      .get(selectedOption.id)
      ?.scrollIntoView({ block: 'nearest' })
  }, [filteredOptions, selectedIndex])

  const openSelectedOption = () => {
    const selectedOption = filteredOptions[selectedIndex]

    if (!selectedOption) {
      onClose()
      return
    }

    onOpenOption(selectedOption)
  }

  return (
    <div
      className="command-palette-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          value={query}
          onChange={(e) => {
            const nextQuery = e.currentTarget.value
            const nextFilteredOptions = getFilteredCommandOptions(
              options,
              nextQuery
            )
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
              onClose()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              openSelectedOption()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelectedIndex((currentIndex) =>
                getNextCommandOptionIndex(
                  currentIndex,
                  1,
                  filteredOptions.length
                )
              )
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelectedIndex((currentIndex) =>
                getNextCommandOptionIndex(
                  currentIndex,
                  -1,
                  filteredOptions.length
                )
              )
            }
          }}
          placeholder="Search commands"
        />

        <div className="command-palette-list">
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
                  optionIndex === selectedIndex
                    ? ' command-palette-option--selected'
                    : ''
                }`}
                key={option.id}
                onClick={() => onOpenOption(option)}
                type="button"
              >
                <span>{option.title}</span>
                <small>{option.description}</small>
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
