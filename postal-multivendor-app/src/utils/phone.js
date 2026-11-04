/**
 * Builds an E.164 phone number from a country calling code and what the user typed.
 * Leading zeros are dropped ("01012345678" + "20" -> "+201012345678") because the
 * trunk prefix is not part of the international number.
 */
export const buildPhoneNumber = (callingCode, nationalNumber) => {
  const digits = String(nationalNumber || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
  const code = String(callingCode || '').replace(/\D/g, '')
  return {
    digits,
    full: digits && code ? `+${code}${digits}` : ''
  }
}

/** Picks a readable message out of an Apollo error. */
export const getApolloErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message || error?.networkError?.result?.errors?.[0]?.message || fallback
