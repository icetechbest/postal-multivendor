import useEnvVars from '../../../environment'
import { reverseGeocode } from '../../services/osm'

const useGeocoding = () => {
  const { GEOCODING_URL } = useEnvVars()

  const getAddress = async (latitude, longitude) => {
    try {
      return await reverseGeocode(GEOCODING_URL, latitude, longitude)
    } catch (error) {
      console.error('Error fetching address:', error.message)
      throw error
    }
  }

  return { getAddress }
}

export default useGeocoding
