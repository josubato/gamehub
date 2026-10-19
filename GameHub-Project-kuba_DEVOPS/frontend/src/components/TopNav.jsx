import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AddPostModal from './AddPostModal'

/**
 * TopNav — wspólna nawigacja dla Landing, Login, Register, Verify, Casino, HomePage.
 *
 * Props:
 *   - balance (number, optional) — jeśli podane, pokazuje pigułę z balance (używane na casino)
 *   - variant (string, optional) — 'transparent' | 'solid' (default: 'solid')
 *     transparent = tło staje się solidne dopiero po scrollu (dla hero sections na landing)
 *
 * Zachowania:
 *   - Logo GAMEHUB zawsze linkuje do '/'
 *   - Linki: Feed (tylko zalogowani), Casino (zawsze)
 *   - Active route podświetlony
 *   - Zalogowany: avatar + dropdown (Wyloguj)
 *   - Gość: przyciski Zaloguj + Rejestracja
 *   - Mobile: hamburger z slide-in menu
 */

const AVATAR_SVG = (
  <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
    <circle cx="20" cy="20" r="20" fill="#1e1e2e" />
    <circle cx="20" cy="16" r="7" fill="#00ff87" opacity="0.8" />
    <ellipse cx="20" cy="35" rx="12" ry="9" fill="#00ff87" opacity="0.5" />
  </svg>
)

export default function TopNav({ variant = 'solid', onPublished }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const userMenuRef = useRef(null)

  // Scroll detection dla transparent variant
  useEffect(() => {
    if (variant !== 'transparent') return
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [variant])

  // Close user menu on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', onClick)
      return () => document.removeEventListener('mousedown', onClick)
    }
  }, [userMenuOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [mobileOpen])

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Links dostępne dla danego usera
  const links = [].filter(Boolean)

  const bgClass = variant === 'transparent'
    ? (scrolled ? 'backdrop-blur-xl bg-hub-bg/70 border-b border-hub-border' : 'bg-transparent')
    : 'backdrop-blur-xl bg-hub-bg/80 border-b border-hub-border'

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${bgClass}`}
      >
        <div className="px-4 md:px-12 py-1 flex items-center justify-between gap-4">
          {/* Logo + ikona domku */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <img
              src="/logo.png"
              alt="GameHub"
              className="h-20 w-auto"
            />
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {links.map((link) => {
              const active = isActive(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-lg text-sm font-display uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-hub-accent/10 text-hub-accent border border-hub-accent/30'
                      : 'text-hub-muted hover:text-hub-text border border-transparent'
                  }`}
                >
                  <span className="mr-1.5">{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right: balance + auth */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">

            {/* Przycisk Dodaj Post — tylko zalogowani */}
            {user && (
              <button
                onClick={() => setShowAddModal(true)}
                className="hub-btn-primary flex items-center gap-2 text-xs"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Dodaj Post
              </button>
            )}

            {/* Auth section — desktop */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <div ref={userMenuRef} className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-hub-border hover:border-hub-accent/40 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-hub-border">
                      {AVATAR_SVG}
                    </div>
                    <span className="green-nick text-sm max-w-[120px] truncate">{user.nick}</span>
                    <svg
                      className={`w-3 h-3 text-hub-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-52 hub-card shadow-2xl py-1 z-50"
                      >
                        <div className="px-4 py-3 border-b border-hub-border">
                          <div className="text-xs text-hub-muted font-body">Zalogowano jako</div>
                          <div className="green-nick text-sm truncate">{user.nick}</div>
                        </div>
                        <button
                          onClick={() => { setUserMenuOpen(false); logout() }}
                          className="w-full px-4 py-2 text-left text-sm text-hub-danger hover:bg-hub-surface font-body flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Wyloguj
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <Link to="/login" className="hub-btn-ghost text-xs">Zaloguj</Link>
                  <Link to="/register" className="hub-btn-primary text-xs">Rejestracja</Link>
                </>
              )}
            </div>

            {/* Hamburger — mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-hub-border text-hub-text hover:border-hub-accent/40 transition-colors"
              aria-label="Otwórz menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <MobileDrawer
            onClose={() => setMobileOpen(false)}
            user={user}
            logout={logout}
            links={links}
            isActive={isActive}
          />
        )}
      </AnimatePresence>

      {/* Modal dodawania posta */}
      {showAddModal && (
        <AddPostModal
          onClose={() => setShowAddModal(false)}
          onPublished={() => {
            setShowAddModal(false)
            onPublished?.()
          }}
        />
      )}
    </>
  )
}


// ============================================================
// Mobile drawer — slide-in z prawej
// ============================================================
const MobileDrawer = ({ onClose, user, logout, links, isActive }) => (
  <>
    {/* Backdrop */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden"
    />

    {/* Drawer panel */}
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm z-50 md:hidden bg-hub-surface border-l border-hub-border flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-hub-border">
        <span className="logo-text text-xl tracking-widest">GAMEHUB</span>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-hub-muted hover:text-hub-accent transition-colors"
          aria-label="Zamknij menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* User section */}
      {user ? (
        <div className="px-5 py-4 border-b border-hub-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-hub-border flex-shrink-0">
            {AVATAR_SVG}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-hub-muted font-body">Zalogowano jako</div>
            <div className="green-nick text-sm truncate">{user.nick}</div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 border-b border-hub-border grid grid-cols-2 gap-2">
          <Link to="/login" className="hub-btn-ghost text-xs text-center">Zaloguj</Link>
          <Link to="/register" className="hub-btn-primary text-xs text-center">Rejestracja</Link>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map((link) => {
          const active = isActive(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display uppercase tracking-wider transition-all ${
                active
                  ? 'bg-hub-accent/10 text-hub-accent border border-hub-accent/30'
                  : 'text-hub-muted hover:text-hub-text hover:bg-hub-bg border border-transparent'
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout button */}
      {user && (
        <div className="px-5 py-4 border-t border-hub-border">
          <button
            onClick={() => { onClose(); logout() }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-hub-danger/40 text-hub-danger hover:bg-hub-danger/10 transition-colors font-display uppercase tracking-wider text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Wyloguj
          </button>
        </div>
      )}
    </motion.div>
  </>
)
