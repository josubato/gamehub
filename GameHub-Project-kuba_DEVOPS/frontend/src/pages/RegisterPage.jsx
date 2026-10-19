import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ReCAPTCHA from 'react-google-recaptcha'

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
  </svg>
)

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirm_password: '', nick: '' })
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const recaptchaRef = useRef(null)

const validate = () => {
  const e = {}
  if (!form.email) e.email = 'Email jest wymagany'
  const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|]).{8,}$/
  if (!form.password || !passwordRegex.test(form.password)) {
    e.password = 'Hasło musi mieć min. 8 znaków, wielką literę, cyfrę i znak specjalny'
  }
  if (form.password !== form.confirm_password) e.confirm_password = 'Hasła nie są zgodne'
  if (!form.nick || form.nick.length < 3) e.nick = 'Nick musi mieć minimum 3 znaki'
  if (!captchaToken) e.captcha = 'Potwierdź że nie jesteś robotem'
  setErrors(e)
  return Object.keys(e).length === 0
}

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGlobalError('')
    if (!validate()) return
    setLoading(true)
    try {
      const res = await register({ ...form, captchaToken })
      setSuccess(res.message)
    } catch (err) {
      setGlobalError(err.response?.data?.error || 'Wystąpił błąd. Spróbuj ponownie.')
      recaptchaRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hub-bg pt-20">
        <div className="hub-card p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-950/50 border border-hub-accent flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-hub-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-hub-accent mb-2">Konto utworzone!</h2>
          <p className="text-hub-muted text-sm font-body mb-6">{success}</p>
          <Link to="/login" className="hub-btn-primary inline-block">Przejdź do logowania</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hub-bg relative overflow-hidden py-8 pt-24">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(var(--hub-accent) 1px, transparent 1px), linear-gradient(90deg, var(--hub-accent) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative w-full max-w-md px-4">
        <div className="text-center mb-8">
          <Link to="/login">
            <img src="/logo.png" alt="GameHub" className="h-32 w-auto mx-auto" />
          </Link>
          <p className="text-hub-muted text-sm mt-2">Dołącz do społeczności graczy</p>
        </div>

        <div className="hub-card p-8 accent-glow">
          <h2 className="font-display text-xl font-semibold text-hub-text mb-6 uppercase tracking-wider">Rejestracja</h2>

          {globalError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-hub-danger text-hub-danger text-sm">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Email</label>
              <input
                type="email"
                name="email"
                className={`hub-input ${errors.email ? 'border-hub-danger' : ''}`}
                value={form.email}
                onChange={handleChange}
                placeholder="twoj@email.com"
              />
              {errors.email && <p className="text-hub-danger text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Nick */}
            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Nick (min. 3 znaki)</label>
              <input
                type="text"
                name="nick"
                className={`hub-input ${errors.nick ? 'border-hub-danger' : ''}`}
                value={form.nick}
                onChange={handleChange}
                placeholder="GameMaster123"
              />
              {errors.nick && <p className="text-hub-danger text-xs mt-1">{errors.nick}</p>}
            </div>

            {/* Hasło */}
            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Hasło (min. 6 znaków)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className={`hub-input pr-10 ${errors.password ? 'border-hub-danger' : ''}`}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hub-muted hover:text-hub-text transition-colors"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} className="w-3 h-3 accent-green-400" />
                <span className="text-xs text-hub-muted">Pokaż hasło</span>
              </label>
              {errors.password && <p className="text-hub-danger text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Potwierdź hasło */}
            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Potwierdź hasło</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm_password"
                  className={`hub-input pr-10 ${errors.confirm_password ? 'border-hub-danger' : ''}`}
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hub-muted hover:text-hub-text transition-colors"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={showConfirmPassword} onChange={e => setShowConfirmPassword(e.target.checked)} className="w-3 h-3 accent-green-400" />
                <span className="text-xs text-hub-muted">Pokaż hasło</span>
              </label>
              {errors.confirm_password && <p className="text-hub-danger text-xs mt-1">{errors.confirm_password}</p>}
            </div>

            {/* reCAPTCHA */}
            <div>
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey="6LchAu8sAAAAANdB8aiBdB_AFnTZqta1d1XNUOYz"
                onChange={token => { setCaptchaToken(token); setErrors(p => ({ ...p, captcha: '' })) }}
                onExpired={() => setCaptchaToken(null)}
                theme="dark"
              />
              {errors.captcha && <p className="text-hub-danger text-xs mt-1">{errors.captcha}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="hub-btn-primary w-full py-3 text-sm font-display uppercase tracking-widest disabled:opacity-50"
            >
              {loading ? 'Rejestracja...' : 'Zarejestruj się'}
            </button>
          </form>

          <p className="text-center mt-4 text-hub-muted text-xs">
            Masz już konto?{' '}
            <Link to="/login" className="text-hub-accent hover:underline">Zaloguj się</Link>
          </p>
        </div>
      </div>
    </div>
  )
}