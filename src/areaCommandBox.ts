import {
  findCssSlashCommand,
  type CssSlashCommand,
  type CssSupportChecker,
} from './cssSlashCommand.ts'

export type CommandBoxSuggestion = {
  id: string
  property: string
  description: string
  example: string
}

/*
 * Discovery registry for the Area Command Box. Scoped to the CSS command
 * grammar today; asset/evidence commands join when the command registry
 * consolidates (see the Area Command Box spec's Future Work).
 */
export const COMMAND_BOX_SUGGESTIONS: CommandBoxSuggestion[] = [
  {
    id: 'border',
    property: 'border',
    description: 'Outline the Area',
    example: 'border: 1px solid slategray',
  },
  {
    id: 'border-radius',
    property: 'border-radius',
    description: 'Round the corners',
    example: 'border-radius: 12px',
  },
  {
    id: 'background',
    property: 'background',
    description: 'Fill the Area',
    example: 'background: #fef3c7',
  },
  {
    id: 'box-shadow',
    property: 'box-shadow',
    description: 'Lift the Area with a shadow',
    example: 'box-shadow: 0 8px 24px rgb(0 0 0 / 18%)',
  },
  {
    id: 'color',
    property: 'color',
    description: 'Set the text color',
    example: 'color: #b91c1c',
  },
  {
    id: 'font-size',
    property: 'font-size',
    description: 'Set the text size',
    example: 'font-size: 20px',
  },
  {
    id: 'font-weight',
    property: 'font-weight',
    description: 'Set the text weight',
    example: 'font-weight: 700',
  },
  {
    id: 'font-family',
    property: 'font-family',
    description: 'Set the typeface',
    example: 'font-family: monospace',
  },
  {
    id: 'padding',
    property: 'padding',
    description: 'Pad the content',
    example: 'padding: 16px',
  },
  {
    id: 'opacity',
    property: 'opacity',
    description: 'Fade the Area',
    example: 'opacity: 0.6',
  },
  {
    id: 'text-align',
    property: 'text-align',
    description: 'Align the text',
    example: 'text-align: center',
  },
  {
    id: 'letter-spacing',
    property: 'letter-spacing',
    description: 'Space the letters',
    example: 'letter-spacing: 0.08em',
  },
]

/*
 * Suggestions show while the draft is a bare property fragment. Once the
 * draft crosses into a declaration (`:` or whitespace), the parse status
 * line takes over and suggestions hide.
 */
export const getCommandBoxSuggestions = (draft: string) => {
  const query = draft.trim().toLowerCase()

  if (query.includes(':') || /\s/.test(query)) return []
  if (!query) return COMMAND_BOX_SUGGESTIONS

  return COMMAND_BOX_SUGGESTIONS.filter(
    (suggestion) =>
      suggestion.property.includes(query) ||
      suggestion.description.toLowerCase().includes(query)
  )
}

/*
 * The box owns a fixed `/` prefix, so parsing wraps the draft in one and
 * reuses the exact inline-command grammar and validation.
 */
export const parseCommandBoxDraft = (
  draft: string,
  supports?: CssSupportChecker
): CssSlashCommand | null => {
  const text = `/${draft}`

  return findCssSlashCommand(text, text.length, supports)
}

export type CommandBoxRect = {
  top: number
  left: number
  bottom: number
  width: number
}

export type CommandBoxPlacement = {
  top: number
  left: number
  side: 'above' | 'below'
}

export const COMMAND_BOX_GAP = 8
export const COMMAND_BOX_VIEWPORT_MARGIN = 8

/*
 * Placement contract (Area Command Box spec): above the anchor by default,
 * left-aligned; flip below only on viewport collision; shift horizontally
 * to stay on-screen; never cover the anchor — when the anchor is taller
 * than the viewport, anchor to its visible edges instead.
 */
export const getCommandBoxPlacement = ({
  anchorRect,
  boxHeight,
  boxWidth,
  viewportHeight,
  viewportWidth,
  gap = COMMAND_BOX_GAP,
  margin = COMMAND_BOX_VIEWPORT_MARGIN,
}: {
  anchorRect: CommandBoxRect
  boxHeight: number
  boxWidth: number
  viewportHeight: number
  viewportWidth: number
  gap?: number
  margin?: number
}): CommandBoxPlacement => {
  const visibleTop = Math.min(Math.max(anchorRect.top, 0), viewportHeight)
  const visibleBottom = Math.min(
    Math.max(anchorRect.bottom, 0),
    viewportHeight
  )

  let side: CommandBoxPlacement['side'] = 'above'
  let top = visibleTop - boxHeight - gap

  if (top < margin) {
    side = 'below'
    top = visibleBottom + gap

    if (top + boxHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - boxHeight - margin)
    }
  }

  const maxLeft = Math.max(margin, viewportWidth - boxWidth - margin)
  const left = Math.min(Math.max(anchorRect.left, margin), maxLeft)

  return { top, left, side }
}
