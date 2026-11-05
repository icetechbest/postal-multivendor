import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { restaurant } from '../../apollo/queries'

const RESTAURANT = gql`
  ${restaurant}
`

// Browsing screens show the cached restaurant instantly and refresh it in the background.
// Cart / Checkout pass 'network-only' because prices and opening state must be fresh there.
export default function useRestaurant(id, fetchPolicy = 'cache-and-network') {
  const { data, refetch, networkStatus, loading, error } = useQuery(
    RESTAURANT,
    { variables: { id }, fetchPolicy, nextFetchPolicy: 'cache-first' }
  )
  // Only report "loading" while there is nothing to show yet.
  return { data, refetch, networkStatus, loading: loading && !data, error }
}
