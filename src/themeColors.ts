export type ThemeColorToken = {
  id: string
  name: string
  token: string
  value: string
  createdAt: string
  updatedAt: string
}

const THEME_TOKEN_PATTERN =
  /\$\{[^}]+\}(?:-[A-Za-z0-9_]+)*|[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)+/g

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getThemeColorMap = (colors: ThemeColorToken[]) =>
  new Map(
    colors.map((color) => [
      normalizeThemeColorToken(color.token),
      color.value,
    ])
  )

export const normalizeThemeColorToken = (value: string) =>
  value
    .trim()
    .replace(/\$\{([^}]+)\}/g, '$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const resolveThemeColorTokens = (
  value: string,
  colors: ThemeColorToken[]
) => {
  let resolvedValue = value

  for (const color of colors) {
    const token = normalizeThemeColorToken(color.token)

    if (!token) continue

    const tokenPattern = new RegExp(
      `(^|[^A-Za-z0-9_-])(${escapeRegExp(token)}|\\$\\{${escapeRegExp(token)}\\})(?=$|[^A-Za-z0-9_-])`,
      'g'
    )

    resolvedValue = resolvedValue.replace(
      tokenPattern,
      (_match, prefix: string) => `${prefix}${color.value}`
    )
  }

  return resolvedValue
}

export const getUnresolvedThemeColorTokens = (
  value: string,
  colors: ThemeColorToken[]
) => {
  const colorMap = getThemeColorMap(colors)
  const unresolvedTokens = new Set<string>()

  for (const match of value.matchAll(THEME_TOKEN_PATTERN)) {
    const token = match[0]
    const normalizedToken = normalizeThemeColorToken(token)

    if (!normalizedToken || colorMap.has(normalizedToken)) continue

    unresolvedTokens.add(normalizedToken)
  }

  return Array.from(unresolvedTokens)
}

export const getThemeColorContrastWarning = (
  foreground: string,
  background: string
) => {
  const foregroundRgb = parseHexColor(foreground)
  const backgroundRgb = parseHexColor(background)

  if (!foregroundRgb || !backgroundRgb) return null

  const ratio = getContrastRatio(foregroundRgb, backgroundRgb)

  if (ratio >= 4.5) return null

  return `Low contrast: ${ratio.toFixed(1)}:1 contrast against the page background.`
}

const parseHexColor = (value: string) => {
  const trimmedValue = value.trim()
  const shortHexMatch = trimmedValue.match(
    /^#(?<r>[0-9a-f])(?<g>[0-9a-f])(?<b>[0-9a-f])$/i
  )

  if (shortHexMatch?.groups) {
    return {
      r: parseInt(shortHexMatch.groups.r.repeat(2), 16),
      g: parseInt(shortHexMatch.groups.g.repeat(2), 16),
      b: parseInt(shortHexMatch.groups.b.repeat(2), 16),
    }
  }

  const hexMatch = trimmedValue.match(
    /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})$/i
  )

  if (!hexMatch?.groups) return null

  return {
    r: parseInt(hexMatch.groups.r, 16),
    g: parseInt(hexMatch.groups.g, 16),
    b: parseInt(hexMatch.groups.b, 16),
  }
}

const getRelativeLuminance = ({
  r,
  g,
  b,
}: {
  r: number
  g: number
  b: number
}) => {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const normalizedChannel = channel / 255

    return normalizedChannel <= 0.03928
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const getContrastRatio = (
  firstColor: { r: number; g: number; b: number },
  secondColor: { r: number; g: number; b: number }
) => {
  const firstLuminance = getRelativeLuminance(firstColor)
  const secondLuminance = getRelativeLuminance(secondColor)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}
