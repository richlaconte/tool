export type AreaStyleGroupId =
  | 'fill'
  | 'text'
  | 'border'
  | 'corners'
  | 'shadow'
  | 'spacing'
  | 'size'
  | 'layout'
  | 'other'

export type AreaStylePreview =
  | {
      kind: 'swatch'
      value: string
    }
  | {
      kind: 'border'
      value: string
    }
  | {
      kind: 'radius'
      value: string
    }
  | {
      kind: 'shadow'
      value: string
    }
  | {
      kind: 'text'
      value: string
    }

export type AreaStyleGroup = {
  id: AreaStyleGroupId
  label: string
  description: string
}

export type AreaStylePreset = {
  id: string
  groupId: AreaStyleGroupId
  label: string
  description?: string
  declarations: Record<string, string>
  aliases?: string[]
  preview?: AreaStylePreview
}

export type GroupedAreaStyle = {
  property: string
  value: string
  label: string
}

export type ActiveAreaStyleGroup = {
  group: AreaStyleGroup
  styles: GroupedAreaStyle[]
}

export const AREA_STYLE_GROUPS: AreaStyleGroup[] = [
  {
    id: 'fill',
    label: 'Fill',
    description: 'Area surface color',
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Text color, size, weight, and alignment',
  },
  {
    id: 'border',
    label: 'Border',
    description: 'Area outline treatment',
  },
  {
    id: 'corners',
    label: 'Corners',
    description: 'Area corner shape',
  },
  {
    id: 'shadow',
    label: 'Shadow',
    description: 'Depth and emphasis',
  },
  {
    id: 'spacing',
    label: 'Spacing',
    description: 'Inside and outside spacing',
  },
  {
    id: 'size',
    label: 'Size',
    description: 'CSS width and height',
  },
  {
    id: 'layout',
    label: 'Layout',
    description: 'Content layout behavior',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Advanced declarations',
  },
]

