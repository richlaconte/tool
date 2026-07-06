export const TELEMETRY_EVENTS = [
  'page_created',
  'area_created',
  'slash_command_used',
  'context_kit_inserted',
  'share_link_created',
  'export_markdown',
  'export_json_canvas',
  'export_sdd',
  'export_sdd_spec_kit',
  'export_mermaid',
  'import_mermaid',
  'import_page_json',
  'mcp_request',
  'agent_proposal_accepted',
  'agent_proposal_rejected',
] as const

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number]

export const TELEMETRY_OPT_OUT_STORAGE_KEY = 'cascadery-telemetry-opt-out'
export const TELEMETRY_DISABLED_META_NAME = 'cascadery-telemetry'
export const TELEMETRY_ENDPOINT = '/api/telemetry'

export const isTelemetryEvent = (
  value: unknown
): value is TelemetryEvent =>
  typeof value === 'string' &&
  TELEMETRY_EVENTS.includes(value as TelemetryEvent)

export type TelemetryClient = {
  trackEvent: (event: TelemetryEvent) => boolean
}

export const createTelemetryClient = ({
  isDisabled,
  sendBeacon,
}: {
  isDisabled: () => boolean
  sendBeacon: (url: string, payload: string) => void
}): TelemetryClient => ({
  trackEvent: (event) => {
    if (isDisabled()) return false

    try {
      sendBeacon(TELEMETRY_ENDPOINT, JSON.stringify({ event }))
    } catch {
      // Telemetry must never break the app.
      return false
    }

    return true
  },
})

export const isBrowserTelemetryDisabled = ({
  getMetaContent,
  getStoredOptOut,
}: {
  getMetaContent: (name: string) => string | null
  getStoredOptOut: () => string | null
}) =>
  getMetaContent(TELEMETRY_DISABLED_META_NAME) === 'disabled' ||
  getStoredOptOut() === 'true'

let defaultClient: TelemetryClient | null = null

export const getDefaultTelemetryClient = (): TelemetryClient => {
  if (defaultClient) return defaultClient

  if (
    typeof navigator === 'undefined' ||
    typeof navigator.sendBeacon !== 'function' ||
    typeof document === 'undefined'
  ) {
    defaultClient = { trackEvent: () => false }
    return defaultClient
  }

  defaultClient = createTelemetryClient({
    isDisabled: () =>
      isBrowserTelemetryDisabled({
        getMetaContent: (name) =>
          document
            .querySelector(`meta[name="${name}"]`)
            ?.getAttribute('content') ?? null,
        getStoredOptOut: () => {
          try {
            return window.localStorage.getItem(
              TELEMETRY_OPT_OUT_STORAGE_KEY
            )
          } catch {
            return null
          }
        },
      }),
    sendBeacon: (url, payload) => {
      navigator.sendBeacon(url, payload)
    },
  })

  return defaultClient
}

export const trackTelemetryEvent = (event: TelemetryEvent) =>
  getDefaultTelemetryClient().trackEvent(event)

export const isTelemetryOptedOut = () => {
  try {
    return (
      window.localStorage.getItem(TELEMETRY_OPT_OUT_STORAGE_KEY) === 'true'
    )
  } catch {
    return false
  }
}

export const setTelemetryOptOut = (optedOut: boolean) => {
  try {
    if (optedOut) {
      window.localStorage.setItem(TELEMETRY_OPT_OUT_STORAGE_KEY, 'true')
    } else {
      window.localStorage.removeItem(TELEMETRY_OPT_OUT_STORAGE_KEY)
    }
  } catch {
    // Storage may be unavailable; opt-out then falls back to default-on,
    // matching a browser that blocks localStorage entirely.
  }
}
