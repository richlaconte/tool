import type { ThemeColorToken } from './themeColors'

export type CssSupportChecker = (
  property: string,
  value: string
) => boolean

export type StylePropertyDefinition = {
  property: string
  label?: string
  category?: string
  aliases?: string[]
  description?: string
  suggestions?: string[]
}

export type StyleValueSuggestion = {
  value: string
  label?: string
  source: 'curated' | 'theme' | 'generic' | 'current'
}

export type StyleValidationResult =
  | {
      isValid: true
      value: string
    }
  | {
      isValid: false
      value: string
      message: string
    }

type StyleSuggestionContext = {
  activeStyles?: Record<string, string>
  themeColors?: ThemeColorToken[]
}

const BORDER_STYLE_PATTERN =
  /\b(?:none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)\b/i

const CURATED_PROPERTIES: StylePropertyDefinition[] = [
  {
    property: 'background',
    label: 'Background',
    category: 'Color',
    aliases: ['fill', 'surface'],
    suggestions: ['transparent', '#ffffff', '#f8fafc', 'none'],
  },
  {
    property: 'background-color',
    label: 'Background color',
    category: 'Color',
    aliases: ['fill color', 'area color'],
    suggestions: ['transparent', '#ffffff', '#f8fafc', '#111827'],
  },
  {
    property: 'border',
    label: 'Border',
    category: 'Shape',
    aliases: ['outline', 'stroke'],
    suggestions: [
      '1px solid currentColor',
      '1px solid #d1d5db',
      '2px dashed currentColor',
      'none',
    ],
  },
  {
    property: 'border-color',
    label: 'Border color',
    category: 'Color',
    aliases: ['outline color', 'stroke color'],
    suggestions: ['currentColor', '#d1d5db', '#111827'],
  },
  {
    property: 'border-radius',
    label: 'Corner radius',
    category: 'Shape',
    aliases: ['corner', 'corners', 'rounded', 'rounding'],
    suggestions: ['0', '4px', '8px', '12px', '999px'],
  },
  {
    property: 'box-shadow',
    label: 'Shadow',
    category: 'Effects',
    aliases: ['drop shadow', 'elevation'],
    suggestions: [
      '0 1px 2px rgba(0, 0, 0, 0.12)',
      '0 8px 24px rgba(0, 0, 0, 0.14)',
      'none',
    ],
  },
  {
    property: 'color',
    label: 'Text color',
    category: 'Color',
    aliases: ['text color', 'foreground'],
    suggestions: ['currentColor', '#111827', '#ffffff', '#64748b'],
  },
  {
    property: 'display',
    label: 'Display',
    category: 'Layout',
    aliases: ['layout mode'],
    suggestions: ['block', 'inline-block', 'flex', 'grid', 'none'],
  },
  {
    property: 'font-family',
    label: 'Font family',
    category: 'Typography',
    aliases: ['typeface', 'font'],
    suggestions: [
      'ui-sans-serif, system-ui, sans-serif',
      'ui-monospace, SFMono-Regular, Menlo, monospace',
      'serif',
    ],
  },
  {
    property: 'font-size',
    label: 'Text size',
    category: 'Typography',
    aliases: ['font size', 'type size'],
    suggestions: ['12px', '14px', '16px', '20px', '24px', '1rem'],
  },
  {
    property: 'font-style',
    label: 'Font style',
    category: 'Typography',
    aliases: ['italic'],
    suggestions: ['normal', 'italic'],
  },
  {
    property: 'font-weight',
    label: 'Font weight',
    category: 'Typography',
    aliases: ['bold', 'weight'],
    suggestions: ['400', '500', '600', '700'],
  },
  {
    property: 'gap',
    label: 'Gap',
    category: 'Spacing',
    aliases: ['space between', 'spacing'],
    suggestions: ['0', '4px', '8px', '12px', '16px', '24px'],
  },
  {
    property: 'height',
    label: 'Height',
    category: 'Size',
    aliases: ['tall', 'size'],
    suggestions: ['auto', '100%', '120px', '240px'],
  },
  {
    property: 'justify-content',
    label: 'Horizontal alignment',
    category: 'Layout',
    aliases: ['align horizontal', 'justify'],
    suggestions: ['flex-start', 'center', 'flex-end', 'space-between'],
  },
  {
    property: 'line-height',
    label: 'Line height',
    category: 'Typography',
    aliases: ['leading', 'text spacing'],
    suggestions: ['1', '1.2', '1.4', '1.6', '24px'],
  },
  {
    property: 'margin',
    label: 'Margin',
    category: 'Spacing',
    aliases: ['outside spacing'],
    suggestions: ['0', '4px', '8px', '12px', '16px', '24px'],
  },
  {
    property: 'opacity',
    label: 'Opacity',
    category: 'Effects',
    aliases: ['transparent', 'transparency'],
    suggestions: ['0', '0.25', '0.5', '0.75', '1'],
  },
  {
    property: 'padding',
    label: 'Padding',
    category: 'Spacing',
    aliases: ['inside spacing', 'inset'],
    suggestions: ['0', '4px', '8px', '12px', '16px', '24px'],
  },
  {
    property: 'text-align',
    label: 'Text alignment',
    category: 'Typography',
    aliases: ['align text'],
    suggestions: ['left', 'center', 'right', 'justify'],
  },
  {
    property: 'width',
    label: 'Width',
    category: 'Size',
    aliases: ['wide', 'size'],
    suggestions: ['auto', '100%', '160px', '320px'],
  },
]

