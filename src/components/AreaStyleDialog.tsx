import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, RefObject } from 'react'

import type { AreaState } from '../App'
import {
  AREA_STYLE_GROUPS,
  getAreaStylePresetsByGroup,
  getAreaStylePropertyLabel,
  groupActiveAreaStyles,
  searchAreaStylePresets,
  type ActiveAreaStyleGroup,
  type AreaStyleGroup,
  type AreaStylePreset,
  type AreaStylePreview,
  type GroupedAreaStyle,
} from '../areaStylePresets'
import {
  filterStyleProperties,
  getBrowserCssProperties,
  getStylePropertyDefinitions,
  getStyleValueSuggestions,
  validateStyleDeclaration,
  type StylePropertyDefinition,
  type StyleValueSuggestion,
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

type AreaStylePanel = 'quick' | 'advanced'

const AreaStyleDialog = ({
  area,
  themeColors,
  onApplyStyle,
  onRemoveStyle,
  onClose,
}: AreaStyleDialogProps) => {
  const quickSearchInputRef = useRef<HTMLInputElement | null>(null)
  const advancedSearchInputRef = useRef<HTMLInputElement | null>(null)
  const [areaStylePanel, setAreaStylePanel] =
    useState<AreaStylePanel>('quick')
  const [quickQuery, setQuickQuery] = useState('')
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
  const activeStyleGroups = useMemo(
    () => groupActiveAreaStyles(area.styles),
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
  const filteredQuickPresets = useMemo(
    () => searchAreaStylePresets(quickQuery),
    [quickQuery]
  )
  const selectedDefinition = useMemo(
    () =>
      definitions.find(
        (definition) => definition.property === selectedProperty
      ) ??
      (selectedProperty
        ? {
            property: selectedProperty,
            label: getAreaStylePropertyLabel(selectedProperty),
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
    quickSearchInputRef.current?.focus()
  }, [])

  const selectProperty = (
    definition: Pick<StylePropertyDefinition, 'property'>,
    panel: AreaStylePanel = 'advanced'
  ) => {
    setSelectedProperty(definition.property)
    setValueInput(area.styles[definition.property] ?? '')
    setValidationMessage(null)
    setHighlightedSuggestionIndex(0)
    setAreaStylePanel(panel)

    if (panel === 'advanced') {
      requestAnimationFrame(() =>
        advancedSearchInputRef.current?.focus()
      )
    }
  }

  const applyDeclarations = (declarations: Record<string, string>) => {
    for (const [property, value] of Object.entries(declarations)) {
      onApplyStyle(property, resolveThemeColorTokens(value, themeColors))
    }
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
        aria-label="Style Area"
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
          <div>
            <h2>Style Area</h2>
            <span>Quick visual controls with CSS still one step away.</span>
          </div>
          <button
            aria-label="Close Area styles"
            className="area-style-close-button"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <AreaStyleActiveSummary
          groups={activeStyleGroups}
          onEdit={(style) =>
            selectProperty({
              property: style.property,
            })
          }
          onRemove={onRemoveStyle}
        />

        <div
          className="area-style-tabs"
          role="tablist"
          aria-label="Area style modes"
        >
          <button
            aria-selected={areaStylePanel === 'quick'}
            className={`area-style-tab${
              areaStylePanel === 'quick' ? ' area-style-tab--active' : ''
            }`}
            role="tab"
            type="button"
            onClick={() => {
              setAreaStylePanel('quick')
              requestAnimationFrame(() =>
                quickSearchInputRef.current?.focus()
              )
            }}
          >
            Quick styles
          </button>
          <button
            aria-selected={areaStylePanel === 'advanced'}
            className={`area-style-tab${
              areaStylePanel === 'advanced'
                ? ' area-style-tab--active'
                : ''
            }`}
            role="tab"
            type="button"
            onClick={() => {
              setAreaStylePanel('advanced')
              requestAnimationFrame(() =>
                advancedSearchInputRef.current?.focus()
              )
            }}
          >
            Advanced CSS
          </button>
        </div>

        {areaStylePanel === 'quick' ? (
          <AreaStyleQuickPanel
            filteredPresets={filteredQuickPresets}
            query={quickQuery}
            searchInputRef={quickSearchInputRef}
            themeColors={themeColors}
            onApplyDeclarations={applyDeclarations}
            onQueryChange={setQuickQuery}
          />
        ) : (
          <AreaStyleAdvancedPanel
            filteredDefinitions={filteredDefinitions}
            highlightedPropertyIndex={highlightedPropertyIndex}
            highlightedSuggestion={highlightedSuggestion}
            highlightedSuggestionIndex={highlightedSuggestionIndex}
            query={query}
            searchInputRef={advancedSearchInputRef}
            selectedDefinition={selectedDefinition}
            suggestions={suggestions}
            validationMessage={validationMessage}
            valueInput={valueInput}
            onCommitValue={commitValue}
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery)
              setHighlightedPropertyIndex(0)
            }}
            onRemoveStyle={onRemoveStyle}
            onSelectProperty={selectProperty}
            onSetHighlightedPropertyIndex={setHighlightedPropertyIndex}
            onSetHighlightedSuggestionIndex={setHighlightedSuggestionIndex}
            onSetValidationMessage={setValidationMessage}
            onSetValueInput={setValueInput}
            styles={area.styles}
          />
        )}
      </section>
    </div>
  )
}

