import { useRef, useEffect, useState } from 'react'

export default function VideoPlayer({ src, thumbnail, postId }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showThumbnail, setShowThumbnail] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current
        if (!video) return

        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          video.play().then(() => {
            setIsPlaying(true)
            setShowThumbnail(false)
          }).catch(() => {
            // Autoplay blocked
            setIsPlaying(false)
          })
        } else {
          video.pause()
          setIsPlaying(false)
          setShowThumbnail(true)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [src])

  const handleVideoClick = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
      setShowThumbnail(false)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Thumbnail overlay */}
      {showThumbnail && thumbnail && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={handleVideoClick}
        >
          <img
            src={thumbnail}
            alt="Miniatura"
            className="w-full h-full object-cover"
            onError={e => e.target.style.display = 'none'}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-14 h-14 rounded-full bg-black/60 border-2 border-hub-accent flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-hub-accent ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Fallback play button if no thumbnail */}
      {showThumbnail && !thumbnail && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-hub-surface cursor-pointer"
          onClick={handleVideoClick}
        >
          <div className="w-14 h-14 rounded-full bg-black/60 border-2 border-hub-accent flex items-center justify-center">
            <svg className="w-6 h-6 text-hub-accent ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={src}
        className="w-full h-full"
        controls
        muted
        loop
        playsInline
        preload="metadata"
        controlsList="nodownload"
        onContextMenu={e => e.preventDefault()}
        onPlay={() => { setIsPlaying(true); setShowThumbnail(false) }}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  )
}
