import { createContext, useContext, useState } from 'react'
import { adminLogin as apiAdminLogin } from '../services/api'

const AdminAuthContext = createContext(null)
const TOKEN_KEY = 'kavsi_admin_token'

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))

  async function login(username, password) {
    const { token: newToken } = await apiAdminLogin(username, password)
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    return newToken
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  return (
    <AdminAuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
