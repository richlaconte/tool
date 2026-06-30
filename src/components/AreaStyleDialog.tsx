import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { AreaState } from '../App'
import {
  filterStyleProperties,
  getBrowserCssProperties,
  getStylePropertyDefinitions,
  getStyleValueSuggestions,
  validateStyleDeclaration,
  type StylePropertyDefinition,
} from '../cssStyleCatalog'
import {
  resolveThemeColorTokens,
  type ThemeColorToken,
} from '../themeColors'

type AreaStyleDialogProps = {
  area: AreaState
  themeColors: ThemeColorToken[]
  onApplyStyle: (property: string, value: string) => void
  onRemoveStyle: (property: string) => void
  onClose: () => void
}

const AreaStyleDialog = ({
  area,
  themeColors,
  onApplyStyle,
  onRemoveStyle,
  onClose,
}: AreaStyleDialogProps) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedProperty, setSelectedProperty] = useState(
    getInitialSelectedProperty(area.styles)
  )
  const [highlightedPropertyIndex, setHighlightedPropertyIndex] =
    useState(0)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] =
    useState(0)
  const [valueInput, setValueInput] = useState(
    selectedProperty ? area.styles[selectedProperty] ?? '' : ''
  )
  const [validationMessage, setValidationMessage] = useState<
    string | null
  >(null)
  const activeStyles = useMemo(
    () =>
      Object.entries(area.styles).sort(([firstProperty], [secondProperty]) =>
        firstProperty.localeCompare(secondProperty)
      ),
    [area.styles]
  )
  const definitions = useMemo(
    () => getStylePropertyDefinitions(getBrowserCssProperties()),
    []
  )
  const filteredDefinitions = useMemo(
    () => filterStyleProperties(definitions, query),
    [definitions, query]
  )
  const selectedDefinition = useMemo(
    () =>
      definitions.find(
        (definition) => definition.property === selectedProperty
      ) ??
      (selectedProperty
        ? {
            property: selectedProperty,
          }
        : filteredDefinitions[0]),
    [definitions, filteredDefinitions, selectedProperty]
  )
  const suggestions = useMemo(
    () =>
      selectedDefinition
        ? getStyleValueSuggestions(selectedDefinition.property, {
            activeStyles: area.styles,
            themeColors,
          }).filter((suggestion) =>
            suggestion.value
              .toLowerCase()
              .includes(valueInput.trim().toLowerCase())
          )
        : [],
    [area.styles, selectedDefinition, themeColors, valueInput]
  )

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const selectProperty = (definition: StylePropertyDefinition) => {
    setSelectedProperty(definition.property)
    setValueInput(area.styles[definition.property] ?? '')
    setValidationMessage(null)
    setHighlightedSuggestionIndex(0)
  }

  const commitValue = (rawValue = valueInput) => {
    if (!selectedDefinition) return

    const result = validateStyleDeclaration(
      selectedDefinition.property,
      rawValue,
      (property, value) => {
        if (typeof CSS === 'undefined') return true

        return CSS.supports(
          property,
          resolveThemeColorTokens(value, themeColors)
        )
      }
    )

    if (!result.isValid) {
      setValidationMessage(result.message)
      return
    }

    onApplyStyle(
      selectedDefinition.property,
      resolveThemeColorTokens(result.value, themeColors)
    )
    setValueInput(result.value)
    setValidationMessage(null)
  }

  const highlightedSuggestion = suggestions[highlightedSuggestionIndex]

  return (
    <div
      className="command-dialog-backdrop area-style-dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        aria-label="Area styles"
        className="command-dialog area-style-dialog"
        role="dialog"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <div className="area-style-dialog-header">
          <h2>Area styles</h2>
          <button
            aria-label="Close Area styles"
            className="area-style-close-button"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <section className="area-style-section">
          <h3>Active styles</h3>
          {activeStyles.length > 0 ? (
            <div className="area-style-active-list">
              {activeStyles.map(([property, value]) => (
                <div className="area-style-active-row" key={property}>
                  <button
                    className="area-style-active-edit"
                    type="button"
                    onClick={() =>
                      selectProperty({
                        property,
                      })
                    }
                  >
                    <code>{property}</code>
                    <span>{value}</span>
                  </button>
                  <button
                    aria-label={`Remove ${property}`}
                    className="area-style-remove-button"
                    type="button"
                    onClick={() => onRemoveStyle(property)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p>No Area styles yet.</p>
          )}
        </section>

        <div className="area-style-main">
          <section className="area-style-section area-style-property-panel">
            <label className="page-style-control">
              <span>Property</span>
              <input
                ref={searchInputRef}
                aria-label="Search CSS properties"
                placeholder="Search CSS properties"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.currentTarget.value)
                  setHighlightedPropertyIndex(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlightedPropertyIndex((index) =>
                      Math.min(
                        index + 1,
                        Math.max(0, filteredDefinitions.length - 1)
                      )
                    )
                  }

                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHighlightedPropertyIndex((index) =>
                      Math.max(0, index - 1)
                    )
                  }

                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const definition =
                      filteredDefinitions[highlightedPropertyIndex]

                    if (definition) selectProperty(definition)
                  }
                }}
              />
            </label>
            <div
              className="area-style-property-list"
              role="listbox"
              aria-label="CSS properties"
            >
              {filteredDefinitions.slice(0, 80).map(
                (definition, index) => {
                  const isSelected =
                    definition.property ===
                    selectedDefinition?.property

                  return (
                    <button
                      aria-selected={isSelected}
                      className={`area-style-property-row${
                        isSelected
                          ? ' area-style-property-row--selected'
                          : ''
                      }${
                        index === highlightedPropertyIndex
                          ? ' area-style-property-row--highlighted'
                          : ''
                      }`}
                      key={definition.property}
                      role="option"
                      type="button"
                      onClick={() => selectProperty(definition)}
                    >
                      <span>
                        {definition.label ?? definition.property}
                      </span>
                      <code>{definition.property}</code>
                      {area.styles[definition.property] && (
                        <small>{area.styles[definition.property]}</small>
                      )}
                    </button>
                  )
                }
              )}
            </div>
          </section>

          <section className="area-style-section area-style-value-panel">
            {selectedDefinition ? (
              <>
                <div className="area-style-selected-property">
                  <span>
                    {selectedDefinition.label ??
                      selectedDefinition.property}
                  </span>
                  <code>{selectedDefinition.property}</code>
                </div>
                <label className="page-style-control">
                  <span>Value</span>
                  <input
                    aria-label={`Value for ${selectedDefinition.property}`}
                    placeholder="Type a CSS value"
                    type="text"
                    value={valueInput}
                    onChange={(e) => {
                      setValueInput(e.currentTarget.value)
                      setValidationMessage(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setHighlightedSuggestionIndex((index) =>
                          Math.min(
                            index + 1,
                            Math.max(0, suggestions.length - 1)
                          )
                        )
                      }

                      if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setHighlightedSuggestionIndex((index) =>
                          Math.max(0, index - 1)
                        )
                      }

                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitValue(
                          highlightedSuggestion?.value ?? valueInput
                        )
                      }
                    }}
                  />
                </label>
                {validationMessage && (
                  <p className="area-style-validation" role="alert">
                    {validationMessage}
                  </p>
                )}
                {suggestions.length > 0 && (
                  <div
                    className="area-style-suggestion-list"
                    role="listbox"
                    aria-label={`Suggested values for ${selectedDefinition.property}`}
                  >
                    {suggestions.map((suggestion, index) => (
                      <button
                        aria-selected={
                          index === highlightedSuggestionIndex
                        }
                        className={`area-style-suggestion${
                          index === highlightedSuggestionIndex
                            ? ' area-style-suggestion--highlighted'
                            : ''
                        }`}
                        key={`${suggestion.source}-${suggestion.value}`}
                        role="option"
                        type="button"
                        onClick={() => commitValue(suggestion.value)}
                      >
                        <span>{suggestion.label ?? suggestion.value}</span>
                        <code>{suggestion.value}</code>
                      </button>
                    ))}
                  </div>
                )}
                <div className="area-style-value-actions">
                  <button
                    className="area-style-apply-button"
                    type="button"
                    onClick={() => commitValue()}
                  >
                    Apply
                  </button>
                  {area.styles[selectedDefinition.property] && (
                    <button
                      className="area-style-remove-button"
                      type="button"
                      onClick={() =>
                        onRemoveStyle(selectedDefinition.property)
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>Select a property to edit its value.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}

const getInitialSelectedProperty = (styles: Record<string, string>) =>
  Object.keys(styles).sort()[0] ?? 'background-color'

export default AreaStyleDialog
