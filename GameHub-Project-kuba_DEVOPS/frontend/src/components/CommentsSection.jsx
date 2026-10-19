import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { Edit2, Trash2 } from 'lucide-react'

const AVATAR_SVG = (
  <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
    <circle cx="16" cy="16" r="16" fill="#1e1e2e" />
    <circle cx="16" cy="13" r="5" fill="#00ff87" opacity="0.8" />
    <ellipse cx="16" cy="28" rx="9" ry="7" fill="#00ff87" opacity="0.5" />
  </svg>
)

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CommentsSection({ postId }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    api.get(`/posts/${postId}/comments`).then(res => setComments(res.data.comments))
  }, [postId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) {
      setError('Treść komentarza nie może być pusta')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post(`/posts/${postId}/comments`, { content })
      setComments(p => [...p, res.data.comment])
      setContent('')
    } catch (err) {
      setError(err.response?.data?.error || 'Wystąpił błąd')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (commentId, currentContent) => {
    setEditingCommentId(commentId)
    setEditContent(currentContent)
  }

  const handleEditSubmit = async (commentId) => {
    if (!editContent.trim()) {
      setError('Treść komentarza nie może być pusta')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.put(`/posts/${postId}/comments/${commentId}`, { content: editContent })
      setComments(p => p.map(c => c.id === commentId ? { ...c, content: editContent, comment_datetime: new Date().toISOString() } : c))
      setEditingCommentId(null)
      setEditContent('')
    } catch (err) {
      setError(err.response?.data?.error || 'Wystąpił błąd')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (commentId) => {
    if (!confirm('Czy na pewno chcesz usunąć ten komentarz?')) return
    setLoading(true)
    setError('')
    try {
      await api.delete(`/posts/${postId}/comments/${commentId}`)
      setComments(p => p.filter(c => c.id !== commentId))
    } catch (err) {
      setError(err.response?.data?.error || 'Wystąpił błąd')
    } finally {
      setLoading(false)
    }
  }

  const cancelEdit = () => {
    setEditingCommentId(null)
    setEditContent('')
  }

  return (
    <div className="border-t border-hub-border mt-3 pt-3">
      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-hub-muted text-xs py-2 font-body">Brak komentarzy. Bądź pierwszy!</p>
      ) : (
        <div className="space-y-3 mb-3 max-h-48 overflow-y-auto pr-1">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-hub-border">
                {AVATAR_SVG}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="green-nick text-xs">{c.author_nick}</span>
                  <span className="text-hub-muted text-xs">{formatDate(c.comment_datetime)}</span>

                  {/* Przyciski tylko dla właściciela komentarza */}
                  {user && user.id === c.id_user && (
                    <div className="flex gap-1 ml-auto">
                      <button
                        onClick={() => handleEdit(c.id, c.content)}
                        className="p-1 hover:bg-hub-border rounded transition-colors"
                        title="Edytuj komentarz"
                      >
                        <Edit2 size={14} className="text-hub-muted hover:text-hub-text" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1 hover:bg-hub-border rounded transition-colors"
                        title="Usuń komentarz"
                      >
                        <Trash2 size={14} className="text-hub-muted hover:text-hub-danger" />
                      </button>
                    </div>
                  )}
                </div>

                {editingCommentId === c.id ? (
                  <div className="mt-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="hub-input text-xs py-1 flex-1"
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        maxLength={500}
                      />
                      <button
                        onClick={() => handleEditSubmit(c.id)}
                        disabled={loading}
                        className="hub-btn-primary px-2 py-1 text-xs whitespace-nowrap disabled:opacity-50"
                      >
                        Zapisz
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="hub-btn-ghost px-2 py-1 text-xs whitespace-nowrap"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-hub-text text-xs mt-0.5 break-words font-body">{c.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      {user && (
        <form onSubmit={handleSubmit} className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-hub-border">
            {AVATAR_SVG}
          </div>
          <div className="flex-1">
            <div className="flex gap-2">
              <textarea
                className="hub-input text-xs py-1.5 flex-1 resize-none overflow-y-auto leading-4"
                style={{ maxHeight: '4.5rem' }}
                placeholder={`Komentarz jako ${user.nick}...`}
                value={content}
                onChange={e => { setContent(e.target.value); setError('') }}
                maxLength={500}
                rows={1}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px'
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className="hub-btn-primary px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50"
              >
                {loading ? '...' : 'Wyślij'}
              </button>
            </div>
            {error && <p className="text-hub-danger text-xs mt-1">{error}</p>}
          </div>
        </form>
      )}
    </div>
  )
}