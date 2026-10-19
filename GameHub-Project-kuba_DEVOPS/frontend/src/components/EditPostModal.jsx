import { useState } from 'react'
import api from '../utils/api'

export default function EditPostModal({ post, onClose, onUpdated }) {
  const [title, setTitle] = useState(post.title)
  const [description, setDescription] = useState(post.description || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!title.trim()) {
      setError('Pole tytuł nie może być puste')
      return
    }
    setLoading(true)
    try {
      await api.put(`/posts/${post.id}`, { title: title.trim(), description })
      onUpdated({ ...post, title: title.trim(), description })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Wystąpił błąd')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="hub-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-semibold text-hub-text uppercase tracking-wider">Edytuj post</h3>
          <button onClick={onClose} className="text-hub-muted hover:text-hub-danger transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-950/50 border border-hub-danger text-hub-danger text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Tytuł *</label>
            <input
              type="text"
              className={`hub-input ${error && !title.trim() ? 'border-hub-danger' : ''}`}
              value={title}
              onChange={e => { setTitle(e.target.value); setError('') }}
              placeholder="Tytuł posta"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Opis</label>
            <textarea
              className="hub-input resize-none"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opisz swój post..."
              maxLength={2000}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="hub-btn-ghost flex-1">Zamknij</button>
          <button onClick={handleSend} disabled={loading} className="hub-btn-primary flex-1 disabled:opacity-50">
            {loading ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}
