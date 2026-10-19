import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../utils/api'

export default function VerifyPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = params.get('code')
    const user_id = params.get('user_id')
    if (!code || !user_id) {
      setStatus('error')
      setMessage('Nieprawidłowy link weryfikacyjny')
      return
    }
    api.get(`/auth/verify?code=${code}&user_id=${user_id}`)
      .then(res => { setStatus('success'); setMessage(res.data.message) })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.error || 'Wystąpił błąd') })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-hub-bg pt-20">

      <div className="hub-card p-8 max-w-md w-full mx-4 text-center">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-2 border-hub-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-hub-muted font-body">Weryfikacja konta...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-950/50 border border-hub-accent flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-hub-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-hub-accent mb-2">Email zweryfikowany!</h2>
            <p className="text-hub-muted text-sm font-body mb-6">{message}</p>
            <Link to="/login" className="hub-btn-primary inline-block">Zaloguj się</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-950/50 border border-hub-danger flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-hub-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-hub-danger mb-2">Weryfikacja nieudana</h2>
            <p className="text-hub-muted text-sm font-body mb-6">{message}</p>
            <Link to="/register" className="hub-btn-primary inline-block">Zarejestruj się ponownie</Link>
          </>
        )}
      </div>
    </div>
  )
}
