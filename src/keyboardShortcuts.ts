export type KeyboardShortcut = {
  combo: string
  description: string
  paletteAction: string
  commandId?: string
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    combo: 'Cmd/Ctrl+K',
    description: 'Open command palette',
    paletteAction: 'Command palette',
  },
  {
    combo: 'Cmd/Ctrl+F',
    description: 'Search Areas',
    paletteAction: 'Search Areas',
    commandId: 'search-areas',
  },
  {
    combo: '?',
    description: 'Open keyboard shortcuts',
    paletteAction: 'Keyboard shortcuts',
    commandId: 'help',
  },
  {
    combo: 'Esc',
    description: 'Deselect the current Area or open commands',
    paletteAction: 'Command palette',
  },
  {
    combo: 'Arrow keys',
    description: 'Move selected Areas by one pixel',
    paletteAction: 'Move selected Area',
  },
  {
    combo: 'Shift+Arrow',
    description: 'Move selected Areas faster or by the active grid',
    paletteAction: 'Move selected Area',
  },
  {
    combo: 'Alt+Arrow',
    description: 'Resize the selected Area from the bottom-right corner',
    paletteAction: 'Resize selected Area',
  },
  {
    combo: 'Shift+1',
    description: 'Zoom to fit the page',
    paletteAction: 'Zoom to fit page',
    commandId: 'zoom-to-fit',
  },
  {
    combo: 'Shift+2',
    description: 'Zoom to the current selection',
    paletteAction: 'Zoom to selection',
    commandId: 'zoom-to-selection',
  },
]

export const getKeyboardShortcutForCommand = (commandId: string) =>
  KEYBOARD_SHORTCUTS.find(
    (shortcut) => shortcut.commandId === commandId
  )?.combo ?? null
