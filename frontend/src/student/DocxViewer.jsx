import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'

export default function DocxViewer({ buffer, fileName, onFallback }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let active = true
    if (!containerRef.current || !buffer) return

    setLoading(true)
    setHasError(false)
    containerRef.current.innerHTML = ''

    renderAsync(buffer, containerRef.current, null, {
      className: 'docx-preview-doc',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      experimental: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
    })
      .then(() => {
        if (active) setLoading(false)
      })
      .catch((err) => {
        console.warn('docx-preview failed:', err)
        if (active) {
          setHasError(true)
          setLoading(false)
          if (onFallback) onFallback(err)
        }
      })

    return () => {
      active = false
    }
  }, [buffer, onFallback])

  if (hasError) return null

  return (
    <div className="docx-render-viewport">
      {loading && (
        <div className="material-preview-state">
          <div className="material-preview-spinner" />
          <strong>Rendering Word document…</strong>
          <p>Processing fonts, tables, styles, and page layouts</p>
        </div>
      )}
      <div
        ref={containerRef}
        className="docx-render-container"
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  )
}

