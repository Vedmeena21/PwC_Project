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

// ── Response interceptor ──────────────────────────────────────────────────────
// Unwraps .data so callers get the payload directly (not the Axios wrapper).
// Normalises errors to plain Error objects with a human-readable message.
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
  list:   (params = {}) => api.get('/invoices/', { params }),
  get:    (id) => api.get(`/invoices/${id}`),
  review: (id, payload) => api.post(`/invoices/${id}/review`, payload),
  delete: (id, by = 'admin') => api.delete(`/invoices/${id}`, { params: { deleted_by: by } }),
  stats:  () => api.get('/invoices/stats/summary'),
  fileUrl:(id) => api.get(`/invoices/${id}/file-url`),
}

// Wake-up ping — Render free tier sleeps after 15min of inactivity.
// Frontend calls this on app load so the first real request is fast.
export const wakeBackend = () => fetch(`${baseURL.replace(/\/api$/, '')}/health`).catch(() => {})

// ── Rulebook API ──────────────────────────────────────────────────────────────
export const rulebookApi = {
  list:      ()             => api.get('/rulebook/'),
  getActive: ()             => api.get('/rulebook/active'),
  get:       (id)           => api.get(`/rulebook/${id}`),
  create:    (payload)      => api.post('/rulebook/', payload),
  // activated_by is passed as a query param — identifies who clicked Activate
  activate:  (id, by = 'admin') =>
    api.post(`/rulebook/${id}/activate`, null, { params: { activated_by: by } }),
  diff:      (fromId, toId) => api.get(`/rulebook/${fromId}/diff/${toId}`),
}

// ── Settings API ──────────────────────────────────────────────────────────────
export const settingsApi = {
  getAll:          ()             => api.get('/settings/'),
  getRecipients:   ()             => api.get('/settings/recipients'),
  updateRecipients:(recipients)   => api.put('/settings/recipients', { recipients }),
  updateSetting:   (key, value)   => api.put(`/settings/${key}`, { value }),
}

export default api
