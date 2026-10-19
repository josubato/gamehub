import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

const AVATAR_SVG = (
  <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
    <circle cx="20" cy="20" r="20" fill="#1e1e2e" />
    <circle cx="20" cy="16" r="7" fill="#00ff87" opacity="0.8" />
    <ellipse cx="20" cy="35" rx="12" ry="9" fill="#00ff87" opacity="0.5" />
  </svg>
)

/**
 * Sidebar — lewa kolumna w HomePage.
 *
 * Uwaga: TopNav jest nad Sidebarem (sticky top-0 z pt-16 na kontenerze).
 * Sidebar zaczyna się pod TopNavem (top-16), wysokość calc(100vh-4rem).
 * Logo i user menu są w TopNavie, więc Sidebar jest czystszy — skupia się na kategoriach.
 */
export default function Sidebar({ activeCategory, onCategoryChange, onResetFeed }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data.categories))
  }, [])

  const filtered = categories.filter(c =>
    c.category_name.toLowerCase().includes(search.toLowerCase())
  )

  const NavItem = ({ id, label, icon }) => (
    <button
      onClick={() => onCategoryChange(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-200 text-left
        ${activeCategory === id
          ? 'bg-hub-accent/10 text-hub-accent border border-hub-accent/30'
          : 'text-hub-muted hover:text-hub-text hover:bg-hub-surface border border-transparent'
        }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
      <aside
        className="hidden md:flex w-64 flex-shrink-0 flex-col bg-hub-surface border-r border-hub-border sticky top-24"
        style={{ height: 'calc(100vh - 4rem)' }}
      >
      {/* User info (minimal, bo TopNav już ma) */}
      {user && (
        <div className="px-4 py-3 border-b border-hub-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-hub-border">
              {AVATAR_SVG}
            </div>
            <div className="min-w-0">
              <p className="text-hub-muted text-xs font-body">Zalogowano jako:</p>
              <p className="green-nick text-sm truncate">{user?.nick}</p>
            </div>
          </div>
        </div>
      )}

      {/* Feed quick filters */}
      <div className="px-3 py-3 border-b border-hub-border space-y-1">
        <NavItem id="all" label="Wszystkie" icon="🎮" />
        {user && <NavItem id="liked" label="Polubione" icon="❤️" />}
        {user && <NavItem id="my" label="Moje posty" icon="👤" />}
        {activeCategory !== 'all' && (
          <button
            onClick={onResetFeed}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-body transition-all text-hub-muted hover:text-hub-accent"
          >
            <span className="text-sm">↺</span>
            <span>Resetuj filtry</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-hub-border">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hub-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Szukaj kategorii..."
            className="hub-input pl-8 text-xs py-1.5"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <p className="text-hub-muted text-xs font-display uppercase tracking-widest px-3 pb-2">
          Kategorie
        </p>
        {filtered.length === 0 ? (
          <p className="text-hub-muted text-xs px-3 py-2">Brak kategorii</p>
        ) : (
          filtered.map(cat => (
            <NavItem
              key={cat.id}
              id={cat.id}
              label={cat.category_name}
              icon="🎯"
            />
          ))
        )}
      </div>
    </aside>
  )
}
