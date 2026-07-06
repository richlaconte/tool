// MCP App template (Apps extension, 2026-07-28 revision).
//
// Renders one self-contained HTML view for sandboxed-iframe MCP App hosts:
// the page outline plus pending agent proposals. The document embeds all
// styling and scripting inline and makes zero external network requests,
// matching the app's no-CDN posture. Accept/reject buttons only post a
// review intent to the host via postMessage; the host performs the review
// through the existing MCP tools under the caller's token scope, so this
// view adds no mutation paths and inherits attribution and audit from the
// existing proposal-review flow.
import { getPageOutline, type PageOutlineItem } from './pageOutline.ts'
import type { PageAppState } from './pagePersistence.ts'

export const MCP_APP_HTML_MIME_TYPE = 'text/html'

export const MCP_APP_PROPOSAL_MESSAGE_TYPE = 'cascadery:proposal-review'

export type McpAppTask = {
  id: string
  toolName: string
  status: string
  createdAt: string
  result?: unknown
  error?: string | null
}

export type McpAppPendingProposal = {
  taskId: string
  patchId: string
  displayName: string
  operationCount: number
  createdAt: string
}

export const getMcpAppPendingProposals = (
  tasks: McpAppTask[]
): McpAppPendingProposal[] =>
  tasks.flatMap((task) => {
    if (task.status !== 'completed') return []

    const patch = task.result

    if (
      !isRecord(patch) ||
      typeof patch.id !== 'string' ||
      !Array.isArray(patch.operations)
    ) {
      return []
    }

    const source = isRecord(patch.source) ? patch.source : {}

    return [
      {
        taskId: task.id,
        patchId: patch.id,
        displayName:
          typeof source.displayName === 'string'
            ? source.displayName
            : 'Agent',
        operationCount: patch.operations.length,
        createdAt: task.createdAt,
      },
    ]
  })

export const renderMcpAppHtml = (
  state: PageAppState,
  { tasks = [] }: { tasks?: McpAppTask[] } = {}
) => {
  const outline = getPageOutline(state)
  const proposals = getMcpAppPendingProposals(tasks)
  const workingTasks = tasks.filter((task) => task.status === 'working')
  const journalTail = (state.journal ?? []).slice(-5).reverse()

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>${escapeHtml(state.page.title)} — Cascadery</title>
<style>
body { font-family: system-ui, sans-serif; margin: 16px; color: #0f172a; }
h1 { font-size: 16px; margin: 0 0 12px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin: 20px 0 8px; }
ul.outline, ul.outline ul { list-style: none; margin: 0; padding-left: 16px; }
ul.outline { padding-left: 0; }
.outline li { padding: 2px 0; }
.outline .kind { color: #64748b; font-size: 11px; margin-left: 6px; }
.outline .status { color: #2563eb; font-size: 11px; margin-left: 6px; }
.proposal, .task, .journal-entry { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin: 6px 0; font-size: 13px; }
.proposal button { font: inherit; margin-right: 6px; padding: 2px 10px; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }
.proposal button[data-action="accept"] { border-color: #2563eb; color: #2563eb; }
.empty { color: #64748b; font-size: 13px; }
</style>
</head>
<body>
<h1>${escapeHtml(state.page.title)}</h1>
<h2>Outline</h2>
${renderOutline(outline)}
<h2>Pending proposals</h2>
${renderProposals(proposals)}
${renderWorkingTasks(workingTasks)}
<h2>Agent journal</h2>
${renderJournal(journalTail)}
<script>
(function () {
  document.addEventListener('click', function (event) {
    var target = event.target
    if (!(target instanceof HTMLElement)) return
    var action = target.getAttribute('data-action')
    if (action !== 'accept' && action !== 'reject') return
    window.parent.postMessage(
      {
        type: '${MCP_APP_PROPOSAL_MESSAGE_TYPE}',
        action: action,
        taskId: target.getAttribute('data-task-id'),
        patchId: target.getAttribute('data-patch-id'),
      },
      '*'
    )
  })
})()
</script>
</body>
</html>
`
}

const renderOutline = (items: PageOutlineItem[]): string => {
  if (items.length === 0) {
    return '<p class="empty">No Areas yet.</p>'
  }

  return `<ul class="outline">${items
    .map(
      (item) =>
        `<li>${escapeHtml(item.title)}<span class="kind">${escapeHtml(
          item.kind
        )}</span>${
          item.status
            ? `<span class="status">${escapeHtml(item.status)}</span>`
            : ''
        }${item.children.length > 0 ? renderOutline(item.children) : ''}</li>`
    )
    .join('')}</ul>`
}

const renderProposals = (proposals: McpAppPendingProposal[]) => {
  if (proposals.length === 0) {
    return '<p class="empty">No pending proposals.</p>'
  }

  return proposals
    .map(
      (proposal) => `<div class="proposal">
<div>${escapeHtml(proposal.displayName)} proposed ${proposal.operationCount} operation${proposal.operationCount === 1 ? '' : 's'} at ${escapeHtml(proposal.createdAt)}.</div>
<div>
<button type="button" data-action="accept" data-task-id="${escapeHtml(proposal.taskId)}" data-patch-id="${escapeHtml(proposal.patchId)}">Accept</button>
<button type="button" data-action="reject" data-task-id="${escapeHtml(proposal.taskId)}" data-patch-id="${escapeHtml(proposal.patchId)}">Reject</button>
</div>
</div>`
    )
    .join('\n')
}

const renderWorkingTasks = (tasks: McpAppTask[]) => {
  if (tasks.length === 0) return ''

  return tasks
    .map(
      (task) =>
        `<div class="task">${escapeHtml(task.toolName)} is still working (started ${escapeHtml(task.createdAt)}).</div>`
    )
    .join('\n')
}

const renderJournal = (
  entries: NonNullable<PageAppState['journal']>
) => {
  if (entries.length === 0) {
    return '<p class="empty">No journal entries yet.</p>'
  }

  return entries
    .map(
      (entry) =>
        `<div class="journal-entry">${escapeHtml(entry.actor.name)} — ${escapeHtml(entry.text)} <span class="kind">${escapeHtml(entry.createdAt)}</span></div>`
    )
    .join('\n')
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
