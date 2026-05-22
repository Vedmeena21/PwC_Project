import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// Catches any unhandled error in the React tree below it.
// Without this, a single broken component crashes the whole app silently.
export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Caught by ErrorBoundary:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
            <p className="text-sm text-slate-500 mt-1">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
          </div>
          <details className="text-left text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-slate-500 select-none">
              Technical details
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full justify-center"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Page
          </button>
        </div>
      </div>
    )
  }
}
