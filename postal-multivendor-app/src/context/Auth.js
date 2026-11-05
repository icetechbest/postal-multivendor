import React, { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'


const AuthContext = React.createContext()

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null)
  const [tokenLoaded, setTokenLoaded] = useState(false)

  const setTokenAsync = async token => {
    await AsyncStorage.setItem('token', token)
    setToken(token)
  }

  useEffect(() => {
    let isSubscribed = true
    ;(async() => {
      const token = await AsyncStorage.getItem('token')
      if (!isSubscribed) return
      setToken(token)
      setTokenLoaded(true)
    })()
    return () => {
      isSubscribed = false
    }
  }, [])

  return (
    <AuthContext.Provider value={{ token, setToken, setTokenAsync, tokenLoaded }}>
      {children}
    </AuthContext.Provider>
  )
}

export const AuthConsumer = AuthContext.Consumer
export default AuthContext