export const AREA_STYLE_PRESETS: AreaStylePreset[] = [
  {
    id: 'fill-transparent',
    groupId: 'fill',
    label: 'Transparent',
    declarations: {
      'background-color': 'transparent',
    },
    aliases: ['clear', 'none'],
    preview: {
      kind: 'swatch',
      value: 'transparent',
    },
  },
  {
    id: 'fill-white',
    groupId: 'fill',
    label: 'White',
    declarations: {
      'background-color': '#ffffff',
    },
    aliases: ['plain'],
    preview: {
      kind: 'swatch',
      value: '#ffffff',
    },
  },
  {
    id: 'fill-soft',
    groupId: 'fill',
    label: 'Soft gray',
    declarations: {
      'background-color': '#f8fafc',
    },
    aliases: ['light gray', 'subtle'],
    preview: {
      kind: 'swatch',
      value: '#f8fafc',
    },
  },
  {
    id: 'text-muted',
    groupId: 'text',
    label: 'Muted text',
    declarations: {
      color: '#64748b',
    },
    aliases: ['gray text', 'secondary'],
    preview: {
      kind: 'text',
      value: '#64748b',
    },
  },
  {
    id: 'text-large',
    groupId: 'text',
    label: 'Large text',
    declarations: {
      'font-size': '20px',
    },
    aliases: ['bigger', 'text size', 'font size'],
    preview: {
      kind: 'text',
      value: '20px',
    },
  },
  {
    id: 'text-bold',
    groupId: 'text',
    label: 'Bold',
    declarations: {
      'font-weight': '700',
    },
    aliases: ['strong', 'weight'],
    preview: {
      kind: 'text',
      value: '700',
    },
  },
  {
    id: 'text-center',
    groupId: 'text',
    label: 'Center text',
    declarations: {
      'text-align': 'center',
    },
    aliases: ['align center', 'centered'],
  },
  {
    id: 'border-none',
    groupId: 'border',
    label: 'No border',
    declarations: {
      border: 'none',
    },
    aliases: ['remove border'],
    preview: {
      kind: 'border',
      value: 'none',
    },
  },
  {
    id: 'border-subtle',
    groupId: 'border',
    label: 'Subtle border',
    declarations: {
      border: '1px solid #d1d5db',
    },
    aliases: ['outline', 'stroke', 'light border'],
    preview: {
      kind: 'border',
      value: '1px solid #d1d5db',
    },
  },
  {
    id: 'border-strong',
    groupId: 'border',
    label: 'Strong border',
    declarations: {
      border: '2px solid currentColor',
    },
    aliases: ['heavy border'],
    preview: {
      kind: 'border',
      value: '2px solid currentColor',
    },
  },
  {
    id: 'border-dashed',
    groupId: 'border',
    label: 'Dashed border',
    declarations: {
      border: '2px dashed currentColor',
    },
    aliases: ['dash'],
    preview: {
      kind: 'border',
      value: '2px dashed currentColor',
    },
  },
  {
    id: 'corners-square',
    groupId: 'corners',
    label: 'Square',
    declarations: {
      'border-radius': '0',
    },
    aliases: ['sharp', 'no radius'],
    preview: {
      kind: 'radius',
      value: '0',
    },
  },
  {
    id: 'corners-subtle',
    groupId: 'corners',
    label: 'Subtle corners',
    declarations: {
      'border-radius': '6px',
    },
    aliases: ['slightly rounded'],
    preview: {
      kind: 'radius',
      value: '6px',
    },
  },
  {
    id: 'corners-rounded',
    groupId: 'corners',
    label: 'Rounded',
    declarations: {
      'border-radius': '12px',
    },
    aliases: ['round', 'corner', 'border-radius'],
    preview: {
      kind: 'radius',
      value: '12px',
    },
  },
  {
    id: 'corners-pill',
    groupId: 'corners',
    label: 'Pill',
    declarations: {
      'border-radius': '999px',
    },
    aliases: ['fully rounded'],
    preview: {
      kind: 'radius',
      value: '999px',
    },
  },
  {
    id: 'shadow-none',
    groupId: 'shadow',
    label: 'No shadow',
    declarations: {
      'box-shadow': 'none',
    },
    aliases: ['flat'],
    preview: {
      kind: 'shadow',
      value: 'none',
    },
  },
  {
    id: 'shadow-low',
    groupId: 'shadow',
    label: 'Low shadow',
    declarations: {
      'box-shadow': '0 1px 2px rgba(0, 0, 0, 0.12)',
    },
    aliases: ['soft shadow', 'depth'],
    preview: {
      kind: 'shadow',
      value: '0 1px 2px rgba(0, 0, 0, 0.12)',
    },
  },
  {
    id: 'shadow-medium',
    groupId: 'shadow',
    label: 'Medium shadow',
    declarations: {
      'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.14)',
    },
    aliases: ['raised', 'elevated'],
    preview: {
      kind: 'shadow',
      value: '0 8px 24px rgba(0, 0, 0, 0.14)',
    },
  },
  {
    id: 'spacing-compact',
    groupId: 'spacing',
    label: 'Compact',
    declarations: {
      padding: '4px',
    },
    aliases: ['tight', 'small padding'],
  },
  {
    id: 'spacing-normal',
    groupId: 'spacing',
    label: 'Normal',
    declarations: {
      padding: '8px',
    },
    aliases: ['padding'],
  },
  {
    id: 'spacing-roomy',
    groupId: 'spacing',
    label: 'Roomy',
    declarations: {
      padding: '16px',
    },
    aliases: ['more space', 'large padding'],
  },
  {
    id: 'size-full-width',
    groupId: 'size',
    label: 'Full width',
    declarations: {
      width: '100%',
    },
    aliases: ['wide'],
  },
  {
    id: 'layout-flex',
    groupId: 'layout',
    label: 'Flex layout',
    declarations: {
      display: 'flex',
      gap: '8px',
    },
    aliases: ['row', 'layout'],
  },
]