const AreaStyleActiveSummary = ({
  groups,
  onEdit,
  onRemove,
}: {
  groups: ActiveAreaStyleGroup[]
  onEdit: (style: GroupedAreaStyle) => void
  onRemove: (property: string) => void
}) => {
  const activeGroups = groups.filter((group) => group.styles.length > 0)

  return (
    <section className="area-style-section area-style-active-summary">
      <h3>Active styles</h3>
      {activeGroups.length > 0 ? (
        <div className="area-style-active-groups">
          {activeGroups.map(({ group, styles }) => (
            <div className="area-style-active-group" key={group.id}>
              <span className="area-style-active-group-label">
                {group.label}
              </span>
              <div className="area-style-active-list">
                {styles.map((style) => (
                  <div
                    className="area-style-active-row"
                    key={style.property}
                  >
                    <button
                      className="area-style-active-edit"
                      type="button"
                      onClick={() => onEdit(style)}
                    >
                      <span>{style.label}</span>
                      <code>
                        {style.property}: {style.value}
                      </code>
                    </button>
                    <button
                      aria-label={`Remove ${style.property}`}
                      className="area-style-remove-button"
                      type="button"
                      onClick={() => onRemove(style.property)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No custom styles yet.</p>
      )}
    </section>
  )
}

const AreaStyleQuickPanel = ({
  filteredPresets,
  query,
  searchInputRef,
  themeColors,
  onApplyDeclarations,
  onQueryChange,
}: {
  filteredPresets: AreaStylePreset[]
  query: string
  searchInputRef: RefObject<HTMLInputElement | null>
  themeColors: ThemeColorToken[]
  onApplyDeclarations: (declarations: Record<string, string>) => void
  onQueryChange: (query: string) => void
}) => {
  const filteredPresetIds = new Set(
    filteredPresets.map((preset) => preset.id)
  )

  return (
    <section className="area-style-panel area-style-quick-panel">
      <label className="page-style-control area-style-search-control">
        <span>Find a quick style</span>
        <input
          ref={searchInputRef}
          aria-label="Search quick Area styles"
          placeholder="Try border, round, text, shadow"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
        />
      </label>

      <div className="area-style-quick-groups">
        {AREA_STYLE_GROUPS.filter((group) => group.id !== 'other').map(
          (group) => {
            const presets = getAreaStylePresetsByGroup(group.id).filter(
              (preset) => query.trim() === '' || filteredPresetIds.has(preset.id)
            )
            const shouldShowThemeSwatches =
              group.id === 'fill' &&
              themeColors.length > 0 &&
              query.trim() === ''

            if (presets.length === 0 && !shouldShowThemeSwatches) {
              return null
            }

            return (
              <QuickStyleGroup
                group={group}
                key={group.id}
                presets={presets}
                themeColors={
                  shouldShowThemeSwatches ? themeColors : []
                }
                onApplyDeclarations={onApplyDeclarations}
              />
            )
          }
        )}
      </div>
    </section>
  )
}

const QuickStyleGroup = ({
  group,
  presets,
  themeColors,
  onApplyDeclarations,
}: {
  group: AreaStyleGroup
  presets: AreaStylePreset[]
  themeColors: ThemeColorToken[]
  onApplyDeclarations: (declarations: Record<string, string>) => void
}) => (
  <section className="area-style-quick-group">
    <div className="area-style-quick-group-header">
      <h3>{group.label}</h3>
      <span>{group.description}</span>
    </div>
    <div className="area-style-preset-grid">
      {themeColors.map((color) => (
        <button
          className="area-style-preset"
          key={color.id}
          title={`background-color: ${color.token}`}
          type="button"
          onClick={() =>
            onApplyDeclarations({
              'background-color': color.token,
            })
          }
        >
          <span
            className="area-style-preset-preview"
            style={getPresetPreviewStyle({
              kind: 'swatch',
              value: color.value,
            })}
          />
          <span>{color.name}</span>
          <code>{color.token}</code>
        </button>
      ))}
      {presets.map((preset) => (
        <button
          className="area-style-preset"
          key={preset.id}
          title={getDeclarationSummary(preset.declarations)}
          type="button"
          onClick={() => onApplyDeclarations(preset.declarations)}
        >
          <span
            className="area-style-preset-preview"
            style={getPresetPreviewStyle(preset.preview)}
          />
          <span>{preset.label}</span>
          <code>{getDeclarationSummary(preset.declarations)}</code>
        </button>
      ))}
    </div>
  </section>
)

const AreaStyleAdvancedPanel = ({
  filteredDefinitions,
  highlightedPropertyIndex,
  highlightedSuggestion,
  highlightedSuggestionIndex,
  query,
  searchInputRef,
  selectedDefinition,
  suggestions,
  styles,
  validationMessage,
  valueInput,
  onCommitValue,
  onQueryChange,
  onRemoveStyle,
  onSelectProperty,
  onSetHighlightedPropertyIndex,
  onSetHighlightedSuggestionIndex,
  onSetValidationMessage,
  onSetValueInput,
}: {
  filteredDefinitions: StylePropertyDefinition[]
  highlightedPropertyIndex: number
  highlightedSuggestion?: StyleValueSuggestion
  highlightedSuggestionIndex: number
  query: string
  searchInputRef: RefObject<HTMLInputElement | null>
  selectedDefinition?: StylePropertyDefinition
  suggestions: StyleValueSuggestion[]
  styles: Record<string, string>
  validationMessage: string | null
  valueInput: string
  onCommitValue: (rawValue?: string) => void
  onQueryChange: (query: string) => void
  onRemoveStyle: (property: string) => void
  onSelectProperty: (
    definition: Pick<StylePropertyDefinition, 'property'>,
    panel?: AreaStylePanel
  ) => void
  onSetHighlightedPropertyIndex: (
    updater: (index: number) => number
  ) => void
  onSetHighlightedSuggestionIndex: (
    updater: (index: number) => number
  ) => void
  onSetValidationMessage: (message: string | null) => void
  onSetValueInput: (value: string) => void
}) => (
  <section className="area-style-panel area-style-advanced-panel">
    <div className="area-style-main">
      <section className="area-style-section area-style-property-panel">
        <label className="page-style-control">
          <span>Property</span>
          <input
            ref={searchInputRef}
            aria-controls="area-style-property-list"
            aria-expanded="true"
            aria-label="Search CSS properties"
            placeholder="Search CSS properties"
            role="combobox"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                onSetHighlightedPropertyIndex((index) =>
                  Math.min(
                    index + 1,
                    Math.max(0, filteredDefinitions.length - 1)
                  )
                )
              }

              if (e.key === 'ArrowUp') {
                e.preventDefault()
                onSetHighlightedPropertyIndex((index) =>
                  Math.max(0, index - 1)
                )
              }

              if (e.key === 'Enter') {
                e.preventDefault()
                const definition =
                  filteredDefinitions[highlightedPropertyIndex]

                if (definition) onSelectProperty(definition)
              }
            }}
          />
        </label>
        <div
          className="area-style-property-list"
          id="area-style-property-list"
          role="listbox"
          aria-label="CSS properties"
        >
          {filteredDefinitions.slice(0, 80).map(
            (definition, index) => {
              const isSelected =
                definition.property === selectedDefinition?.property

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
                  onClick={() => onSelectProperty(definition)}
                >
                  <span>{definition.label ?? definition.property}</span>
                  <code>{definition.property}</code>
                  {styles[definition.property] && (
                    <small>{styles[definition.property]}</small>
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
                {selectedDefinition.label ?? selectedDefinition.property}
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
                  onSetValueInput(e.currentTarget.value)
                  onSetValidationMessage(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    onSetHighlightedSuggestionIndex((index) =>
                      Math.min(
                        index + 1,
                        Math.max(0, suggestions.length - 1)
                      )
                    )
                  }

                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    onSetHighlightedSuggestionIndex((index) =>
                      Math.max(0, index - 1)
                    )
                  }

                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onCommitValue(
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
                    aria-selected={index === highlightedSuggestionIndex}
                    className={`area-style-suggestion${
                      index === highlightedSuggestionIndex
                        ? ' area-style-suggestion--highlighted'
                        : ''
                    }`}
                    key={`${suggestion.source}-${suggestion.value}`}
                    role="option"
                    type="button"
                    onClick={() => onCommitValue(suggestion.value)}
                  >
                    <span
                      className="area-style-suggestion-preview"
                      style={getPresetPreviewStyle(
                        getSuggestionPreview(
                          selectedDefinition.property,
                          suggestion.value
                        )
                      )}
                    />
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
                onClick={() => onCommitValue()}
              >
                Apply
              </button>
              {styles[selectedDefinition.property] && (
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
)

const getPresetPreviewStyle = (
  preview?: AreaStylePreview
): CSSProperties => {
  if (!preview) return {}

  if (preview.kind === 'swatch') {
    return preview.value === 'transparent'
      ? {
          backgroundImage:
            'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
          backgroundSize: '12px 12px',
        }
      : {
          backgroundColor: preview.value,
        }
  }

  if (preview.kind === 'border') {
    return {
      border: preview.value === 'none' ? '1px solid transparent' : preview.value,
    }
  }

  if (preview.kind === 'radius') {
    return {
      borderRadius: preview.value,
    }
  }

  if (preview.kind === 'shadow') {
    return {
      boxShadow: preview.value === 'none' ? 'none' : preview.value,
    }
  }

  if (preview.kind === 'text') {
    if (preview.value.endsWith('px') || preview.value.endsWith('rem')) {
      return {
        fontSize: preview.value,
      }
    }

    if (/^\d+$/.test(preview.value)) {
      return {
        fontWeight: preview.value,
      }
    }

    return {
      color: preview.value,
    }
  }

  return {}
}

const getSuggestionPreview = (
  property: string,
  value: string
): AreaStylePreview | undefined => {
  if (
    property === 'color' ||
    property.includes('color') ||
    property === 'background'
  ) {
    return {
      kind: 'swatch',
      value,
    }
  }

  if (property === 'border' || property.startsWith('border-')) {
    if (property === 'border-radius') {
      return {
        kind: 'radius',
        value,
      }
    }

    return {
      kind: 'border',
      value,
    }
  }

  if (property === 'box-shadow') {
    return {
      kind: 'shadow',
      value,
    }
  }

  if (property.startsWith('font-') || property === 'text-align') {
    return {
      kind: 'text',
      value,
    }
  }

  return undefined
}

const getDeclarationSummary = (declarations: Record<string, string>) =>
  Object.entries(declarations)
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')

const getInitialSelectedProperty = (styles: Record<string, string>) =>
  Object.keys(styles).sort()[0] ?? 'background-color'

export default AreaStyleDialog
