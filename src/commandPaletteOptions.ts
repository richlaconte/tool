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
