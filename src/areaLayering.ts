export const SELECTED_AREA_Z_INDEX = 10
export const UNSELECTED_AREA_Z_INDEX = 0
export const NESTED_AREA_Z_INDEX_STEP = 20

export const getAreaShellZIndex = (
  isSelected: boolean,
  nestingDepth = 0
) =>
  Math.max(0, nestingDepth) * NESTED_AREA_Z_INDEX_STEP +
  (isSelected ? SELECTED_AREA_Z_INDEX : UNSELECTED_AREA_Z_INDEX)
