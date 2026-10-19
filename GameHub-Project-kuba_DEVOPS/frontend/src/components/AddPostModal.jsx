import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'

const MAX_SIZE = 150 * 1024 * 1024 // 150MB

export default function AddPostModal({ onClose, onPublished }) {
  const [postId, setPostId] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [videoUploaded, setVideoUploaded] = useState(false)
  const [detectedCategory, setDetectedCategory] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    api.post('/posts/reserve').then(res => setPostId(res.data.post_id))
  }, [])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (postId && !videoUploaded) {
        api.delete(`/posts/${postId}/cancel`).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [postId, videoUploaded])

  const handleClose = async () => {
    if (postId) await api.delete(`/posts/${postId}/cancel`).catch(() => {})
    onClose()
  }

const processFile = async (file) => {
  if (!file) return
  setError('')

  if (!file.name.toLowerCase().endsWith('.mp4')) {
    setError('Dozwolony tylko format .mp4')
    return
  }
  if (file.size > MAX_SIZE) {
    setError('Plik jest za duży. Maksymalny rozmiar to 150MB')
    return
  }

  setVideoFile(file)
  setVideoPreview(URL.createObjectURL(file))
  setUploading(true)
  setUploadProgress(0)

  try {
    const res = await api.post(`/posts/${postId}/upload-url`, {
      filename: file.name,
      content_type: 'video/mp4'
    })
    const { signed_url } = res.data

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed: ${xhr.status}`))
      })
      xhr.addEventListener('error', () => reject(new Error('Upload failed')))
      xhr.open('PUT', signed_url)
      xhr.setRequestHeader('Content-Type', 'video/mp4')
      xhr.send(file)
    })

    const confirmRes = await api.post(`/posts/${postId}/confirm`)
setVideoUploaded(true)
setDetectedCategory(confirmRes.data.detected_category || 'Pozostałe')
  } catch (err) {
    setError(err.response?.data?.error || 'Błąd uploadu wideo')
    setVideoFile(null)
    setVideoPreview(null)
  } finally {
    setUploading(false)
  }
}

  const handleVideoSelect = async (e) => {
    await processFile(e.target.files[0])
  }

  const handleSubmit = async () => {
    const fe = {}
    if (!title.trim()) fe.title = 'Pole tytuł nie może być puste'
    if (!videoUploaded) fe.video = 'Wideo jest wymagane'
    setFieldErrors(fe)
    if (Object.keys(fe).length > 0) return

    setLoading(true)
    try {
      await api.put(`/posts/${postId}`, {
        title: title.trim(),
        description,
        publish: true
      })
      onPublished()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Wystąpił błąd')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="hub-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-hub-border sticky top-0 bg-hub-card z-10">
          <h3 className="font-display text-lg font-semibold text-hub-text uppercase tracking-wider">Dodaj Post</h3>
          <button onClick={handleClose} className="text-hub-muted hover:text-hub-danger transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-950/50 border border-hub-danger text-hub-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Tytuł *</label>
            <input
              type="text"
              className={`hub-input ${fieldErrors.title ? 'border-hub-danger' : ''}`}
              value={title}
              onChange={e => { setTitle(e.target.value); setFieldErrors(p => ({ ...p, title: '' })) }}
              placeholder="Tytuł twojego posta"
              maxLength={100}
            />
            <p className={`text-xs mt-1 text-right ${title.length >= 100 ? 'text-hub-danger' : 'text-hub-muted'}`}>
              {title.length}/100
            </p>
            {fieldErrors.title && <p className="text-hub-danger text-xs mt-1">{fieldErrors.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">Opis</label>
            <textarea
              className="hub-input resize-none"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opisz co w tym wideo..."
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-hub-muted mb-1">
              Wideo * (.mp4, max 150MB)
            </label>
            {!videoFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  processFile(e.dataTransfer.files[0])
                }}
                className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-all
                  ${fieldErrors.video
                    ? 'border-hub-danger'
                    : isDragging
                      ? 'border-hub-accent bg-hub-accent/10 scale-[1.02]'
                      : 'border-hub-border hover:border-hub-accent/50'
                  }`}
              >
                <svg className={`w-10 h-10 transition-colors ${isDragging ? 'text-hub-accent' : 'text-hub-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                <span className={`text-sm font-body transition-colors ${isDragging ? 'text-hub-accent' : 'text-hub-muted'}`}>
                  {isDragging ? 'Upuść plik tutaj' : 'Kliknij lub przeciągnij plik .mp4'}
                </span>
                <span className="text-hub-muted text-xs">Maksymalny rozmiar: 150MB</span>
              </button>
            ) : (
              <div className="rounded-xl overflow-hidden border border-hub-border">
                <video src={videoPreview} className="w-full aspect-video object-contain bg-black" controls />
                {uploading && (
                  <div className="p-3 bg-hub-surface">
                    <div className="flex items-center justify-between text-xs text-hub-muted mb-1">
                      <span>Wgrywanie wideo...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-hub-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-hub-accent transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {videoUploaded && (
                  <div className="p-3 bg-hub-surface flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-hub-accent" />
                      <span className="text-xs text-hub-accent font-body">Wideo gotowe</span>
                    </div>
                    {detectedCategory && (
                      <span className="text-xs text-hub-muted font-body">
                        Wykryto: <span className="text-hub-accent">{detectedCategory}</span>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setVideoFile(null)
                        setVideoPreview(null)
                        setVideoUploaded(false)
                        setDetectedCategory('')
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="text-xs text-hub-danger hover:underline"
                    >
                      Usuń
                    </button>
                  </div>
                )}
              </div>
            )}
            {fieldErrors.video && <p className="text-hub-danger text-xs mt-1">{fieldErrors.video}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,video/mp4"
              className="hidden"
              onChange={handleVideoSelect}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-hub-border sticky bottom-0 bg-hub-card">
          <button onClick={handleClose} className="hub-btn-ghost flex-1">Zamknij</button>
          <button
            onClick={handleSubmit}
            disabled={loading || uploading}
            className="hub-btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? 'Publikowanie...' : 'Opublikuj'}
          </button>
        </div>
      </div>
    </div>
  )
}
