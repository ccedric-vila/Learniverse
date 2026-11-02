import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Download, ExternalLink, FileText, Presentation } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import { extractOfficeText } from './materialPreview'
import DocxViewer from './DocxViewer'
import PptxViewer from './PptxViewer'
import './student.css'

export default function MaterialFileViewer() {
  const { classId, materialId } = useParams()
  const [materialState, setMaterialState] = useState({ id: null, material: null, error: '' })
  const [previewState, setPreviewState] = useState({ id: null, kind: '', url: '', buffer: null, paragraphs: [], slides: [], error: '' })
  const [downloading, setDownloading] = useState(false)
  const [useTextFallback, setUseTextFallback] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`/student/materials/${materialId}`)
      .then(({ data }) => { if (active) setMaterialState({ id: materialId, material: data.material, error: '' }) })
      .catch((error) => { if (active) setMaterialState({ id: materialId, material: null, error: error.response?.data?.message || 'Could not load material.' }) })
    return () => { active = false }
  }, [materialId])

  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (materialState.id !== materialId || !materialState.material) return () => { active = false }
    const material = materialState.material
    setUseTextFallback(false)

    api.get(`/student/materials/${materialId}/preview`, { responseType: 'blob' })
      .then(async ({ data }) => {
        if (!active) return
        const fileName = (material.originalFileName || '').toLowerCase()
        const mime = (material.mimeType || '').toLowerCase()
        const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''

        if (mime === 'application/pdf' || extension === '.pdf') {
          objectUrl = URL.createObjectURL(data)
          setPreviewState({ id: materialId, kind: 'pdf', url: objectUrl, buffer: null, paragraphs: [], slides: [], error: '' })
        } else if (extension === '.docx' || extension === '.doc') {
          try {
            const arrayBuf = await data.arrayBuffer()
            let content = { paragraphs: [] }
            try { content = extractOfficeText(arrayBuf, extension) } catch { /* ignore fallback error */ }
            if (active) {
              setPreviewState({
                id: materialId,
                kind: 'docx',
                url: '',
                buffer: arrayBuf,
                paragraphs: content.paragraphs || [],
                slides: [],
                error: '',
              })
            }
          } catch {
            if (active) setPreviewState({ id: materialId, kind: 'unsupported', url: '', buffer: null, paragraphs: [], slides: [], error: 'Could not load Word document.' })
          }
        } else if (extension === '.pptx' || extension === '.ppt') {
          try {
            const arrayBuf = await data.arrayBuffer()
            let content = { slides: [] }
            try { content = extractOfficeText(arrayBuf, extension) } catch { /* ignore fallback error */ }
            if (active) {
              setPreviewState({
                id: materialId,
                kind: 'pptx',
                url: '',
                buffer: arrayBuf,
                paragraphs: [],
                slides: content.slides || [],
                error: '',
              })
            }
          } catch {
            if (active) setPreviewState({ id: materialId, kind: 'unsupported', url: '', buffer: null, paragraphs: [], slides: [], error: 'Could not load presentation file.' })
          }
        } else if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) {
          objectUrl = URL.createObjectURL(data)
          setPreviewState({ id: materialId, kind: 'image', url: objectUrl, buffer: null, paragraphs: [], slides: [], error: '' })
        } else {
          setPreviewState({ id: materialId, kind: 'unsupported', url: '', buffer: null, paragraphs: [], slides: [], error: 'This file type cannot be displayed in the browser. Download it to view.' })
        }
      })
      .catch(async (error) => {
        let message = error.response?.data?.message || 'Could not open this file.'
        if (error.response?.data instanceof Blob) {
          try { message = JSON.parse(await error.response.data.text()).message || message } catch { /* Keep fallback. */ }
        }
        if (active) setPreviewState({ id: materialId, kind: 'error', url: '', buffer: null, paragraphs: [], slides: [], error: message })
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [materialId, materialState.id, materialState.material])

  const materialLoading = materialState.id !== materialId
  const material = materialLoading ? null : materialState.material
  const materialError = materialLoading ? '' : materialState.error
  const preview = previewState.id === materialId ? previewState : null

  async function downloadMaterial() {
    setDownloading(true)
    try {
      const { data } = await api.get(`/student/materials/${materialId}/download`)
      window.location.assign(data.url)
    } finally {
      setDownloading(false)
    }
  }

  async function openInOfficeViewer() {
    try {
      const { data } = await api.get(`/student/materials/${materialId}/download`)
      const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(data.url)}`
      window.open(officeViewerUrl, '_blank', 'noopener,noreferrer')
    } catch {
      downloadMaterial()
    }
  }

  return (
    <main className="material-file-fullscreen">
      <header className="material-file-toolbar">
        <Link className="material-file-back" to={`/student/classes/${classId}/materials/${materialId}`}>
          <ArrowLeft size={16} />
          <span>Back to material details</span>
        </Link>
        <div className="material-file-toolbar-title">
          <strong>{material?.title || (materialLoading ? 'Loading file…' : 'File unavailable')}</strong>
          <span>{material?.originalFileName || materialError}</span>
        </div>
        <div className="material-file-toolbar-actions">
          {preview?.kind === 'pdf' && preview.url && (
            <a href={preview.url} target="_blank" rel="noopener noreferrer" className="material-toolbar-action-btn">
              <ExternalLink size={15} />
              <span>New tab</span>
            </a>
          )}
          {(preview?.kind === 'docx' || preview?.kind === 'pptx') && (
            <button type="button" className="material-toolbar-action-btn" onClick={openInOfficeViewer}>
              <ExternalLink size={15} />
              <span>Office Online</span>
            </button>
          )}
          {material && (
            <button className="material-toolbar-action-btn primary" type="button" onClick={downloadMaterial} disabled={downloading}>
              <Download size={15} />
              <span>{downloading ? 'Preparing…' : 'Download file'}</span>
            </button>
          )}
        </div>
      </header>

      <section className="material-file-canvas" aria-label="Full-page file viewer">
        {materialLoading || !preview ? (
          <div className="material-preview-state">
            <div className="material-preview-spinner" />
            <strong>Opening file…</strong>
            <p>Loading document content</p>
          </div>
        ) : preview.error ? (
          <div className="material-preview-state error">
            <div className="material-preview-alert-icon"><AlertCircle size={36} /></div>
            <strong>{preview.error}</strong>
            {material && (
              <button className="material-action-btn primary" type="button" onClick={downloadMaterial}>
                <Download size={15} />Download file
              </button>
            )}
          </div>
        ) : preview.kind === 'pdf' ? (
          <iframe className="material-preview-pdf" title={`Preview: ${material?.title}`} src={preview.url} />
        ) : preview.kind === 'docx' ? (
          useTextFallback ? (
            <div className="material-document-viewer">
              <div className="material-document-sheet">
                <div className="material-document-sheet-header">
                  <strong>{material?.originalFileName}</strong>
                  <button type="button" className="material-toggle-view-btn" onClick={() => setUseTextFallback(false)}>
                    Switch to Rich Document View
                  </button>
                </div>
                {preview.paragraphs.length ? preview.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="material-preview-empty">No readable document text was found.</p>}
              </div>
            </div>
          ) : (
            <DocxViewer
              buffer={preview.buffer}
              fileName={material?.originalFileName}
              onFallback={() => setUseTextFallback(true)}
            />
          )
        ) : preview.kind === 'pptx' ? (
          useTextFallback ? (
            <div className="material-slides-viewer">
              {preview.slides.length ? preview.slides.map((slide, index) => (
                <article className="material-slide-card" key={index}>
                  <div className="material-slide-header">
                    <span className="material-slide-number">SLIDE {index + 1} OF {preview.slides.length}</span>
                    <button type="button" className="material-toggle-view-btn" onClick={() => setUseTextFallback(false)}>
                      Switch to Rich Presentation View
                    </button>
                  </div>
                  <div className="material-slide-content">
                    {slide.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                  </div>
                </article>
              )) : <p className="material-preview-empty">No readable slide text was found.</p>}
            </div>
          ) : (
            <PptxViewer
              buffer={preview.buffer}
              fileName={material?.originalFileName}
              onFallback={() => setUseTextFallback(true)}
            />
          )
        ) : preview.kind === 'image' ? (
          <div className="material-image-viewer">
            <img src={preview.url} alt={material?.title} className="material-image-content" />
          </div>
        ) : (
          <div className="material-preview-state unsupported">
            <div className="material-preview-file-icon-large"><FileText size={48} strokeWidth={1.2} /></div>
            <strong>In-browser preview unavailable</strong>
            <p>{preview.error || 'This file format cannot be previewed directly.'}</p>
            {material && (
              <button className="material-action-btn primary" type="button" onClick={downloadMaterial}>
                <Download size={15} />Download file
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
