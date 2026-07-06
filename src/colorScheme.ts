// Color scheme resolution and persistence (adaptive color scheme spec).
//
// The scheme is a *device* preference: stored in localStorage, never page
// state, never exported, never collaborative. `system` follows the
// `prefers-color-scheme` media query live; Light/Dark override it.

export const COLOR_SCHEME_STORAGE_KEY = 'cascadery-color-scheme'
export const COLOR_SCHEME_ATTRIBUTE = 'data-color-scheme'

export const COLOR_SCHEME_PREFERENCES = [
  'system',
  'light',
  'dark',
] as const

export type ColorSchemePreference =
  (typeof COLOR_SCHEME_PREFERENCES)[number]

export type ResolvedColorScheme = 'light' | 'dark'

export const isColorSchemePreference = (
  value: unknown
): value is ColorSchemePreference =>
  typeof value === 'string' &&
  COLOR_SCHEME_PREFERENCES.includes(value as ColorSchemePreference)

export const resolveColorScheme = (
  preference: ColorSchemePreference,
  systemScheme: ResolvedColorScheme
): ResolvedColorScheme =>
  preference === 'system' ? systemScheme : preference

// Invalid or missing stored values fall back to `system`.
export const parseStoredColorScheme = (
  value: string | null | undefined
): ColorSchemePreference =>
  isColorSchemePreference(value) ? value : 'system'

export const getNextColorSchemePreference = (
  preference: ColorSchemePreference
): ColorSchemePreference =>
  COLOR_SCHEME_PREFERENCES[
    (COLOR_SCHEME_PREFERENCES.indexOf(preference) + 1) %
      COLOR_SCHEME_PREFERENCES.length
  ]

export const COLOR_SCHEME_PREFERENCE_LABELS: Record<
  ColorSchemePreference,
  string
> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const getStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const readStoredColorScheme = (
  storage: StorageLike | null = getStorage()
): ColorSchemePreference => {
  try {
    return parseStoredColorScheme(
      storage?.getItem(COLOR_SCHEME_STORAGE_KEY)
    )
  } catch {
    return 'system'
  }
}

export const storeColorScheme = (
  preference: ColorSchemePreference,
  storage: StorageLike | null = getStorage()
) => {
  try {
    storage?.setItem(COLOR_SCHEME_STORAGE_KEY, preference)
  } catch {
    // Private-mode storage failures degrade to session-only preference.
  }
}

export const applyColorSchemeToDocument = (
  scheme: ResolvedColorScheme,
  root: { setAttribute: (name: string, value: string) => void } | null =
    typeof document === 'undefined' ? null : document.documentElement
) => {
  root?.setAttribute(COLOR_SCHEME_ATTRIBUTE, scheme)
}

// Inline no-FOUC bootstrap for app/layout.tsx: runs synchronously before
// first paint, duplicating resolveColorScheme in minimal inline JS. Kept
// here so the logic and its inline twin live in one reviewed place.
export const COLOR_SCHEME_BOOTSTRAP_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}')
    var preference =
      stored === 'light' || stored === 'dark' ? stored : 'system'
    var scheme =
      preference === 'system'
        ? window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : preference
    document.documentElement.setAttribute('${COLOR_SCHEME_ATTRIBUTE}', scheme)
  } catch (error) {
    document.documentElement.setAttribute('${COLOR_SCHEME_ATTRIBUTE}', 'light')
  }
})()`
