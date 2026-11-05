import { useCallback, useEffect, useRef, useState } from 'react'
import * as Localization from 'expo-localization'
import countryCallingCodes from '../screens/PhoneNumber/countryCodes'

const DEFAULT_CCA2 = 'EG'

const buildCountry = (cca2) => ({
  callingCode: [String(countryCallingCodes?.[cca2] || countryCallingCodes?.[DEFAULT_CCA2] || '20')],
  cca2,
  currency: [],
  flag: 'flag-' + cca2,
  name: cca2,
  region: '',
  subregion: ''
})

// The phone's own region is available instantly and works offline.
const getDeviceCountry = () => {
  try {
    const region = Localization.getLocales?.()[0]?.regionCode?.toUpperCase()
    if (region && countryCallingCodes?.[region]) return region
  } catch (e) {}
  return DEFAULT_CCA2
}

const fetchWithTimeout = async (url, ms = 4000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Country used for the phone-number field.
 * - starts immediately with the device region (Egypt if unknown), so the code is filled in at once;
 * - refines it from the IP address in the background, but never overrides a country the user picked.
 */
export const useCountryFromIP = () => {
  const initial = getDeviceCountry()
  const [country, setCountryState] = useState(() => buildCountry(initial))
  const [currentCountry, setCurrentCountryState] = useState(initial)
  const [ipAddress, setIpAddress] = useState(null)
  const [error, setError] = useState(null)
  const pickedByUser = useRef(false)

  // Called by the picker: from now on the user's choice wins over detection.
  const setCountry = useCallback((value) => {
    pickedByUser.current = true
    setCountryState(value)
  }, [])
  const setCurrentCountry = useCallback((value) => {
    pickedByUser.current = true
    setCurrentCountryState(value)
  }, [])

  const detect = useCallback(async () => {
    try {
      const { ip } = await fetchWithTimeout('https://api.ipify.org/?format=json')
      setIpAddress(ip)
      const info = await fetchWithTimeout(`https://ipinfo.io/${ip}/json`)
      const code = info?.country?.toUpperCase()
      if (code && countryCallingCodes?.[code] && !pickedByUser.current) {
        setCountryState(buildCountry(code))
        setCurrentCountryState(code)
      }
    } catch (err) {
      // Offline or blocked: keep the device region, nothing else to do.
      setError('Failed to get IP address or country.')
    }
  }, [])

  useEffect(() => {
    detect()
  }, [detect])

  const refetch = () => {
    pickedByUser.current = false
    detect()
  }

  return {
    country,
    currentCountry,
    setCurrentCountry,
    ipAddress,
    isLoading: false,
    error,
    refetch,
    setCountry
  }
}
