import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { platformAuthApi, platformApi, ApiError } from '@/lib/api'

const STORAGE_KEY = 'passage.platformToken'

const PlatformAuthContext = createContext(null)

// Own storage key and context, same reasoning as staff auth — a platform
// admin token is structurally different (no community scope at all) and
// this keeps it from ever being confused with a resident or staff token.
export function PlatformAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [platformAdmin, setPlatformAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadAdmin = useCallback(async (currentToken) => {
    try {
      const { platformAdmin } = await platformApi.me(currentToken)
      setPlatformAdmin(platformAdmin)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setPlatformAdmin(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    loadAdmin(token).finally(() => setLoading(false))
  }, [token, loadAdmin])

  const login = async (payload) => {
    const { token: newToken, platformAdmin } = await platformAuthApi.login(payload)
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setPlatformAdmin(platformAdmin)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setPlatformAdmin(null)
  }

  return (
    <PlatformAuthContext.Provider value={{ token, platformAdmin, loading, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  )
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext)
  if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider')
  return ctx
}
