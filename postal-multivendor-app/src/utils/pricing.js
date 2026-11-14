import { calculateDistance } from './customFunctions'

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Mirrors backend placeOrder: free delivery / pickup -> 0, otherwise
// max(minFee, km * ratePerKm) rounded to a whole number.
export function calcDeliveryFee({ restaurant, configuration, location, isPickup }) {
  if (isPickup || restaurant?.freeDelivery) return 0
  const coords = restaurant?.location?.coordinates
  if (!coords || !location) return 0
  const km = calculateDistance(Number(coords[1]), Number(coords[0]), Number(location.latitude), Number(location.longitude))
  const rate = Number(configuration?.deliveryRatePerKm)
  const minFee = Number(configuration?.deliveryMinFee)
  if (Number.isFinite(rate) && Number.isFinite(minFee)) return Math.round(Math.max(minFee, km * rate))
  // Older server without the new fields.
  const fallback = Number(configuration?.deliveryRate) || 0
  return configuration?.costType === 'fixed' ? fallback : Math.ceil(km) * fallback
}

// Mirrors backend placeOrder: tax is on the item subtotal (before coupon, excluding delivery).
export const calcTax = (itemsSubtotal, taxRate) => Math.round(Number(itemsSubtotal) * Number(taxRate || 0)) / 100
