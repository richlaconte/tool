export type AssetSourceProvider = 'giphy'

export type GifAssetSource = {
  provider: AssetSourceProvider
  providerAssetId: string
  providerUrl: string
  title: string
  rating?: string
  rendition: string
  stillUrl?: string
  animatedUrl: string
  attributionLabel: 'Powered by GIPHY'
  analytics?: {
    onload?: string
    onclick?: string
    onsent?: string
  }
}

export type GifSlashCommand = {
  start: number
  end: number
  raw: string
  query: string
}

export type GifSearchOptions = {
  limit?: number
  rating?: string
  signal?: AbortSignal
}

export type GifSearchResult = {
  provider: 'giphy'
  providerAssetId: string
  title: string
  previewUrl: string
  stillUrl?: string
  animatedUrl: string
  width: number
  height: number
  providerUrl: string
  rating?: string
  attributionLabel: 'Powered by GIPHY'
  analytics?: {
    onload?: string
    onclick?: string
    onsent?: string
  }
}

export type GifSearchProvider = {
  search: (
    query: string,
    options: GifSearchOptions
  ) => Promise<GifSearchResult[]>
  trending: (options: GifSearchOptions) => Promise<GifSearchResult[]>
  registerEvent?: (
    result: GifSearchResult,
    event: 'view' | 'click' | 'send'
  ) => Promise<void>
}

type FetchLike = typeof fetch

type CreateGiphySearchProviderOptions = {
  apiKey: string
  fetchImpl?: FetchLike
}

const GIF_COMMAND_PATTERN = /^\/gif(?:\s+(?<query>.+))?$/
const GIF_COMMAND_IN_LINE_PATTERN = /(^|\s)(\/gif(?:\s+.*)?$)/
const GIPHY_API_BASE_URL = 'https://api.giphy.com/v1/gifs'

export class GifSearchConfigurationError extends Error {
  constructor() {
    super('GIF search is not configured.')
    this.name = 'GifSearchConfigurationError'
  }
}

export const findGifSlashCommand = (
  text: string,
  caretIndex: number
): GifSlashCommand | null => {
  const safeCaretIndex = Math.max(0, Math.min(caretIndex, text.length))
  const lineStart = text.lastIndexOf('\n', safeCaretIndex - 1) + 1
  const lineEndIndex = text.indexOf('\n', safeCaretIndex)
  const lineEnd =
    lineEndIndex === -1 ? text.length : lineEndIndex
  const line = text.slice(lineStart, lineEnd)
  const lineMatch = line.match(GIF_COMMAND_IN_LINE_PATTERN)

  if (!lineMatch || lineMatch.index === undefined) return null

  const slashIndex = lineStart + lineMatch.index + lineMatch[1].length
  const raw = text.slice(slashIndex, lineEnd)
  const match = raw.trimEnd().match(GIF_COMMAND_PATTERN)

  if (!match) return null

  return {
    start: slashIndex,
    end: lineEnd,
    raw,
    query: normalizeGifQuery(match.groups?.query ?? ''),
  }
}

export const removeGifSlashCommand = (
  text: string,
  command: Pick<GifSlashCommand, 'start' | 'end'>
) => ({
  text: `${text.slice(0, command.start)}${text.slice(command.end)}`,
  caretIndex: command.start,
})

export const createGiphySearchProvider = ({
  apiKey,
  fetchImpl = fetch,
}: CreateGiphySearchProviderOptions): GifSearchProvider => {
  const request = async (
    path: 'search' | 'trending',
    options: GifSearchOptions,
    query?: string
  ) => {
    if (!apiKey.trim()) throw new GifSearchConfigurationError()

    const url = new URL(`${GIPHY_API_BASE_URL}/${path}`)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('limit', String(options.limit ?? 8))
    url.searchParams.set('rating', options.rating ?? 'pg')
    if (query) url.searchParams.set('q', query)

    const response = await fetchImpl(url, {
      signal: options.signal,
    })

    if (!response.ok) {
      throw new Error('GIF search is temporarily unavailable.')
    }

    const payload = (await response.json()) as unknown
    const payloadRecord = isRecord(payload) ? payload : {}
    const data = Array.isArray(payloadRecord.data)
      ? payloadRecord.data
      : []

    return data
      .map(mapGiphyGif)
      .filter((result): result is GifSearchResult => result !== null)
  }

  return {
    search: (query, options) =>
      request('search', options, normalizeGifQuery(query)),
    trending: (options) => request('trending', options),
    registerEvent: async (result, event) => {
      const analyticsUrl =
        event === 'view'
          ? result.analytics?.onload
          : event === 'click'
            ? result.analytics?.onclick
            : result.analytics?.onsent

      if (!analyticsUrl) return

      await fetchImpl(analyticsUrl)
    },
  }
}

export const toGifAssetSource = (
  result: GifSearchResult
): GifAssetSource => ({
  provider: result.provider,
  providerAssetId: result.providerAssetId,
  providerUrl: result.providerUrl,
  title: result.title,
  ...(result.rating ? { rating: result.rating } : {}),
  rendition: 'fixed_width',
  ...(result.stillUrl ? { stillUrl: result.stillUrl } : {}),
  animatedUrl: result.animatedUrl,
  attributionLabel: result.attributionLabel,
  ...(result.analytics ? { analytics: result.analytics } : {}),
})

const normalizeGifQuery = (query: string) => {
  const trimmed = query.trim()

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

const mapGiphyGif = (gif: unknown): GifSearchResult | null => {
  if (!isRecord(gif)) return null

  const images = isRecord(gif.images) ? gif.images : {}
  const preview = readImageRendition(images.fixed_width_small)
  const still = readImageRendition(images.fixed_width_small_still)
  const animated =
    readImageRendition(images.fixed_width) ??
    readImageRendition(images.original)

  if (!preview || !animated) return null

  const title =
    typeof gif.title === 'string' && gif.title.trim()
      ? gif.title.trim()
      : 'GIF'
  const analytics = readGiphyAnalytics(gif.analytics)

  return {
    provider: 'giphy',
    providerAssetId: String(gif.id ?? ''),
    title,
    previewUrl: preview.url,
    ...(still ? { stillUrl: still.url } : {}),
    animatedUrl: animated.url,
    width: animated.width,
    height: animated.height,
    providerUrl:
      typeof gif.url === 'string' ? gif.url : 'https://giphy.com',
    ...(typeof gif.rating === 'string' ? { rating: gif.rating } : {}),
    attributionLabel: 'Powered by GIPHY',
    ...(analytics ? { analytics } : {}),
  }
}

const readImageRendition = (value: unknown) => {
  if (!isRecord(value) || typeof value.url !== 'string') return null

  return {
    url: value.url,
    width: readDimension(value.width),
    height: readDimension(value.height),
  }
}

const readDimension = (value: unknown) => {
  const numberValue =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : 160
}

const readGiphyAnalytics = (value: unknown) => {
  const analytics = isRecord(value) ? value : {}
  const onload = readAnalyticsUrl(analytics.onload)
  const onclick = readAnalyticsUrl(analytics.onclick)
  const onsent = readAnalyticsUrl(analytics.onsent)

  if (!onload && !onclick && !onsent) return null

  return {
    ...(onload ? { onload } : {}),
    ...(onclick ? { onclick } : {}),
    ...(onsent ? { onsent } : {}),
  }
}

const readAnalyticsUrl = (value: unknown) =>
  isRecord(value) && typeof value.url === 'string'
    ? value.url
    : undefined

const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
