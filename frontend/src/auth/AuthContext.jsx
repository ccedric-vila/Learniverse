import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
export const api = axios.create({ baseURL: API_URL })
const AuthContext = createContext(null)
const TOKEN_KEY = 'sts_lms_token'

function saveToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    axios.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    localStorage.removeItem(TOKEN_KEY)
    delete api.defaults.headers.common.Authorization
    delete axios.defaults.headers.common.Authorization
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return undefined
    }

    saveToken(token)
    let active = true
    api.get('/auth/me')
      .then(({ data }) => {
        if (active) setUser(data.user)
      })
      .catch(() => {
        if (active) {
          saveToken(null)
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [token])

  async function authenticate(endpoint, credentials) {
    const { data } = await api.post(`/auth/${endpoint}`, credentials)
    saveToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  async function login(credentials) {
    return authenticate('login', credentials)
  }

  async function register(details) {
    const { data } = await api.post('/auth/register', details)
    return data
  }

  async function verifyRegistration(details) {
    return authenticate('register/verify', details)
  }

  async function googleLogin(credential) {
    return authenticate('google', { credential })
  }

  async function updateProfile(details) {
    const { data } = await api.put('/auth/profile', details)
    setUser(data.user)
    return data.user
  }

  function logout() {
    saveToken(null)
    setToken(null)
    setUser(null)
  }

  const value = useMemo(() => ({
    user,
    token,
    loading,
    login,
    register,
    verifyRegistration,
    googleLogin,
    updateProfile,
    logout,
  }), [user, token, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}