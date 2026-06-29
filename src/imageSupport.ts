export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

export type ImageSlashCommand = {
  start: number
  end: number
  raw: string
  url: string
}

type ImageFileLike = {
  size: number
  type: string
}

type ImageFileContentLike = ImageFileLike & {
  slice: (start?: number, end?: number) => {
    arrayBuffer: () => Promise<ArrayBuffer>
  }
}

const IMAGE_COMMAND_PATTERN = /^\/image(?:\s+(?<url>.+))?$/
const IMAGE_COMMAND_IN_LINE_PATTERN = /(^|\s)(\/image(?:\s+.*)?$)/

export const findImageSlashCommand = (
  text: string,
  caretIndex: number
): ImageSlashCommand | null => {
  const safeCaretIndex = Math.max(0, Math.min(caretIndex, text.length))
  const lineStart = text.lastIndexOf('\n', safeCaretIndex - 1) + 1
  const lineEndIndex = text.indexOf('\n', safeCaretIndex)
  const lineEnd =
    lineEndIndex === -1 ? text.length : lineEndIndex
  const line = text.slice(lineStart, lineEnd)
  const lineMatch = line.match(IMAGE_COMMAND_IN_LINE_PATTERN)

  if (!lineMatch || lineMatch.index === undefined) return null

  const slashIndex = lineStart + lineMatch.index + lineMatch[1].length
  const raw = text.slice(slashIndex, lineEnd)
  const match = raw.trimEnd().match(IMAGE_COMMAND_PATTERN)

  if (!match) return null

  return {
    start: slashIndex,
    end: lineEnd,
    raw,
    url: match.groups?.url?.trim() ?? '',
  }
}

export const removeImageSlashCommand = (
  text: string,
  command: Pick<ImageSlashCommand, 'start' | 'end'>
) => ({
  text: `${text.slice(0, command.start)}${text.slice(command.end)}`,
  caretIndex: command.start,
})

export const getImageFileValidationError = (
  file: ImageFileLike
) => {
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) {
    return 'Choose a PNG, JPEG, GIF, or WebP image.'
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return 'Choose an image smaller than 5 MB.'
  }

  return null
}

export const getImageFileContentValidationError = async (
  file: ImageFileContentLike
) => {
  const declaredTypeError = getImageFileValidationError(file)

  if (declaredTypeError) return declaredTypeError

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())

  if (matchesImageSignature(file.type, bytes)) return null

  return 'Image file contents do not match a supported PNG, JPEG, GIF, or WebP image.'
}

export const getImageUrlValidationError = (url: string) => {
  if (!url.trim()) return 'Enter an image URL.'

  if (url.startsWith('data:image/')) {
    return url.startsWith('data:image/svg+xml')
      ? 'SVG image URLs are not supported yet.'
      : null
  }

  try {
    const parsedUrl = new URL(url)

    if (
      parsedUrl.pathname.trim().toLowerCase().endsWith('.svg')
    ) {
      return 'SVG image URLs are not supported yet.'
    }

    return parsedUrl.protocol === 'http:' ||
      parsedUrl.protocol === 'https:'
      ? null
      : 'Enter an http, https, or data image URL.'
  } catch {
    return 'Enter a valid image URL.'
  }
}

const matchesImageSignature = (type: string, bytes: Uint8Array) => {
  if (type === 'image/png') {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  }

  if (type === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (type === 'image/gif') {
    const signature = decodeAscii(bytes.slice(0, 6))

    return signature === 'GIF87a' || signature === 'GIF89a'
  }

  if (type === 'image/webp') {
    return (
      decodeAscii(bytes.slice(0, 4)) === 'RIFF' &&
      decodeAscii(bytes.slice(8, 12)) === 'WEBP'
    )
  }

  return false
}

const decodeAscii = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('')
