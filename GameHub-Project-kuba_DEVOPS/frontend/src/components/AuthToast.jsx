import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function AuthToast({ message, onClose }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2700)
    const closeTimer = setTimeout(() => onClose(), 3000)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(closeTimer)
    }
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-hub-accent/40 bg-hub-card shadow-2xl max-w-xs
          ${exiting ? 'toast-exit' : 'toast-enter'}`}
        style={{ boxShadow: '0 0 30px rgba(0,255,135,0.2)' }}
      >
        {/* Icon */}
        <div className="w-8 h-8 rounded-full bg-hub-accent/10 border border-hub-accent/30 flex items-center justify-center flex-shrink-0">
          <span className="text-base">🎮</span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-hub-text text-xs font-display uppercase tracking-wider">
            {message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Link
              to="/login"
              className="text-hub-accent text-xs font-body hover:underline"
              onClick={onClose}
            >
              Zaloguj się
            </Link>
            <span className="text-hub-muted text-xs">·</span>
            <Link
              to="/register"
              className="text-hub-muted text-xs font-body hover:text-hub-accent transition-colors"
              onClick={onClose}
            >
              Rejestracja
            </Link>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={() => { setExiting(true); setTimeout(onClose, 300) }}
          className="text-hub-muted hover:text-hub-danger transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-hub-border rounded-b-xl overflow-hidden">
          <div
            className="h-full bg-hub-accent rounded-full"
            style={{ animation: 'shrink 3s linear forwards' }}
          />
        </div>
      </div>
    </div>
  )
}