const GROUP_BY_ID = new Map(
  AREA_STYLE_GROUPS.map((group) => [group.id, group])
)

const PROPERTY_LABELS: Record<string, string> = {
  background: 'Background',
  'background-color': 'Background color',
  border: 'Border',
  'border-color': 'Border color',
  'border-radius': 'Corner radius',
  'box-shadow': 'Shadow',
  color: 'Text color',
  display: 'Display',
  'font-family': 'Font family',
  'font-size': 'Text size',
  'font-style': 'Font style',
  'font-weight': 'Font weight',
  gap: 'Gap',
  height: 'Height',
  'justify-content': 'Horizontal alignment',
  'line-height': 'Line height',
  margin: 'Margin',
  opacity: 'Opacity',
  padding: 'Padding',
  'text-align': 'Text alignment',
  width: 'Width',
}

export const getAreaStyleGroupIdForProperty = (
  property: string
): AreaStyleGroupId => {
  if (property === 'background' || property === 'background-color') {
    return 'fill'
  }

  if (
    property === 'color' ||
    property.startsWith('font-') ||
    property === 'line-height' ||
    property === 'text-align'
  ) {
    return 'text'
  }

  if (property === 'border-radius') return 'corners'

  if (property === 'border' || property.startsWith('border-')) {
    return 'border'
  }

  if (property === 'box-shadow' || property === 'opacity') {
    return 'shadow'
  }

  if (
    property === 'padding' ||
    property.startsWith('padding-') ||
    property === 'margin' ||
    property.startsWith('margin-') ||
    property === 'gap'
  ) {
    return 'spacing'
  }

  if (
    property === 'width' ||
    property === 'height' ||
    property.startsWith('min-') ||
    property.startsWith('max-')
  ) {
    return 'size'
  }

  if (
    property === 'display' ||
    property.startsWith('align-') ||
    property.startsWith('justify-') ||
    property.startsWith('flex-') ||
    property.startsWith('grid-')
  ) {
    return 'layout'
  }

  return 'other'
}

export const getAreaStyleGroup = (groupId: AreaStyleGroupId) =>
  GROUP_BY_ID.get(groupId) ?? GROUP_BY_ID.get('other')!

export const getAreaStylePropertyLabel = (property: string) =>
  PROPERTY_LABELS[property] ?? property

export const groupActiveAreaStyles = (
  styles: Record<string, string>
): ActiveAreaStyleGroup[] => {
  const groupedStyles = new Map<AreaStyleGroupId, GroupedAreaStyle[]>()

  for (const [property, value] of Object.entries(styles).sort(
    ([firstProperty], [secondProperty]) =>
      firstProperty.localeCompare(secondProperty)
  )) {
    const groupId = getAreaStyleGroupIdForProperty(property)
    const currentStyles = groupedStyles.get(groupId) ?? []

    currentStyles.push({
      property,
      value,
      label: getAreaStylePropertyLabel(property),
    })
    groupedStyles.set(groupId, currentStyles)
  }

  return AREA_STYLE_GROUPS.map((group) => ({
    group,
    styles: groupedStyles.get(group.id) ?? [],
  }))
}

export const getAreaStylePresetsByGroup = (
  groupId: AreaStyleGroupId
) => AREA_STYLE_PRESETS.filter((preset) => preset.groupId === groupId)

export const searchAreaStylePresets = (query: string) => {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return AREA_STYLE_PRESETS

  return AREA_STYLE_PRESETS.filter((preset) => {
    const group = getAreaStyleGroup(preset.groupId)
    const searchableText = [
      preset.id,
      preset.label,
      preset.description,
      group.label,
      group.description,
      ...Object.keys(preset.declarations),
      ...Object.values(preset.declarations),
      ...(preset.aliases ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return tokens.every((token) => searchableText.includes(token))
  })
}
