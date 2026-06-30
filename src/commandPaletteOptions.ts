import type {
  CommandPaletteOption,
  CommandPaletteScope,
} from './components/CommandPalette'

export type CascaderyCommandOption = CommandPaletteOption & {
  aliases: string[]
  scope: CommandPaletteScope
}

export const COMMAND_PALETTE_OPTIONS: CascaderyCommandOption[] = [
  {
    id: 'help',
    title: 'Help',
    description: 'Show keyboard shortcuts and editing tips',
    aliases: ['?', 'shortcuts', 'guide', 'instructions'],
    scope: 'global',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Open editor preferences',
    aliases: ['preferences', 'configure editor', 'options'],
    scope: 'global',
  },
  {
    id: 'page-styles',
    title: 'Page styles',
    description: 'Manage page-wide appearance',
    aliases: ['appearance', 'page settings', 'background', 'theme'],
    scope: 'page',
  },
  {
    id: 'agent-suggestions',
    title: 'Agent suggestions',
    description: 'Review a suggested decision-log patch',
    aliases: ['ai', 'assistant', 'mcp', 'suggestions'],
    scope: 'global',
  },
  {
    id: 'share',
    title: 'Share',
    description: 'Create edit and view-only links',
    aliases: ['copy link', 'invite', 'collaborate', 'links'],
    scope: 'global',
  },
  {
    id: 'history',
    title: 'History',
    description: 'Review recent changes and undo reversible patches',
    aliases: ['timeline', 'changes', 'versions', 'undo'],
    scope: 'global',
  },
  {
    id: 'insert-context-kit',
    title: 'Insert context kit',
    description: 'Start from a developer workflow kit',
    aliases: ['template', 'starter', 'kit', 'implementation map'],
    scope: 'page',
  },
  {
    id: 'agent-handoff',
    title: 'Create agent handoff brief',
    description: 'Preview and copy a structured Markdown brief',
    aliases: ['handoff', 'brief', 'agent brief', 'copy markdown'],
    scope: 'page',
  },
  {
    id: 'set-area-type',
    title: 'Set Area type',
    description: 'Choose metadata for the selected Area',
    aliases: ['type', 'metadata', 'status', 'area kind'],
    scope: 'area',
  },
  {
    id: 'link-selected-area',
    title: 'Link selected Area',
    description: 'Connect the selected Area to another Area',
    aliases: ['link area', 'relationship', 'connect', 'reference'],
    scope: 'area',
  },
  {
    id: 'add-evidence',
    title: 'Add evidence to selected Area',
    description: 'Attach a file, URL, issue, PR, commit, or command reference',
    aliases: ['ref', 'reference', 'anchor', 'file reference', 'evidence'],
    scope: 'area',
  },
  {
    id: 'toggle-snap-grid',
    title: 'Toggle snap grid',
    description: 'Snap Area movement and resizing to page grid',
    aliases: ['grid', 'snap', 'alignment'],
    scope: 'page',
  },
  {
    id: 'insert-image',
    title: 'Insert image',
    description: 'Add a movable image to the page',
    aliases: ['image', 'photo', 'picture', 'upload image'],
    scope: 'page',
  },
  {
    id: 'zoom-in',
    title: 'Zoom in',
    description: 'Increase canvas zoom',
    aliases: ['closer', 'magnify', 'increase zoom'],
    scope: 'page',
  },
  {
    id: 'zoom-out',
    title: 'Zoom out',
    description: 'Decrease canvas zoom',
    aliases: ['farther', 'decrease zoom', 'reduce zoom'],
    scope: 'page',
  },
  {
    id: 'reset-zoom',
    title: 'Reset zoom',
    description: 'Return the canvas to 100%',
    aliases: ['actual size', '100%', 'normal zoom'],
    scope: 'page',
  },
  {
    id: 'zoom-to-fit',
    title: 'Zoom to fit',
    description: 'Fit all Areas in view',
    aliases: ['fit page', 'fit canvas', 'show all'],
    scope: 'page',
  },
  {
    id: 'zoom-to-selection',
    title: 'Zoom to selection',
    description: 'Center the selected Area',
    aliases: ['selected area', 'center selection', 'focus area'],
    scope: 'area',
  },
]
