import axios from 'axios'

const api = axios.create({
  // W produkcji ustaw VITE_API_URL (np. https://<project>.appspot.com/api); lokalnie Vite proxuje /api
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
})
// Dodaj token do każdego requestu
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
// Obsługa błędów
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const currentPath = window.location.pathname
      if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/verify') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)
export default api
