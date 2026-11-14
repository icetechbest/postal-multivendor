import { Dimensions } from 'react-native'

const SCREEN_HEIGHT = Dimensions.get('screen').height

// Height of the "active order" bottom sheet. It was 1/4 of the screen, which left a large
// empty area inside the sheet and covered the content behind it. It is capped to what the
// content needs; screens add the same amount as bottom margin so nothing is hidden.
export const ACTIVE_ORDERS_SHEET_HEIGHT = Math.min(Math.floor(SCREEN_HEIGHT / 4), 170)
