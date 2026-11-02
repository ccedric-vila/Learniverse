import { useEffect, useRef, useState } from 'react'
import { init } from 'pptx-preview'

export default function PptxViewer({ buffer, fileName, onFallback }) {
  const containerRef = useRef(null)
  const previewerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let active = true
    if (!containerRef.current || !buffer) return

    setLoading(true)
    setHasError(false)
    containerRef.current.innerHTML = ''

    // Calculate responsive 16:9 presentation dimensions
    const clientWidth = containerRef.current.clientWidth || 900
    const clientHeight = containerRef.current.clientHeight || 580

    // Ensure width and height fit comfortably inside the container
    let slideWidth = Math.min(clientWidth - 32, 980)
    let slideHeight = Math.round(slideWidth * (9 / 16))

    if (slideHeight > clientHeight - 40 && clientHeight > 300) {
      slideHeight = clientHeight - 40
      slideWidth = Math.round(slideHeight * (16 / 9))
    }

    slideWidth = Math.max(Math.floor(slideWidth), 360)
    slideHeight = Math.max(Math.floor(slideHeight), 220)

    try {
      const previewer = init(containerRef.current, {
        mode: 'slide',
        width: slideWidth,
        height: slideHeight,
      })
      previewerRef.current = previewer

      previewer.preview(buffer)
        .then(() => {
          if (active) setLoading(false)
        })
        .catch((err) => {
          console.warn('pptx-preview error:', err)
          if (active) {
            setHasError(true)
            setLoading(false)
            if (onFallback) onFallback(err)
          }
        })
    } catch (err) {
      console.warn('pptx-preview init failed:', err)
      if (active) {
        setHasError(true)
        setLoading(false)
        if (onFallback) onFallback(err)
      }
    }

    return () => {
      active = false
      if (previewerRef.current && typeof previewerRef.current.destroy === 'function') {
        try {
          previewerRef.current.destroy()
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }, [buffer, onFallback])

  if (hasError) return null

  return (
    <div className="pptx-render-viewport">
      {loading && (
        <div className="material-preview-state">
          <div className="material-preview-spinner" />
          <strong>Rendering PowerPoint slides…</strong>
          <p>Processing presentation theme, slide graphics, and layouts</p>
        </div>
      )}
      <div
        ref={containerRef}
        className="pptx-render-container"
        style={{ display: loading ? 'none' : 'flex' }}
      />
    </div>
  )
}

