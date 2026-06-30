import type { AreaState, TextAreaState } from './App'
import { getAreaMetadata } from './areaMetadata.ts'
import type { PageAppState } from './pagePersistence.ts'

export type AgentHandoffBrief = {
  markdown: string
  warnings: string[]
}

const SUGGESTED_AGENT_INSTRUCTIONS =
  'Use this canvas as the source of truth. Implement only the scoped changes. Preserve existing user work. Run the listed verification commands before reporting completion.'

export const createAgentHandoffBrief = (
  state: PageAppState
): AgentHandoffBrief => {
  const warnings = getAgentHandoffWarnings(state)
  const lines = [
    `# Agent Handoff: ${state.page.title || 'Untitled page'}`,
    '',
    `Page ID: \`${state.page.id}\``,
    '',
  ]

  if (warnings.length > 0) {
    lines.push('## Missing Context Warnings', '')
    lines.push(...warnings.map((warning) => `- ${warning}`), '')
  }

  appendSection(lines, 'Goal', getGoalLines(state.areas))
  appendSection(lines, 'Scope', getTextMatches(state.areas, /\bscope\b/i))
  appendSection(lines, 'Decisions', getKindLines(state.areas, 'decision'))
  appendSection(lines, 'Tasks', getKindLines(state.areas, 'task'))
  appendSection(lines, 'Risks', getKindLines(state.areas, 'risk'))
  appendSection(
    lines,
    'Open Questions',
    getKindLines(state.areas, 'question')
  )
  appendSection(
    lines,
    'Acceptance Criteria',
    getTextMatches(state.areas, /\bacceptance\b|\bcriteria\b/i)
  )
  appendSection(
    lines,
    'Validation Plan',
    getTextMatches(state.areas, /\btest\b|\bverify\b|\bvalidation\b/i)
  )
  appendSection(lines, 'Evidence and References', getEvidenceLines(state))
  appendSection(lines, 'Relevant Areas', getRelevantAreaLines(state.areas))
  appendSection(lines, 'Relationships', getRelationshipLines(state))

  lines.push(
    '## Suggested Agent Instructions',
    '',
    SUGGESTED_AGENT_INSTRUCTIONS,
    '',
    '## Review Checklist',
    '',
    '- [ ] Scope is explicit.',
    '- [ ] Evidence and files are included where needed.',
    '- [ ] Validation commands are clear.',
    '- [ ] Open questions are resolved or intentionally deferred.',
    ''
  )

  return {
    markdown: `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`,
    warnings,
  }
}

export const getAgentHandoffWarnings = (state: PageAppState) => {
  const textAreas = getTextAreas(state.areas)
  const allText = textAreas.map((area) => area.text).join('\n')
  const warnings: string[] = []

  if (!/\bgoal\b|\bobjective\b/i.test(allText)) {
    warnings.push('No explicit goal.')
  }

  if (!/\bacceptance\b|\bcriteria\b/i.test(allText)) {
    warnings.push('No acceptance criteria.')
  }

  if (/\b(open question|question):/i.test(allText)) {
    warnings.push('Open questions still present.')
  }

  if (
    textAreas.some((area) => getAreaMetadata(area).kind === 'risk') &&
    !/\bmitigation\b|\bvalidation\b|\btest\b|\bverify\b/i.test(allText)
  ) {
    warnings.push('Risks do not mention mitigation or validation.')
  }

  if (
    textAreas.some((area) => getAreaMetadata(area).kind === 'task') &&
    !state.areas.some((area) => (getAreaMetadata(area).evidence ?? []).length > 0)
  ) {
    warnings.push('Tasks do not include evidence anchors.')
  }

  if (!/\btest\b|\bverify\b|\bvalidation\b/i.test(allText)) {
    warnings.push('No validation or test plan.')
  }

  return Array.from(new Set(warnings))
}

const appendSection = (
  lines: string[],
  title: string,
  sectionLines: string[]
) => {
  if (sectionLines.length === 0) return

  lines.push(`## ${title}`, '', ...sectionLines, '')
}

const getTextAreas = (areas: AreaState[]): TextAreaState[] =>
  areas.filter((area): area is TextAreaState => area.type !== 'image')

const getGoalLines = (areas: AreaState[]) => {
  const goalAreas = getTextAreas(areas).filter((area) => {
    const metadata = getAreaMetadata(area)

    return (
      metadata.tags.includes('goal') ||
      /^(goal|objective)\s*:/i.test(area.text.trim()) ||
      /\b(goal|objective)\b/i.test(firstLine(area.text))
    )
  })

  return goalAreas.map(formatAreaLine)
}

const getKindLines = (
  areas: AreaState[],
  kind: ReturnType<typeof getAreaMetadata>['kind']
) =>
  getTextAreas(areas)
    .filter((area) => getAreaMetadata(area).kind === kind)
    .map(formatAreaLine)

const getTextMatches = (areas: AreaState[], pattern: RegExp) =>
  getTextAreas(areas)
    .filter((area) => pattern.test(area.text))
    .map(formatAreaLine)

const getEvidenceLines = (state: PageAppState) => {
  const lines: string[] = []

  for (const area of state.areas) {
    const metadata = getAreaMetadata(area)

    if (metadata.filePath) {
      lines.push(`- \`${metadata.filePath}\` (${area.id})`)
    }

    if (metadata.url) {
      lines.push(`- ${metadata.url} (${area.id})`)
    }

    for (const evidence of metadata.evidence ?? []) {
      lines.push(
        `- ${evidence.kind}: ${evidence.label} (\`${evidence.target}\`, ${area.id})`
      )
    }
  }

  return lines
}

const getRelevantAreaLines = (areas: AreaState[]) =>
  areas.map((area) => {
    const metadata = getAreaMetadata(area)
    const title =
      area.type === 'image' ? area.alt || area.id : firstLine(area.text)

    return `- \`${area.id}\` (${metadata.kind}): ${title || area.id}`
  })

const getRelationshipLines = (state: PageAppState) =>
  (state.links ?? []).map((link) => {
    const label = [link.kind, link.label].filter(Boolean).join(', ')

    return `- \`${link.fromAreaId}\` -> \`${link.toAreaId}\`${
      label ? ` (${label})` : ''
    }`
  })

const formatAreaLine = (area: TextAreaState) => {
  const text = normalizeAreaTextForList(area.text)

  return /^[-*+]\s+\[[ x]\]/i.test(text) ? text : `- ${text}`
}

const normalizeAreaTextForList = (text: string) => {
  const trimmedText = text.trim()
  if (!trimmedText) return '(empty)'

  return trimmedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n  ')
}

const firstLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? ''
