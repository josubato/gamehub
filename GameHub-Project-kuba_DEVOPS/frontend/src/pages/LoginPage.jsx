import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Uzupełnij dane poprawnie')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hub-bg relative overflow-hidden pt-20">


      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(var(--hub-accent) 1px, transparent 1px), linear-gradient(90deg, var(--hub-accent) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative w-full max-w-md px-4 py-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="GameHub"
            className="h-40 w-auto mx-auto"
          />
          <p className="text-hub-muted text-sm mt-2 font-body">Internetowe forum dla graczy</p>
        </div>

        <div className="hub-card p-8 accent-glow">
          <h2 className="font-display text-xl font-semibold text-hub-text mb-6 uppercase tracking-wider">
            Logowanie
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-hub-danger text-hub-danger text-sm font-body">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Email</label>
              <input
                type="email"
                className="hub-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="twoj@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Hasło</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="hub-input pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hub-muted hover:text-hub-text transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={e => setShowPassword(e.target.checked)}
                  className="w-3 h-3 accent-green-400"
                />
                <span className="text-xs text-hub-muted">Pokaż hasło</span>
              </label>
            </div>


            <button
              type="submit"
              disabled={loading}
              className="hub-btn-primary w-full py-3 text-sm font-display uppercase tracking-widest disabled:opacity-50"
            >
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>

          <p className="text-center mt-4 text-hub-muted text-xs font-body">
            Nie masz konta?{' '}
            <Link to="/register" className="text-hub-accent hover:underline">
              Zarejestruj się
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
