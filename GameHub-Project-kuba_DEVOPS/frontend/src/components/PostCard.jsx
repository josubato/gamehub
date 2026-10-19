import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import VideoPlayer from './VideoPlayer'
import CommentsSection from './CommentsSection'
import EditPostModal from './EditPostModal'
import AuthToast from './AuthToast'
import api from '../utils/api'

const AVATAR_SVG = (
  <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
    <circle cx="20" cy="20" r="20" fill="#1e1e2e" />
    <circle cx="20" cy="16" r="7" fill="#00ff87" opacity="0.8" />
    <ellipse cx="20" cy="35" rx="12" ry="9" fill="#00ff87" opacity="0.5" />
  </svg>
)

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function PostCard({ post: initialPost, onDeleted }) {
  const { user } = useAuth()
  const [post, setPost] = useState(initialPost)
  const [liked, setLiked] = useState(post.user_liked)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [likeLoading, setLikeLoading] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedDesc, setExpandedDesc] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const [toast, setToast] = useState(null)
  const [shakeLike, setShakeLike] = useState(false)
  const [shakeComment, setShakeComment] = useState(false)
  const descRef = useRef(null)

  const isOwner = user && user.id === post.id_user

  useEffect(() => {
    if (descRef.current) {
      setIsClamped(descRef.current.scrollHeight > descRef.current.clientHeight)
    }
  }, [post.description])

  const handleLike = async () => {
    if (!user) {
      setShakeLike(true)
      setTimeout(() => setShakeLike(false), 500)
      setToast('Zaloguj się aby polubić post')
      return
    }
    if (likeLoading) return
    setLikeLoading(true)
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount(c => wasLiked ? c - 1 : c + 1)
    try {
      await api.post(`/posts/${post.id}/like`)
    } catch {
      setLiked(wasLiked)
      setLikeCount(c => wasLiked ? c + 1 : c - 1)
    } finally {
      setLikeLoading(false)
    }
  }

  const handleCommentClick = () => {
    if (!user) {
      setShakeComment(true)
      setTimeout(() => setShakeComment(false), 500)
      setToast('Zaloguj się aby komentować')
      return
    }
    setShowComments(!showComments)
  }

  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć ten post?')) return
    setDeleting(true)
    setMenuOpen(false)
    try {
      await api.delete(`/posts/${post.id}`)
      onDeleted(post.id)
    } catch {
      setDeleting(false)
    }
  }

  if (deleting) {
    return (
      <div className="hub-card p-6 flex items-center justify-center min-h-32">
        <span className="text-hub-muted text-sm font-body animate-pulse">Usuwanie posta...</span>
      </div>
    )
  }

  return (
    <>
      <article className="hub-card overflow-hidden transition-all duration-200 hover:border-hub-border/80">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-hub-border flex-shrink-0">
              {AVATAR_SVG}
            </div>
            <div>
              <span className="green-nick text-sm block">{post.author_nick}</span>
              <span className="text-hub-muted text-xs font-body">{formatDate(post.post_datetime)}</span>
            </div>
          </div>

          {/* Owner settings menu */}
          {isOwner && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-hub-muted hover:text-hub-text hover:bg-hub-surface transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-9 w-36 hub-card shadow-xl z-20 py-1 border border-hub-border">
                    <button
                      onClick={() => { setShowEdit(true); setMenuOpen(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-hub-text hover:bg-hub-surface font-body flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edytuj
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-2 text-left text-sm text-hub-danger hover:bg-hub-surface font-body flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Usuń
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-4 pb-2">
          <h2 className="text-hub-text font-display font-semibold text-base leading-snug break-words line-clamp-3">{post.title}</h2>
        </div>

        {/* Video */}
        {post.video_location && (
          <div className="px-4 pb-3">
            <VideoPlayer
              src={post.video_location}
              thumbnail={post.thumbnail_location}
              postId={post.id}
            />
          </div>
        )}

        {/* Description */}
        {post.description && (
          <div className="px-4 pb-3">
            <p
              ref={descRef}
              className={`text-hub-text/80 text-sm font-body leading-relaxed break-words ${expandedDesc ? '' : 'line-clamp-3'}`}
            >
              {post.description}
            </p>
            {(isClamped || expandedDesc) && (
              <button
                onClick={() => setExpandedDesc(!expandedDesc)}
                className="text-hub-accent text-xs font-body mt-1 hover:underline"
              >
                {expandedDesc ? 'Zwiń' : 'Rozwiń'}
              </button>
            )}
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-hub-border">
          {/* Like button — czerwony shake + glow dla niezalogowanych */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-all duration-200 group
            ${shakeLike ? 'animate-shake text-hub-danger' : ''}
            ${!shakeLike && liked ? 'text-hub-danger' : ''}
            ${!shakeLike && !liked ? 'text-hub-muted hover:text-hub-danger' : ''}
            ${!user ? 'cursor-pointer' : ''}`}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-150 ${liked ? 'scale-110' : 'group-hover:scale-110'}`}
              fill={liked ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-xs font-body tabular-nums">{likeCount}</span>
          </button>

          {/* Comments toggle — zielony shake + glow dla niezalogowanych */}
          <button
            onClick={handleCommentClick}
              className={`flex items-center gap-1.5 transition-colors group
              ${shakeComment ? 'animate-shake text-hub-accent' : 'text-hub-muted hover:text-hub-accent'}`}
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs font-body">Komentarze</span>
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${showComments ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="px-4 pb-4">
            <CommentsSection postId={post.id} />
          </div>
        )}
      </article>

      {showEdit && (
        <EditPostModal
          post={post}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => setPost(updated)}
        />
      )}

      {toast && (
        <AuthToast
          message={toast}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
