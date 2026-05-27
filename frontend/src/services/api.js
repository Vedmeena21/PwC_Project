import axios from 'axios'

// ── Axios instance ────────────────────────────────────────────────────────────
// In dev the Vite proxy forwards /api → localhost:8000.
// In production reads VITE_API_URL; falls back to the deployed Render URL.
const PROD_URL = import.meta.env.VITE_API_URL || 'https://pwc-project-ld7g.onrender.com/api'
const baseURL  = import.meta.env.DEV ? '/api' : PROD_URL

const api = axios.create({
  baseURL,
  timeout: 60000, // 60s — PDF upload + Groq extraction can take ~15s
})

// ── Auth token injector ───────────────────────────────────────────────────────
// Bearer JWT is set on api.defaults.headers.common by AuthContext when the user
// logs in. We also check localStorage here as a fallback so that the first
// request on page load (before React mounts) still carries the token.
api.interceptors.request.use((config) => {
  // If the header isn't already set, pull from localStorage
  if (!config.headers['Authorization']) {
    const token = localStorage.getItem('ias_token')
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor ──────────────────────────────────────────────────────
// Unwraps .data so callers get the payload directly (not the Axios wrapper).
// Normalises errors to plain Error objects with a human-readable message.
// 401 = token expired / invalid → clear storage and redirect to /login.
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    let message = 'Something went wrong'
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') message = detail
    else if (Array.isArray(detail)) message = detail.map(d => d.msg || JSON.stringify(d)).join(', ')
    else if (detail && typeof detail === 'object') message = JSON.stringify(detail)
    else if (err.message && err.message !== 'Network Error') message = err.message
    // Network Error = no response at all (backend cold-starting or CORS preflight failed)
    if (!err.response && (err.message === 'Network Error' || err.code === 'ERR_NETWORK'))
      message = 'Cannot reach the server — it may be waking up. Please wait a moment and try again.'
    if (err.code === 'ECONNABORTED') message = 'Request timed out — the backend may be cold-starting. Try again.'
    if (err.response?.status === 413) message = 'File is too large (max 10 MB).'
    if (err.response?.status === 404) message = detail || 'Not found.'

    // 401 = expired / invalid JWT → force re-login
    if (err.response?.status === 401) {
      localStorage.removeItem('ias_token')
      localStorage.removeItem('ias_user')
      delete api.defaults.headers.common['Authorization']
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(new Error(message))
  }
)

// ── Invoice API ───────────────────────────────────────────────────────────────
export const invoiceApi = {
  // Sends PDF as multipart/form-data — backend stores to Supabase Storage
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/invoices/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list:      (params = {}) => api.get('/invoices/', { params }),
  get:       (id)          => api.get(`/invoices/${id}`),
  review:    (id, payload) => api.post(`/invoices/${id}/review`, payload),
  delete:    (id)          => api.delete(`/invoices/${id}`),
  reprocess: (id)          => api.post(`/invoices/${id}/reprocess`),
  stats:     (params = {}) => api.get('/invoices/stats/summary', { params }),
  fileUrl:   (id)          => api.get(`/invoices/${id}/file-url`),
}

// Wake-up ping — Render free tier sleeps after 15min of inactivity.
// Frontend calls this on app load so the first real request is fast.
export const wakeBackend = () => fetch(`${baseURL.replace(/\/api$/, '')}/health`).catch(() => {})

// ── Rulebook API ──────────────────────────────────────────────────────────────
export const rulebookApi = {
  list:      ()                  => api.get('/rulebook/'),
  getActive: ()                  => api.get('/rulebook/active'),
  get:       (id)                => api.get(`/rulebook/${id}`),
  create:    (payload)           => api.post('/rulebook/', payload),
  activate:  (id, by = 'admin') => api.post(`/rulebook/${id}/activate`, null, { params: { activated_by: by } }),
  diff:      (fromId, toId)      => api.get(`/rulebook/${fromId}/diff/${toId}`),
}

// ── Settings API ──────────────────────────────────────────────────────────────
export const settingsApi = {
  getAll:           ()           => api.get('/settings/'),
  getRecipients:    ()           => api.get('/settings/recipients'),
  updateRecipients: (recipients) => api.put('/settings/recipients', { recipients }),
  updateSetting:    (key, value) => api.put(`/settings/${key}`, { value }),
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (email, password)       => api.post('/auth/login',   { email, password }),
  signup:  (payload)               => api.post('/auth/signup',  payload),
  me:      ()                      => api.get('/auth/me'),
  // Admin endpoints
  pending: ()                      => api.get('/auth/users/pending'),
  users:   ()                      => api.get('/auth/users'),
  approve: (id)                    => api.post(`/auth/users/${id}/approve`),
  reject:  (id, reason)            => api.post(`/auth/users/${id}/reject`, { reason }),
  create:  (payload)               => api.post('/auth/users',   payload),
  delete:  (id)                    => api.delete(`/auth/users/${id}`),
}

export default api
