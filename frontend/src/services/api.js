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
    const message = err.response?.data?.detail || err.message || 'Something went wrong'
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
  stats:  () => api.get('/invoices/stats/summary'),
}

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
