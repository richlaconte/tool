export type CssSupportChecker = (
  property: string,
  value: string
) => boolean

export type CssSlashCommand = {
  start: number
  end: number
  raw: string
  property: string
  value: string
  propertyIsValid: boolean
  declarationIsValid: boolean
}

const CSS_PROPERTY_PATTERN =
  /^\/(?<property>--[A-Za-z_][\w-]*|-?[A-Za-z][\w-]*)(?::)?(?:\s+(?<value>.*))?$/
const BORDER_STYLE_PATTERN =
  /\b(?:none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)\b/i

const supportsCssDeclaration: CssSupportChecker = (
  property,
  value
) => {
  if (typeof CSS === 'undefined') return false

  return CSS.supports(property, value)
}

const normalizeProperty = (property: string) =>
  property.startsWith('--') ? property : property.toLowerCase()

const normalizeValue = (value: string) =>
  value.trim().replace(/;\s*$/, '').trim()

const isCompleteCssDeclaration = (
  property: string,
  value: string
) => {
  if (property === 'border' && !BORDER_STYLE_PATTERN.test(value)) {
    return false
  }

  return true
}

export const findCssSlashCommand = (
  text: string,
  caretIndex: number,
  supports: CssSupportChecker = supportsCssDeclaration
): CssSlashCommand | null => {
  const safeCaretIndex = Math.max(0, Math.min(caretIndex, text.length))
  const lineStart = text.lastIndexOf('\n', safeCaretIndex - 1) + 1
  const lineEndIndex = text.indexOf('\n', safeCaretIndex)
  const lineEnd =
    lineEndIndex === -1 ? text.length : lineEndIndex
  const slashIndex = text.lastIndexOf('/', safeCaretIndex - 1)

  if (slashIndex < lineStart) return null

  const characterBeforeSlash =
    slashIndex > lineStart ? text[slashIndex - 1] : ''

  if (characterBeforeSlash && !/\s/.test(characterBeforeSlash)) {
    return null
  }

  const raw = text.slice(slashIndex, lineEnd)
  const match = raw.trimEnd().match(CSS_PROPERTY_PATTERN)

  if (!match?.groups) return null

  const property = normalizeProperty(match.groups.property)
  const value = normalizeValue(match.groups.value ?? '')
  const propertyIsValid = supports(property, 'initial')
  const declarationIsValid =
    propertyIsValid &&
    value.length > 0 &&
    supports(property, value) &&
    isCompleteCssDeclaration(property, value)

  return {
    start: slashIndex,
    end: lineEnd,
    raw,
    property,
    value,
    propertyIsValid,
    declarationIsValid,
  }
}

export const removeCssSlashCommand = (
  text: string,
  command: Pick<CssSlashCommand, 'start' | 'end'>
) => ({
  text: `${text.slice(0, command.start)}${text.slice(command.end)}`,
  caretIndex: command.start,
})
