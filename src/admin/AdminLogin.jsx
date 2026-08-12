import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Lock } from 'lucide-react'
import { useAdminAuth } from '../context/AdminAuthContext'

// Reachable only at /admin/login — never linked from the public site.
export default function AdminLogin() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Welcome back')
      navigate('/admin/dashboard')
    } catch {
      toast.error('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-ivory p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-wine/10 flex items-center justify-center mb-3">
            <Lock size={20} className="text-wine" />
          </div>
          <span className="font-display text-2xl">The KAVSI</span>
          <p className="text-xs text-stone uppercase tracking-widest2 mt-1">Admin Panel</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Username</span>
            <input required value={username} onChange={(e) => setUsername(e.target.value)} className="input-field mt-1.5" autoComplete="username" />
          </label>
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Password</span>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field mt-1.5" autoComplete="current-password" />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
