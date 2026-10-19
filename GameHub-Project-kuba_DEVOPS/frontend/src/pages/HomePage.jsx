import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import PostCard from '../components/PostCard'
import Pagination from '../components/Pagination'
import AddPostModal from '../components/AddPostModal'
import TopNav from '../components/TopNav'
import api from '../utils/api'

export default function HomePage() {
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchPosts = useCallback(async (pg = 1, cat = activeCategory) => {
    setLoading(true)
    try {
      const params = { page: pg }
      if (cat === 'liked') {
        params.liked = 'true'
      } else if (cat === 'my') {
      params.my = 'true'
      } else if (cat !== 'all') {
        params.category_id = cat
      }
      const res = await api.get('/posts', { params })
      setPosts(res.data.posts)
      setTotalPages(res.data.pages)
      setPage(res.data.page)
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [activeCategory])

  useEffect(() => {
    fetchPosts(1, activeCategory)
  }, [activeCategory])

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId)
    setPage(1)
  }

  const handleResetFeed = () => {
    setActiveCategory('all')
    setPage(1)
    fetchPosts(1, 'all')
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchPosts(newPage, activeCategory)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const handlePublished = () => {
    fetchPosts(1, 'all')
    setActiveCategory('all')
    setPage(1)
  }

  const categoryLabel = activeCategory === 'all'
    ? 'Wszystkie posty'
    : activeCategory === 'liked'
      ? '❤️ Polubione'
      : null

  return (
    <div className="bg-hub-bg min-h-screen">
      {/* TopNav sticky na górze całości */}
      <TopNav onPublished={handlePublished} />

      {/* Layout: sidebar + main, z odstępem na TopNav */}
      <div className="flex pt-20">
        <Sidebar
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          onResetFeed={handleResetFeed}
        />

        <main className="flex-1 min-w-0">

          <div className="max-w-2xl mx-auto px-4 py-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="hub-card p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-hub-border" />
                      <div className="space-y-1.5">
                        <div className="h-3 w-20 bg-hub-border rounded" />
                        <div className="h-2 w-16 bg-hub-border rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-3/4 bg-hub-border rounded mb-3" />
                    <div className="aspect-video bg-hub-border rounded-lg" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-full bg-hub-surface border border-hub-border flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-hub-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <p className="font-display text-xl font-semibold text-hub-muted uppercase tracking-wider">Brak Postów</p>
                <p className="text-hub-muted/60 text-sm mt-2 font-body">
                  {activeCategory === 'liked'
                    ? 'Nie polubiłeś żadnych postów'
                    : 'W tej kategorii nie ma jeszcze postów'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onDeleted={handlePostDeleted}
                    />
                  ))}
                </div>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </div>
        </main>
      </div>

      {showAddModal && (
        <AddPostModal
          onClose={() => setShowAddModal(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  )
}
