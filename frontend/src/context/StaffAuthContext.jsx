import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { staffAuthApi, staffApi, ApiError } from '@/lib/api'

const STORAGE_KEY = 'passage.staffToken'

const StaffAuthContext = createContext(null)

// Separate storage key and context from resident auth — a staff token and a
// resident token are structurally different (different actorType) and this
// keeps them from ever being confused, same as the backend's own separation.
export function StaffAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadStaff = useCallback(async (currentToken) => {
    try {
      const { staff } = await staffApi.me(currentToken)
      setStaff(staff)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setStaff(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    loadStaff(token).finally(() => setLoading(false))
  }, [token, loadStaff])

  const login = async (payload) => {
    const { token: newToken, staff } = await staffAuthApi.login(payload)
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setStaff(staff)
  }

  const forgotPassword = async (payload) => {
    return staffAuthApi.forgotPassword(payload)
  }

  const resetPassword = async (payload) => {
    return staffAuthApi.resetPassword(payload)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setStaff(null)
  }

  return (
    <StaffAuthContext.Provider value={{ token, staff, loading, login, forgotPassword, resetPassword, logout }}>
      {children}
    </StaffAuthContext.Provider>
  )
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext)
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider')
  return ctx
}