const CURATED_PROPERTY_MAP = new Map(
  CURATED_PROPERTIES.map((definition) => [
    definition.property,
    definition,
  ])
)

const GENERIC_LENGTH_SUGGESTIONS = [
  '0',
  '4px',
  '8px',
  '12px',
  '16px',
  '24px',
  '1rem',
  '100%',
  'auto',
]

const camelToKebab = (property: string) =>
  property
    .replace(/^cssFloat$/, 'float')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/^ms-/, '-ms-')
    .toLowerCase()

const isVendorPrefixed = (property: string) =>
  /^-?(webkit|moz|ms|o)-/.test(property)

const isColorLikeProperty = (property: string) =>
  property.includes('color') ||
  property === 'background' ||
  property === 'border'

const isLengthLikeProperty = (property: string) =>
  /(?:width|height|margin|padding|gap|radius|size|top|right|bottom|left)$/.test(
    property
  )

const supportsCssDeclaration: CssSupportChecker = (
  property,
  value
) => {
  if (typeof CSS === 'undefined') return true

  return CSS.supports(property, value)
}

export const getBrowserCssProperties = (
  style: CSSStyleDeclaration | null | undefined =
    typeof document === 'undefined'
      ? undefined
      : document.createElement('div').style
) => {
  const properties = new Set<string>()

  if (!style) {
    for (const definition of CURATED_PROPERTIES) {
      properties.add(definition.property)
    }

    return Array.from(properties)
  }

  for (let index = 0; index < style.length; index += 1) {
    const rawProperty =
      typeof style.item === 'function'
        ? style.item(index)
        : (style[index] as string | undefined)

    if (!rawProperty) continue

    const property = rawProperty.startsWith('--')
      ? rawProperty
      : camelToKebab(rawProperty)

    if (property.startsWith('--') || isVendorPrefixed(property)) {
      continue
    }

    properties.add(property)
  }

  return Array.from(properties).sort()
}

export const getStylePropertyDefinitions = (
  properties: string[]
) => {
  const propertySet = new Set([
    ...CURATED_PROPERTIES.map((definition) => definition.property),
    ...properties,
  ])

  return Array.from(propertySet)
    .map((property) => ({
      property,
      ...(CURATED_PROPERTY_MAP.get(property) ?? {}),
    }))
    .sort((first, second) =>
      getDefinitionLabel(first).localeCompare(getDefinitionLabel(second))
    )
}

export const filterStyleProperties = (
  definitions: StylePropertyDefinition[],
  query: string
) => {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return definitions

  return definitions.filter((definition) => {
    const searchableText = [
      definition.property,
      definition.label,
      definition.category,
      definition.description,
      ...(definition.aliases ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return tokens.every((token) => searchableText.includes(token))
  })
}

export const getStyleValueSuggestions = (
  property: string,
  { activeStyles = {}, themeColors = [] }: StyleSuggestionContext = {}
) => {
  const suggestions: StyleValueSuggestion[] = []
  const currentValue = activeStyles[property]

  if (currentValue) {
    suggestions.push({
      value: currentValue,
      label: 'Current value',
      source: 'current',
    })
  }

  if (isColorLikeProperty(property)) {
    for (const color of themeColors) {
      suggestions.push({
        value: color.token,
        label: color.name,
        source: 'theme',
      })
    }
  }

  const curatedSuggestions =
    CURATED_PROPERTY_MAP.get(property)?.suggestions ?? []

  for (const value of curatedSuggestions) {
    suggestions.push({
      value,
      source: 'curated',
    })
  }

  if (isLengthLikeProperty(property)) {
    for (const value of GENERIC_LENGTH_SUGGESTIONS) {
      suggestions.push({
        value,
        source: 'generic',
      })
    }
  }

  return dedupeSuggestions(suggestions)
}

export const normalizeStyleValueInput = (value: string) =>
  value.trim().replace(/;\s*$/, '').trim()

export const validateStyleDeclaration = (
  property: string,
  value: string,
  supports: CssSupportChecker = supportsCssDeclaration
): StyleValidationResult => {
  const normalizedValue = normalizeStyleValueInput(value)

  if (!normalizedValue) {
    return {
      isValid: false,
      value: normalizedValue,
      message: 'Add a value before applying this style.',
    }
  }

  if (property === 'border' && !BORDER_STYLE_PATTERN.test(normalizedValue)) {
    return {
      isValid: false,
      value: normalizedValue,
      message: 'Border needs width, style, and color.',
    }
  }

  if (!supports(property, normalizedValue)) {
    return {
      isValid: false,
      value: normalizedValue,
      message: `That value is not valid for ${property}.`,
    }
  }

  return {
    isValid: true,
    value: normalizedValue,
  }
}

const getDefinitionLabel = (definition: StylePropertyDefinition) =>
  definition.label ?? definition.property

const dedupeSuggestions = (suggestions: StyleValueSuggestion[]) => {
  const seen = new Set<string>()
  const uniqueSuggestions: StyleValueSuggestion[] = []

  for (const suggestion of suggestions) {
    if (seen.has(suggestion.value)) continue

    seen.add(suggestion.value)
    uniqueSuggestions.push(suggestion)
  }

  return uniqueSuggestions
}
