import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi, residentsApi, ApiError } from '@/lib/api'

const STORAGE_KEY = 'passage.token'

const AuthContext = createContext(null)

// Token lives in localStorage since the API only issues bearer JWTs (no
// httpOnly cookie session exists on the backend) — the usual XSS tradeoff
// of that approach applies and would need a backend change to avoid.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [resident, setResident] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadResident = useCallback(async (currentToken) => {
    try {
      const { resident } = await residentsApi.me(currentToken)
      setResident(resident)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setResident(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    loadResident(token).finally(() => setLoading(false))
  }, [token, loadResident])

  const login = async (payload) => {
    const { token: newToken, resident } = await authApi.login(payload)
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setResident(resident)
  }

  const register = async (payload) => {
    const { token: newToken, resident } = await authApi.register(payload)
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setResident(resident)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setResident(null)
  }

  const refreshResident = () => loadResident(token)

  return (
    <AuthContext.Provider value={{ token, resident, loading, login, register, logout, refreshResident, setResident }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
