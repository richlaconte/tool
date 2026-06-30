import {
  getAreaMetadata,
  setAreaMetadata,
  type AreaEvidenceKind,
  type AreaEvidenceReference,
} from './areaMetadata.ts'
import type { AreaState } from './App'

export type EvidenceSlashCommand = {
  raw: string
  target: string
  start: number
  end: number
}

const EVIDENCE_COMMAND_PATTERN = /^\/ref(?:\s+(?<target>.+))?$/
const EVIDENCE_COMMAND_IN_LINE_PATTERN = /(^|\s)(\/ref(?:\s+.*)?$)/

export const detectAreaEvidenceKind = (
  target: string
): AreaEvidenceKind => {
  const trimmedTarget = target.trim()

  if (/^https?:\/\//i.test(trimmedTarget)) return 'url'
  if (/^(issue\s+)?#\d+$/i.test(trimmedTarget)) return 'issue'
  if (/\bpr\s*#?\d+$/i.test(trimmedTarget)) return 'pull-request'
  if (/\/pull\/\d+(?:\b|$)/i.test(trimmedTarget)) return 'pull-request'
  if (/\b(?:commit\s+)?[a-f0-9]{7,40}\b/i.test(trimmedTarget)) {
    return 'commit'
  }
  if (/^(pnpm|npm|yarn|node|curl|git|npx)\b/.test(trimmedTarget)) {
    return 'command'
  }
  if (looksLikeFileReference(trimmedTarget)) return 'file'

  return 'note'
}

export const getAreaEvidenceLabel = (
  reference: Pick<AreaEvidenceReference, 'kind' | 'label' | 'target'>
) => {
  const explicitLabel = reference.label.trim()
  if (explicitLabel) return explicitLabel

  return createEvidenceLabel(reference.target, reference.kind)
}

export const createAreaEvidenceReference = ({
  id,
  kind,
  label,
  now = new Date().toISOString(),
  target,
}: {
  id: string
  kind?: AreaEvidenceKind
  label?: string
  now?: string
  target: string
}): AreaEvidenceReference => {
  const trimmedTarget = target.trim()
  const evidenceKind = kind ?? detectAreaEvidenceKind(trimmedTarget)

  return {
    id,
    kind: evidenceKind,
    label: label?.trim() || createEvidenceLabel(trimmedTarget, evidenceKind),
    target: trimmedTarget,
    createdAt: now,
  }
}

export const addAreaEvidenceReference = <Area extends AreaState>(
  area: Area,
  reference: AreaEvidenceReference
): Area => {
  const metadata = getAreaMetadata(area)

  return setAreaMetadata(area, {
    evidence: [...(metadata.evidence ?? []), reference],
  })
}

export const removeAreaEvidenceReference = <Area extends AreaState>(
  area: Area,
  referenceId: string
): Area => {
  const metadata = getAreaMetadata(area)

  return setAreaMetadata(area, {
    evidence: (metadata.evidence ?? []).filter(
      (reference) => reference.id !== referenceId
    ),
  })
}

export const findEvidenceSlashCommand = (
  text: string,
  caretIndex: number
): EvidenceSlashCommand | null => {
  const safeCaretIndex = Math.max(0, Math.min(caretIndex, text.length))
  const lineStart = text.lastIndexOf('\n', safeCaretIndex - 1) + 1
  const nextLineBreak = text.indexOf('\n', safeCaretIndex)
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak
  const line = text.slice(lineStart, lineEnd)
  const lineMatch = EVIDENCE_COMMAND_IN_LINE_PATTERN.exec(line)

  if (!lineMatch) return null

  const slashIndex = lineStart + lineMatch.index + lineMatch[1].length
  const raw = text.slice(slashIndex, lineEnd)
  const commandMatch = EVIDENCE_COMMAND_PATTERN.exec(raw.trim())
  const target = commandMatch?.groups?.target?.trim()

  if (!target) return null

  return {
    raw,
    target,
    start: slashIndex,
    end: lineEnd,
  }
}

export const removeAreaEvidenceSlashCommand = (
  text: string,
  command: Pick<EvidenceSlashCommand, 'start' | 'end'>
) => ({
  text: text.slice(0, command.start) + text.slice(command.end),
  caretIndex: command.start,
})

const looksLikeFileReference = (target: string) =>
  /[/.]/.test(target) &&
  /\.(tsx?|jsx?|css|scss|html|md|json|ya?ml|sql|sh|svg|png|jpe?g|webp)$/i.test(
    target
  )

const createEvidenceLabel = (
  target: string,
  kind: AreaEvidenceKind
) => {
  if (kind === 'file' || kind === 'asset') {
    return target.split(/[\\/]/).filter(Boolean).pop() ?? target
  }

  if (kind === 'url') {
    try {
      const url = new URL(target)
      return (
        url.pathname.split('/').filter(Boolean).pop() ||
        url.hostname.replace(/^www\./, '')
      )
    } catch {
      return target
    }
  }

  if (kind === 'issue') {
    return target.match(/#\d+/)?.[0] ?? target
  }

  if (kind === 'pull-request') {
    return target.match(/(?:PR\s*#?|pull\/)(\d+)/i)?.[1]
      ? `PR ${target.match(/(?:PR\s*#?|pull\/)(\d+)/i)?.[1]}`
      : target
  }

  if (kind === 'commit') {
    return target.match(/[a-f0-9]{7,40}/i)?.[0].slice(0, 7) ?? target
  }

  return target.length > 48 ? `${target.slice(0, 45)}...` : target
}
