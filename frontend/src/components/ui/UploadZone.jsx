import { useRef, useState } from 'react'
import { Upload, FileText, FileSpreadsheet, FileJson, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Supported formats ─────────────────────────────────────────────────────────
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.json', '.txt', '.csv']
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')

// Map extension to display label and icon colour
const FILE_META = {
  pdf:  { label: 'PDF',   color: 'text-red-600',    bg: 'bg-red-100',    Icon: FileText },
  docx: { label: 'Word',  color: 'text-blue-600',   bg: 'bg-blue-100',   Icon: FileText },
  doc:  { label: 'Word',  color: 'text-blue-600',   bg: 'bg-blue-100',   Icon: FileText },
  xlsx: { label: 'Excel', color: 'text-green-600',  bg: 'bg-green-100',  Icon: FileSpreadsheet },
  xls:  { label: 'Excel', color: 'text-green-600',  bg: 'bg-green-100',  Icon: FileSpreadsheet },
  json: { label: 'JSON',  color: 'text-yellow-600', bg: 'bg-yellow-100', Icon: FileJson },
  txt:  { label: 'Text',  color: 'text-slate-600',  bg: 'bg-slate-100',  Icon: FileText },
  csv:  { label: 'CSV',   color: 'text-teal-600',   bg: 'bg-teal-100',   Icon: FileSpreadsheet },
}

function getFileMeta(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  return FILE_META[ext] || { label: ext.toUpperCase(), color: 'text-slate-600', bg: 'bg-slate-100', Icon: FileText }
}

// ── UploadZone ────────────────────────────────────────────────────────────────
// Drag-and-drop + click-to-browse uploader for invoice files.
// Accepts PDF, Word, Excel, JSON, TXT, CSV.
export default function UploadZone({ onUpload, uploading }) {
  const inputRef              = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]     = useState(null)
  const [error,    setError]    = useState(null)

  const isSupported = (f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    return ACCEPTED_EXTENSIONS.includes(ext)
  }

  const handleFile = (f) => {
    if (!f) return
    if (!isSupported(f)) {
      setError(`"${f.name}" is not supported. Use PDF, Word, Excel, JSON, TXT or CSV.`)
      return
    }
    setError(null)
    setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  // Reset hidden input value so the same file can be re-selected after clearing
  const clear = () => {
    setFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const meta = file ? getFileMeta(file.name) : null

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 p-6 md:p-10 rounded-xl border-2 border-dashed transition-colors duration-200 cursor-pointer',
          dragging  ? 'border-brand-500 bg-brand-50'  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
          file      && 'cursor-default',
          error     && 'border-red-300 bg-red-50',
        )}
      >
        {/* Hidden input — triggered programmatically */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          // File preview card
          <div className="flex items-center gap-3 w-full max-w-sm">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', meta.bg)}>
              <meta.Icon className={cn('w-5 h-5', meta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB · {meta.label}
              </p>
            </div>
            {/* Stop propagation so clear doesn't re-open the picker */}
            <button
              onClick={(e) => { e.stopPropagation(); clear() }}
              className="w-7 h-7 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        ) : (
          // Empty state
          <>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Upload className="w-6 h-6 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">
                <span className="hidden md:inline">Drop file here or </span>
                <span className="text-brand-600 font-semibold">tap to browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF · Word · Excel · JSON · TXT · CSV</p>
            </div>
          </>
        )}
      </div>

      {/* Inline error for unsupported file types */}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <X className="w-3 h-3" /> {error}
        </p>
      )}

      {/* Upload button — only shown when a file is staged */}
      {file && (
        <button onClick={() => onUpload(file)} disabled={uploading} className="btn-primary w-full justify-center">
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload & Process Invoice
            </>
          )}
        </button>
      )}
    </div>
  )
}
