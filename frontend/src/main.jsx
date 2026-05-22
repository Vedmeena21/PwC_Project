import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { wakeBackend } from '@/services/api'
import './index.css'

// Wake the Render free-tier backend immediately so the first real
// request doesn't have to wait ~30s for cold-start.
wakeBackend()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
