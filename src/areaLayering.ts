export const SELECTED_AREA_Z_INDEX = 10
export const UNSELECTED_AREA_Z_INDEX = 0

export const getAreaShellZIndex = (isSelected: boolean) =>
  isSelected ? SELECTED_AREA_Z_INDEX : UNSELECTED_AREA_Z_INDEX
