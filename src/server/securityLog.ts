export type SecurityLogEventType =
  | 'collaboration-auth-rejected'
  | 'collaboration-connection-limit'
  | 'collaboration-message-rate-limit'
  | 'collaboration-message-too-large'

export type SecurityLogEvent = {
  type: SecurityLogEventType
  at?: string
  clientId?: string
  documentName?: string
  pageId?: string
  reason: string
  retryAfterSeconds?: number
}

export type SecurityLogger = (event: SecurityLogEvent) => void

export const createConsoleSecurityLogger = ({
  enabled = process.env.TOOL_SECURITY_LOGS !== 'false',
  now = () => new Date().toISOString(),
}: {
  enabled?: boolean
  now?: () => string
} = {}): SecurityLogger => {
  return (event) => {
    if (!enabled) return

    console.warn(
      JSON.stringify({
        level: 'warn',
        source: 'cascadery-security',
        ...redactSecurityLogEvent({
          ...event,
          at: event.at || now(),
        }),
      })
    )
  }
}

export const redactSecurityLogEvent = (
  event: SecurityLogEvent
): SecurityLogEvent & { at: string } => ({
  ...event,
  at: event.at ?? new Date(0).toISOString(),
  clientId: event.clientId ? redactIdentifier(event.clientId) : undefined,
})

const redactIdentifier = (value: string) =>
  value.length <= 8 ? value : `${value.slice(0, 4)}...${value.slice(-4)}`
