// EARS (Easy Approach to Requirements Syntax) scaffolds and gentle lint
// for `requirement` Areas (SDD fidelity spec).
//
// EARS is a writing discipline, not a schema: scaffolds insert editable
// plain text, and the lint below only produces dismissible hints — never a
// blocker, never an auto-rewrite. The rule list is deliberately small and
// biased toward the classic "untestable vagueness" catches; each rule is
// documented inline and has a firing case and a passing counterexample in
// earsLint.test.ts.

export type EarsTemplate = {
  id: string
  label: string
  text: string
}

// The five EARS patterns (Mavin et al.), as editable text templates. The
// leading "Requirement:" prefix is stripped by the SDD exporters' title
// logic, mirroring the existing Decision:/Task: conventions.
export const EARS_TEMPLATES: EarsTemplate[] = [
  {
    id: 'ubiquitous',
    label: 'Ubiquitous',
    text: 'Requirement: The system shall <response>.',
  },
  {
    id: 'event-driven',
    label: 'Event-driven (When)',
    text: 'Requirement: When <trigger>, the system shall <response>.',
  },
  {
    id: 'state-driven',
    label: 'State-driven (While)',
    text: 'Requirement: While <state>, the system shall <response>.',
  },
  {
    id: 'optional-feature',
    label: 'Optional feature (Where)',
    text: 'Requirement: Where <feature is included>, the system shall <response>.',
  },
  {
    id: 'unwanted-behavior',
    label: 'Unwanted behavior (If/Then)',
    text: 'Requirement: If <unwanted condition>, then the system shall <response>.',
  },
]

export type EarsLintHint = {
  ruleId: string
  message: string
}

type EarsLintRule = {
  id: string
  message: string
  test: (text: string) => boolean
}

const VAGUE_TERMS = [
  'fast',
  'quick',
  'easy',
  'user-friendly',
  'intuitive',
  'robust',
  'efficient',
  'seamless',
  'flexible',
  'reliable',
]

const VAGUE_ADVERBS = [
  'quickly',
  'easily',
  'appropriately',
  'adequately',
  'properly',
  'gracefully',
]

const UNBOUNDED_TIMING = [
  'as soon as possible',
  'in a timely manner',
  'timely',
]

const OPTIMIZATION_VERBS = ['minimize', 'maximize', 'optimize']

const wordPattern = (words: string[]) =>
  new RegExp(`\\b(${words.join('|')})\\b`, 'i')

const VAGUE_TERM_PATTERN = wordPattern(VAGUE_TERMS)
const VAGUE_ADVERB_PATTERN = wordPattern(VAGUE_ADVERBS)
const UNBOUNDED_TIMING_PATTERN = new RegExp(
  `\\b(${UNBOUNDED_TIMING.join('|')})\\b`,
  'i'
)
const OPTIMIZATION_PATTERN = wordPattern(OPTIMIZATION_VERBS)
const MODAL_PATTERN = /\b(shall|must)\b/gi
const WEAK_MODAL_PATTERN = /\b(should|may|might|could)\b/i

const EARS_LINT_RULES: EarsLintRule[] = [
  {
    // 1. A requirement needs a binding modal ("shall"; "must" per Spec Kit).
    id: 'missing-shall',
    message:
      'No "shall" (or "must") found — a requirement needs a binding modal.',
    test: (text) => !/\b(shall|must)\b/i.test(text),
  },
  {
    // 2. Weak modals make requirements optional by accident.
    id: 'weak-modal',
    message:
      'Weak modal ("should", "may", "might", "could") — prefer "shall" for binding requirements.',
    test: (text) => WEAK_MODAL_PATTERN.test(text),
  },
  {
    // 3. Classic untestable adjectives.
    id: 'vague-term',
    message:
      'Vague quality term (e.g. "fast", "robust", "user-friendly") — replace with a measurable criterion.',
    test: (text) => VAGUE_TERM_PATTERN.test(text),
  },
  {
    // 4. Untestable adverbs.
    id: 'vague-adverb',
    message:
      'Vague adverb (e.g. "quickly", "properly", "gracefully") — state the observable behavior instead.',
    test: (text) => VAGUE_ADVERB_PATTERN.test(text),
  },
  {
    // 5. Open-ended lists cannot be verified complete.
    id: 'open-ended',
    message:
      'Open-ended list ("etc.", "and so on", "...") — enumerate the cases.',
    test: (text) =>
      /\betc\.?(\s|$)/i.test(text) ||
      /\band so on\b/i.test(text) ||
      text.includes('...'),
  },
  {
    // 6. "and/or" leaves the required behavior ambiguous.
    id: 'and-or',
    message: '"and/or" is ambiguous — split into separate requirements.',
    test: (text) => /\band\/or\b/i.test(text),
  },
  {
    // 7. Two binding modals usually means two requirements in one Area.
    id: 'compound-requirement',
    message:
      'Multiple "shall"/"must" clauses — split into one requirement per Area so tasks can trace to each.',
    test: (text) => (text.match(MODAL_PATTERN) ?? []).length >= 2,
  },
  {
    // 8. Placeholders are fine while drafting but flag them for review.
    id: 'tbd-marker',
    message: 'Contains TBD/TBC — resolve before implementation.',
    test: (text) =>
      /\b(TBD|TBC)\b/.test(text) ||
      /\bto be (determined|decided|confirmed)\b/i.test(text),
  },
  {
    // 9. Unbounded timing cannot be tested.
    id: 'unbounded-timing',
    message:
      'Unbounded timing ("as soon as possible", "timely") — state a bound.',
    test: (text) => UNBOUNDED_TIMING_PATTERN.test(text),
  },
  {
    // 10. Optimization verbs without a target are unverifiable.
    id: 'optimization-verb',
    message:
      '"minimize"/"maximize"/"optimize" without a target is unverifiable — state the threshold.',
    test: (text) => OPTIMIZATION_PATTERN.test(text),
  },
]

export const EARS_LINT_RULE_IDS = EARS_LINT_RULES.map((rule) => rule.id)

export const lintEarsRequirement = (text: string): EarsLintHint[] => {
  const trimmed = text.trim()

  if (!trimmed) return []

  // Scaffold placeholders (<trigger>, <response>) are expected while the
  // user is still filling in a template — stay quiet until they finish.
  if (/<[^>]+>/.test(trimmed)) return []

  return EARS_LINT_RULES.filter((rule) => rule.test(trimmed)).map(
    (rule) => ({
      ruleId: rule.id,
      message: rule.message,
    })
  )
}
