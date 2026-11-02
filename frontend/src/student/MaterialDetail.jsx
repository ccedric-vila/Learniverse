import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  MessageCircle,
  Minimize2,
  Send,
  User,
  Presentation,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import { extractOfficeText } from './materialPreview'
import DocxViewer from './DocxViewer'
import PptxViewer from './PptxViewer'
import './student.css'

function formatDate(date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0.0 MB'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export default function MaterialDetail() {
  const { classId, materialId } = useParams()
  const [materialState, setMaterialState] = useState({ id: null, material: null, error: '' })
  const [commentsState, setCommentsState] = useState({ id: null, comments: [], error: '' })
  const [submissionState, setSubmissionState] = useState({ id: null, submission: null, error: '', message: '' })
  const [commentText, setCommentText] = useState('')
  const [submissionText, setSubmissionText] = useState('')
  const [submissionFile, setSubmissionFile] = useState(null)
  const [posting, setPosting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Preview state
  const [previewState, setPreviewState] = useState({
    loading: true,
    kind: '',
    url: '',
    buffer: null,
    paragraphs: [],
    slides: [],
    error: '',
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [useTextFallback, setUseTextFallback] = useState(false)

  // Fetch material info and comments
  useEffect(() => {
    let active = true
    api.get(`/student/materials/${materialId}`)
      .then(({ data }) => {
        if (active) setMaterialState({ id: materialId, material: data.material, error: '' })
      })
      .catch((error) => {
        if (active) setMaterialState({ id: materialId, material: null, error: error.response?.data?.message || 'Could not load material details.' })
      })

    api.get(`/student/materials/${materialId}/comments`)
      .then(({ data }) => {
        if (active) setCommentsState({ id: materialId, comments: data.comments, error: '' })
      })
      .catch((error) => {
        if (active) setCommentsState({ id: materialId, comments: [], error: error.response?.data?.message || 'Could not load comments.' })
      })

    return () => { active = false }
  }, [materialId])

  useEffect(() => {
    if (materialState.id !== materialId || !materialState.material) {
      setSubmissionState({ id: materialId, submission: null, error: '', message: '' })
      return
    }

    const material = materialState.material
    if (String(material.category || 'lesson').trim().toLowerCase() === 'lesson') {
      setSubmissionState({ id: materialId, submission: null, error: '', message: '' })
      return
    }

    let active = true
    api.get(`/student/materials/${materialId}/submission`)
      .then(({ data }) => {
        if (active) {
          setSubmissionState({ id: materialId, submission: data.submission, error: '', message: '' })
          setSubmissionText(data.submission?.status === 'draft' ? data.submission.text || '' : '')
        }
      })
      .catch((error) => {
        if (!active) return
        if (error.response?.status === 404) {
          setSubmissionState({ id: materialId, submission: null, error: '', message: '' })
          return
        }
        setSubmissionState({ id: materialId, submission: null, error: error.response?.data?.message || 'Could not load your submission.', message: '' })
      })

    return () => { active = false }
  }, [materialId, materialState.id, materialState.material])

  // Fetch actual file preview
  useEffect(() => {
    let active = true
    let objectUrl = ''

    if (materialState.id !== materialId || !materialState.material) {
      setPreviewState({ loading: true, kind: '', url: '', buffer: null, paragraphs: [], slides: [], error: '' })
      return () => { active = false }
    }

    const material = materialState.material
    setPreviewState({ loading: true, kind: '', url: '', buffer: null, paragraphs: [], slides: [], error: '' })
    setUseTextFallback(false)

    api.get(`/student/materials/${materialId}/preview`, { responseType: 'blob' })
      .then(async ({ data }) => {
        if (!active) return
        const fileName = (material.originalFileName || '').toLowerCase()
        const mime = (material.mimeType || '').toLowerCase()
        const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''

        if (mime === 'application/pdf' || extension === '.pdf') {
          objectUrl = URL.createObjectURL(data)
          setPreviewState({ loading: false, kind: 'pdf', url: objectUrl, buffer: null, paragraphs: [], slides: [], error: '' })
        } else if (extension === '.docx' || extension === '.doc') {
          try {
            const arrayBuf = await data.arrayBuffer()
            let content = { paragraphs: [] }
            try { content = extractOfficeText(arrayBuf, extension) } catch { /* ignore fallback error */ }
            if (active) {
              setPreviewState({
                loading: false,
                kind: 'docx',
                url: '',
                buffer: arrayBuf,
                paragraphs: content.paragraphs || [],
                slides: [],
                error: '',
              })
            }
          } catch {
            if (active) setPreviewState({ loading: false, kind: 'unsupported', url: '', buffer: null, paragraphs: [], slides: [], error: 'Could not load document file.' })
          }
        } else if (extension === '.pptx' || extension === '.ppt') {
          try {
            const arrayBuf = await data.arrayBuffer()
            let content = { slides: [] }
            try { content = extractOfficeText(arrayBuf, extension) } catch { /* ignore fallback error */ }
            if (active) {
              setPreviewState({
                loading: false,
                kind: 'pptx',
                url: '',
                buffer: arrayBuf,
                paragraphs: [],
                slides: content.slides || [],
                error: '',
              })
            }
          } catch {
            if (active) setPreviewState({ loading: false, kind: 'unsupported', url: '', buffer: null, paragraphs: [], slides: [], error: 'Could not load presentation file.' })
          }
        } else if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) {
          objectUrl = URL.createObjectURL(data)
          setPreviewState({ loading: false, kind: 'image', url: objectUrl, buffer: null, paragraphs: [], slides: [], error: '' })
        } else {
          setPreviewState({
            loading: false,
            kind: 'unsupported',
            url: '',
            buffer: null,
            paragraphs: [],
            slides: [],
            error: 'This file format cannot be displayed directly in the browser. Please download it to view.',
          })
        }
      })
      .catch(async (error) => {
        if (!active) return
        let message = error.response?.data?.message || 'Could not open preview for this file.'
        if (error.response?.data instanceof Blob) {
          try {
            const parsed = JSON.parse(await error.response.data.text())
            message = parsed.message || message
          } catch {
            // Keep default message
          }
        }
        setPreviewState({ loading: false, kind: 'error', url: '', buffer: null, paragraphs: [], slides: [], error: message })
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [materialId, materialState.id, materialState.material])

  // Fullscreen escape key & lock background scroll
  useEffect(() => {
    if (!isFullscreen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  const loading = materialState.id !== materialId
  const material = loading ? null : materialState.material
  const materialError = loading ? '' : materialState.error
  const comments = commentsState.id === materialId ? commentsState.comments : []
  const requiresSubmission = Boolean(material) && String(material.category || 'lesson').trim().toLowerCase() !== 'lesson'
  const isQuiz = String(material?.category || '').trim().toLowerCase() === 'quiz'
  const pointsPossible = Number(material?.pointsPossible || 100)
  const minimumPassingPoints = Number((pointsPossible * 0.7).toFixed(2))

  async function submitWork(event) {
    event.preventDefault()
    if (!requiresSubmission) return
    const text = submissionText.trim()
    if (!submissionFile && !text) {
      setSubmissionState((current) => ({ ...current, error: 'Choose a file or add a note before submitting your work.' }))
      return
    }

    setSubmitting(true)
    setSubmissionState((current) => ({ ...current, error: '', message: '' }))

    try {
      const formData = new FormData()
      if (text) formData.append('text', text)
      if (submissionFile) formData.append('file', submissionFile)
      const { data } = await api.post(`/student/materials/${materialId}/submissions`, formData)
      setSubmissionState({ id: materialId, submission: data.submission, error: '', message: data.message || 'Your work was saved as a draft.' })
      setSubmissionFile(null)
      event.target.reset()
    } catch (error) {
      setSubmissionState((current) => ({ ...current, error: error.response?.data?.message || 'Could not submit your work.' }))
    } finally {
      setSubmitting(false)
    }
  }

  async function turnInWork() {
    const existingDraft = submissionState.submission?.status === 'draft'
    const alreadyTurnedIn = Boolean(submissionState.submission && submissionState.submission.status !== 'draft')
    if (!existingDraft && !alreadyTurnedIn && !submissionFile && !submissionText.trim()) {
      setSubmissionState((current) => ({ ...current, error: 'Add a note or upload a file before turning in your work.' }))
      return
    }
    if (!window.confirm('Turn in this work now? The submission time will be recorded, and you will not be able to edit it afterward.')) return

    setSubmitting(true)
    setSubmissionState((current) => ({ ...current, error: '', message: '' }))
    try {
      if (!alreadyTurnedIn) {
        const formData = new FormData()
        if (submissionText.trim()) formData.append('text', submissionText.trim())
        if (submissionFile) formData.append('file', submissionFile)
        await api.post(`/student/materials/${materialId}/submissions`, formData)
      }
      const { data } = await api.post(`/student/materials/${materialId}/submissions/turn-in`)
      setSubmissionState({ id: materialId, submission: data.submission, error: '', message: data.message })
      setSubmissionText('')
      setSubmissionFile(null)
    } catch (error) {
      setSubmissionState((current) => ({ ...current, error: error.response?.data?.message || 'Could not turn in your work.' }))
    } finally {
      setSubmitting(false)
    }
  }

  async function postComment(event) {
    event.preventDefault()
    const text = commentText.trim()
    if (!text) return
    setPosting(true)
    setCommentsState((current) => ({ ...current, error: '' }))
    try {
      const { data } = await api.post(`/student/materials/${materialId}/comments`, { text })
      setCommentsState((current) => ({ ...current, id: materialId, comments: [...current.comments, data.comment] }))
      setCommentText('')
    } catch (error) {
      setCommentsState((current) => ({ ...current, error: error.response?.data?.message || 'Could not post your comment.' }))
    } finally {
      setPosting(false)
    }
  }

  async function downloadMaterial() {
    setDownloading(true)
    try {
      const { data } = await api.get(`/student/materials/${materialId}/download`)
      window.location.assign(data.url)
    } catch (error) {
      setCommentsState((current) => ({ ...current, error: error.response?.data?.message || 'Could not prepare this download.' }))
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

  if (loading) {
    return (
      <main className="material-detail-page material-detail-loading">
        <div className="material-preview-spinner" />
        <p>Loading class material…</p>
      </main>
    )
  }

  if (materialError || !material) {
    return (
      <main className="material-detail-page">
        <Link className="material-back-link" to={`/student/classes/${classId}`}>
          <ArrowLeft size={16} /> Back to class
        </Link>
        <p className="student-alert" role="alert">{materialError || 'Material not found.'}</p>
      </main>
    )
  }

  return (
    <main className="material-detail-page">
      {/* Top navigation */}
      <nav className="material-nav-bar">
        <Link className="material-back-link" to={`/student/classes/${classId}`}>
          <ArrowLeft size={16} />
          <span>Back to {material.classOffering?.subject?.name || 'Class'}</span>
        </Link>
      </nav>

      {/* Main Material Header Card */}
      <header className="material-hero-header">
        <div className="material-hero-main">
          <div className="material-pill-group">
            <span className="material-tag-badge">CLASS MATERIAL</span>
            <span className="material-tag-badge subtle">{(material.category || 'lesson').toUpperCase()}</span>
            {material.classOffering?.subject?.subjectCode && (
              <span className="material-tag-badge subtle">{material.classOffering.subject.subjectCode}</span>
            )}
            {material.classOffering?.section && (
              <span className="material-tag-badge subtle">SECTION {material.classOffering.section}</span>
            )}
          </div>
          <h1 className="material-main-title">{material.title}</h1>
          <div className="material-meta-row">
            <span className="material-meta-item">
              <Calendar size={14} />
              <span>Shared {formatDate(material.availableAt)}</span>
            </span>
            <span className="material-meta-dot">•</span>
            <span className="material-meta-item">
              <User size={14} />
              <span>{material.classOffering?.professor?.fullName || 'Professor'}</span>
            </span>
            <span className="material-meta-dot">•</span>
            <span className="material-meta-item">
              <FileText size={14} />
              <span>{material.originalFileName} ({formatFileSize(material.fileSize)})</span>
            </span>
            {material.category !== 'lesson' && material.pointsPossible && <>
              <span className="material-meta-dot">•</span>
              <span className="material-meta-item"><CheckCircle2 size={14} /><span>{material.pointsPossible} points · {minimumPassingPoints} points to pass (70%)</span></span>
            </>}
          </div>
        </div>

        <div className="material-hero-actions">
          <button
            className="material-action-btn primary"
            type="button"
            onClick={downloadMaterial}
            disabled={downloading}
          >
            <Download size={16} />
            <span>{downloading ? 'Preparing…' : isQuiz ? 'Download Quiz' : 'Download File'}</span>
          </button>
        </div>
      </header>

      {requiresSubmission && (
        <section className="material-card material-submission-card">
          <header className="material-card-header">
            <div className="material-card-title">
              <BookOpen size={18} />
              <h2>{isQuiz ? 'Submit your completed quiz' : 'Submit your work'}</h2>
            </div>
          </header>
          <div className="material-card-body">
            {submissionState.message && <p className="material-message" role="status">{submissionState.message}</p>}
            {submissionState.error && <p className="student-alert" role="alert">{submissionState.error}</p>}
            {isQuiz && <p className="material-submission-instructions">Download the quiz file, complete it, then upload your answers before the deadline. Your professor will review and score your submission.</p>}
            {submissionState.submission && submissionState.submission.status !== 'draft' ? (
              <div className="material-submission-summary">
                <div className="material-submission-status-row">
                  <span className={`material-status ${material.deadline && new Date(submissionState.submission.submittedAt) > new Date(material.deadline) ? 'scheduled' : 'published'}`}>
                    {material.deadline && new Date(submissionState.submission.submittedAt) > new Date(material.deadline) ? 'Turned in late' : 'Turned in on time'}
                  </span>
                  {submissionState.submission.pointsEarned !== null && submissionState.submission.pointsEarned !== undefined && (
                    <span className={`student-grade-result ${Number(submissionState.submission.pointsEarned) >= Number(material.pointsPossible || 100) * 0.7 ? 'pass' : 'fail'}`}>
                      {submissionState.submission.pointsEarned} / {pointsPossible} points · {Number(submissionState.submission.pointsEarned) >= pointsPossible * 0.7 ? 'Passed' : 'Not passing'}
                    </span>
                  )}
                  {submissionState.submission.submittedAt && (
                    <small>Submitted {formatDate(submissionState.submission.submittedAt)}</small>
                  )}
                </div>
                {submissionState.submission.feedback && <div className="student-grade-feedback"><strong>Professor feedback</strong><p>{submissionState.submission.feedback}</p></div>}
                {submissionState.submission.text && <p>{submissionState.submission.text}</p>}
                {submissionState.submission.originalFileName && (
                  <a className="material-submission-link" href={submissionState.submission.downloadUrl || '#'} target="_blank" rel="noreferrer">
                    Download: {submissionState.submission.originalFileName}
                  </a>
                )}
              </div>
            ) : (
              <form className="material-submission-form" onSubmit={submitWork}>
                {submissionState.submission?.status === 'draft' && (
                  <div className="material-draft-notice" role="status">
                    <strong>Draft saved — not turned in</strong>
                    <span>Your professor cannot see this work until you select Turn in.</span>
                    {submissionState.submission.originalFileName && <small>Attached: {submissionState.submission.originalFileName}</small>}
                  </div>
                )}
                <label className="material-field material-field-wide">
                  <span>Notes</span>
                  <textarea rows="3" maxLength="2000" value={submissionText} onChange={(event) => setSubmissionText(event.target.value)} placeholder="Add instructions, notes, or a written response for this task." />
                </label>
                <label className="material-field material-field-wide">
                  <span>{isQuiz ? 'Upload completed quiz' : 'Upload work'}</span>
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)} />
                </label>
                <div className="material-form-actions">
                  <button className="classroom-copy-button" type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : submissionState.submission?.status === 'draft' ? 'Save draft' : 'Save work'}
                  </button>
                  <button className="student-turn-in-button" type="button" onClick={turnInWork} disabled={submitting}>
                    <CheckCircle2 size={15} /> {submitting ? 'Turning in…' : 'Turn in'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {/* Main 2-Column Layout */}
      <div className="material-main-layout">
        {/* Left Column: Instructions & Details */}
        <aside className="material-layout-left">
          {/* Card 1: Instructions & Overview */}
          <section className="material-card material-instructions-card">
            <header className="material-card-header">
              <div className="material-card-title">
                <BookOpen size={18} />
                <h2>Instructions &amp; Overview</h2>
              </div>
            </header>
            <div className="material-card-body">
              <div className="material-instructions-content">
                {material.description ? (
                  <p>{material.description}</p>
                ) : (
                  <p className="material-empty-description">
                    No instructions or description were provided for this material.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Card 2: Material Details */}
          <section className="material-card material-details-card">
            <header className="material-card-header">
              <div className="material-card-title">
                <FileText size={18} />
                <h2>Material Details</h2>
              </div>
            </header>
            <div className="material-card-body">
              <div className="material-metadata-stack">
                <div className="material-meta-field">
                  <label>FILE NAME</label>
                  <span>{material.originalFileName}</span>
                </div>
                <div className="material-meta-field">
                  <label>FILE SIZE</label>
                  <span>{formatFileSize(material.fileSize)}</span>
                </div>
                <div className="material-meta-field">
                  <label>SUBJECT</label>
                  <span>{material.classOffering?.subject?.name || 'Class'} ({material.classOffering?.subject?.subjectCode || '—'})</span>
                </div>
                <div className="material-meta-field">
                  <label>SECTION</label>
                  <span>Section {material.classOffering?.section || '—'}</span>
                </div>
                <div className="material-meta-field">
                  <label>UPLOADED BY</label>
                  <span>{material.classOffering?.professor?.fullName || 'Professor'}</span>
                </div>
                <div className="material-meta-field">
                  <label>CATEGORY</label>
                  <span>{material.category ? material.category.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Lesson'}</span>
                </div>
                {material.deadline && <div className="material-meta-field">
                  <label>DEADLINE</label>
                  <span>{formatDate(material.deadline)}</span>
                </div>}
                {material.category !== 'lesson' && <div className="material-meta-field">
                  <label>POINTS / PASSING SCORE</label>
                  <span>{pointsPossible} total points · {minimumPassingPoints} points to pass (70%)</span>
                </div>}
                <div className="material-meta-field">
                  <label>SHARED DATE</label>
                  <span>{formatDate(material.availableAt)}</span>
                </div>
              </div>
            </div>
          </section>
        </aside>

        {/* Right Column: File Preview + Class Discussion */}
        <div className="material-layout-right">
          {/* File Preview Canvas */}
          <section
            className={`material-preview-section ${isFullscreen ? 'is-fullscreen' : ''}`}
            aria-label="Class file preview"
          >
            {/* Preview Toolbar */}
            <div className="material-preview-toolbar">
              <div className="material-preview-toolbar-left">
                <span className="material-preview-file-icon">
                  {previewState.kind === 'pptx' ? <Presentation size={16} /> : <FileText size={16} />}
                </span>
                <span className="material-preview-filename" title={material.originalFileName}>
                  {material.originalFileName}
                </span>
                <span className="material-preview-size-badge">
                  {formatFileSize(material.fileSize)}
                </span>
              </div>

              <div className="material-preview-toolbar-right">
                {previewState.kind === 'pdf' && previewState.url && (
                  <a
                    href={previewState.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="material-toolbar-btn"
                    title="Open PDF in new tab"
                  >
                    <ExternalLink size={15} />
                    <span>New tab</span>
                  </a>
                )}
                {(previewState.kind === 'docx' || previewState.kind === 'pptx') && (
                  <button
                    type="button"
                    className="material-toolbar-btn"
                    onClick={openInOfficeViewer}
                    title="Open in Microsoft Office Online Viewer"
                  >
                    <ExternalLink size={15} />
                    <span>Office Online</span>
                  </button>
                )}
                <button
                  type="button"
                  className="material-toolbar-btn"
                  onClick={downloadMaterial}
                  disabled={downloading}
                  title="Download file"
                >
                  <Download size={15} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  className={`material-toolbar-btn expand-btn ${isFullscreen ? 'active' : ''}`}
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Cover whole page (Fullscreen)'}
                >
                  {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  <span>{isFullscreen ? 'Exit full page' : 'Cover whole page'}</span>
                </button>
              </div>
            </div>

            {/* Preview Viewer Canvas */}
            <div className="material-preview-canvas">
              {previewState.loading ? (
                <div className="material-preview-state">
                  <div className="material-preview-spinner" />
                  <strong>Opening {material.originalFileName}…</strong>
                  <p>Preparing document preview</p>
                </div>
              ) : previewState.error ? (
                <div className="material-preview-state error">
                  <div className="material-preview-alert-icon">
                    <AlertCircle size={38} strokeWidth={1.5} />
                  </div>
                  <strong>Could not preview this file</strong>
                  <p>{previewState.error}</p>
                  <button className="material-action-btn primary" type="button" onClick={downloadMaterial}>
                    <Download size={15} />
                    <span>Download file to view</span>
                  </button>
                </div>
              ) : previewState.kind === 'pdf' ? (
                <iframe
                  className="material-preview-pdf"
                  title={`Preview: ${material.title}`}
                  src={previewState.url}
                />
              ) : previewState.kind === 'docx' ? (
                useTextFallback ? (
                  <div className="material-document-viewer">
                    <div className="material-document-sheet">
                      <div className="material-document-sheet-header">
                        <strong>{material.originalFileName}</strong>
                        <button
                          type="button"
                          className="material-toggle-view-btn"
                          onClick={() => setUseTextFallback(false)}
                        >
                          Switch to Rich Document View
                        </button>
                      </div>
                      {previewState.paragraphs.length > 0 ? (
                        previewState.paragraphs.map((para, idx) => <p key={idx}>{para}</p>)
                      ) : (
                        <p className="material-preview-empty">No readable text found in document.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <DocxViewer
                    buffer={previewState.buffer}
                    fileName={material.originalFileName}
                    onFallback={() => setUseTextFallback(true)}
                  />
                )
              ) : previewState.kind === 'pptx' ? (
                useTextFallback ? (
                  <div className="material-slides-viewer">
                    {previewState.slides.length > 0 ? (
                      previewState.slides.map((slide, idx) => (
                        <article className="material-slide-card" key={idx}>
                          <div className="material-slide-header">
                            <span className="material-slide-number">SLIDE {idx + 1} OF {previewState.slides.length}</span>
                            <button
                              type="button"
                              className="material-toggle-view-btn"
                              onClick={() => setUseTextFallback(false)}
                            >
                              Switch to Rich Presentation View
                            </button>
                          </div>
                          <div className="material-slide-content">
                            {slide.map((line, lIdx) => (
                              <p key={lIdx}>{line}</p>
                            ))}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="material-preview-empty">No slide content found.</p>
                    )}
                  </div>
                ) : (
                  <PptxViewer
                    buffer={previewState.buffer}
                    fileName={material.originalFileName}
                    onFallback={() => setUseTextFallback(true)}
                  />
                )
              ) : previewState.kind === 'image' ? (
                <div className="material-image-viewer">
                  <img src={previewState.url} alt={material.title} className="material-image-content" />
                </div>
              ) : (
                <div className="material-preview-state unsupported">
                  <div className="material-preview-file-icon-large">
                    <FileText size={52} strokeWidth={1.2} />
                  </div>
                  <strong>In-browser preview unavailable</strong>
                  <p>{previewState.error || 'This file format cannot be previewed directly in the browser.'}</p>
                  <button className="material-action-btn primary" type="button" onClick={downloadMaterial}>
                    <Download size={15} />
                    <span>Download {material.originalFileName}</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Class Discussion */}
          <section className="material-card material-comments-card" id="comments">
            <header className="material-card-header">
              <div className="material-card-title">
                <MessageCircle size={18} />
                <h2>Class Discussion</h2>
              </div>
              <span className="material-comments-pill">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </span>
            </header>

            <div className="material-card-body">
              {commentsState.id === materialId && commentsState.error && (
                <p className="student-alert" role="alert">{commentsState.error}</p>
              )}

              {/* Comment Form */}
              <form className="material-comment-form" onSubmit={postComment}>
                <div className="material-comment-input-wrap">
                  <textarea
                    id="material-comment"
                    required
                    maxLength={2000}
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Ask a question or share a thought about this material…"
                  />
                </div>
                <div className="material-comment-form-footer">
                  <small className="material-char-counter">{commentText.length}/2000</small>
                  <button
                    className="material-post-button"
                    type="submit"
                    disabled={posting || !commentText.trim()}
                  >
                    <Send size={14} />
                    <span>{posting ? 'Posting…' : 'Post comment'}</span>
                  </button>
                </div>
              </form>

              {/* Comment Stream */}
              <div className="material-comments-list">
                {comments.length === 0 ? (
                  <div className="material-comments-empty">
                    <div className="material-comments-empty-icon">
                      <MessageCircle size={24} />
                    </div>
                    <strong>No comments yet</strong>
                    <p>Have a question about this material? Start the discussion above.</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <article className="material-comment-item" key={comment._id}>
                      <span className="material-comment-avatar">
                        {comment.student?.fullName?.charAt(0)?.toUpperCase() || 'S'}
                      </span>
                      <div className="material-comment-content">
                        <header className="material-comment-item-header">
                          <strong className="material-comment-author">
                            {comment.student?.fullName || 'Student'}
                          </strong>
                          <time className="material-comment-time">
                            {formatDate(comment.createdAt)}
                          </time>
                        </header>
                        <p className="material-comment-text">{comment.text}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
