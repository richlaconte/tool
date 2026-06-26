export type ShareAccessMode = 'edit' | 'view'

export type ShareLinks = {
  pageId: string
  editToken: string
  viewToken: string
  createdAt: string
  updatedAt: string
  revokedAt: string | null
}

const TOKEN_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

export const createShareLinks = (
  pageId: string,
  now = new Date().toISOString()
): ShareLinks => ({
  pageId,
  editToken: createShareToken(),
  viewToken: createShareToken(),
  createdAt: now,
  updatedAt: now,
  revokedAt: null,
})

export const regenerateShareLink = (
  links: ShareLinks,
  accessMode: ShareAccessMode,
  now = new Date().toISOString()
): ShareLinks => ({
  ...links,
  editToken:
    accessMode === 'edit' ? createShareToken() : links.editToken,
  viewToken:
    accessMode === 'view' ? createShareToken() : links.viewToken,
  updatedAt: now,
  revokedAt: null,
})

export const buildShareUrl = (
  currentUrl: string,
  accessMode: ShareAccessMode,
  token: string
) => {
  const url = new URL(currentUrl)

  url.search = ''
  url.hash = ''
  url.searchParams.set('share', accessMode)
  url.searchParams.set('token', token)

  return url.toString()
}

export const getShareAccessMode = (
  search: string,
  links: ShareLinks | null
): ShareAccessMode => {
  const params = new URLSearchParams(search)
  const requestedMode = params.get('share')
  const token = params.get('token')

  if (!requestedMode && !token) return 'edit'

  if (
    !links ||
    links.revokedAt ||
    (requestedMode !== 'edit' && requestedMode !== 'view') ||
    !token
  ) {
    return 'view'
  }

  if (requestedMode === 'edit' && token === links.editToken) {
    return 'edit'
  }

  if (requestedMode === 'view' && token === links.viewToken) {
    return 'view'
  }

  return 'view'
}

const createShareToken = () => {
  const values = new Uint8Array(48)

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    crypto.getRandomValues(values)
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(
    values,
    (value) => TOKEN_ALPHABET[value % TOKEN_ALPHABET.length]
  ).join('')
}
