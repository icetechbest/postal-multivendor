// Safety net: whatever the country detection / picker returns, the phone field never
// ends up with "undefined". Egypt is the fallback.
export const FALLBACK_CCA2 = 'EG'
export const FALLBACK_DIAL = '20'

export const safeCca2 = (value) => (typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : FALLBACK_CCA2)

export const safeDialCode = (country) => {
  const raw = Array.isArray(country?.callingCode) ? country.callingCode[0] : country?.callingCode
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 1 && digits.length <= 4 ? digits : FALLBACK_DIAL
}

export const safeCountry = (country, cca2) => {
  const code = safeCca2(country?.cca2 || cca2)
  return { ...(country || {}), cca2: code, name: country?.name || code, flag: country?.flag || 'flag-' + code, callingCode: [safeDialCode(country)] }
}
