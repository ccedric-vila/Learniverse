import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye, EyeOff, FileText, LoaderCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import { extractOfficeText } from '../student/materialPreview'
import DocxViewer from '../student/DocxViewer'
import PptxViewer from '../student/PptxViewer'
import './professor.css'

const EMPTY_SUBMISSIONS = []

function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

function formatSize(bytes) {
  if (!bytes) return '—'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function canPreview(file) {
  const name = (file?.originalFileName || '').toLowerCase()
  const mime = (file?.mimeType || '').toLowerCase()
  return mime === 'application/pdf' || mime.startsWith('image/') || /\.(pdf|png|jpe?g|gif|webp|bmp|docx|pptx)$/.test(name)
}

function getFileKind(file) {
  const name = (file?.originalFileName || '').toLowerCase()
  const mime = (file?.mimeType || '').toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/.test(name)) return 'image'
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'
  if (name.endsWith('.pptx')) return 'pptx'
  return 'unsupported'
}

function sortSubmissionsByLastName(submissions) {
  return [...submissions].sort((first, second) => {
    const firstName = first.student?.fullName?.trim() || 'Student'
    const secondName = second.student?.fullName?.trim() || 'Student'
    const firstLastName = firstName.split(/\s+/).at(-1)
    const secondLastName = secondName.split(/\s+/).at(-1)
    return firstLastName.localeCompare(secondLastName, undefined, { sensitivity: 'base' })
      || firstName.localeCompare(secondName, undefined, { sensitivity: 'base' })
  })
}

export default function ProfessorMaterialReview() {
  const { materialId } = useParams()
  const [materialState, setMaterialState] = useState({ id: null, material: null, error: '' })
  const [submissionsState, setSubmissionsState] = useState({ id: null, submissions: [], error: '', loading: true })
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('')
  const [isPreviewVisible, setIsPreviewVisible] = useState(true)
  const [filePreview, setFilePreview] = useState({ key: '', url: '', kind: '', buffer: null, paragraphs: [], slides: [], error: '', loading: false })
  const [gradeDraft, setGradeDraft] = useState({ submissionId: '', points: '', feedback: '' })
  const [gradeState, setGradeState] = useState({ saving: false, error: '', message: '' })

  useEffect(() => {
    let active = true

    async function loadMaterialReview() {
      try {
        const { data } = await api.get(`/professor/materials/${materialId}`)
        if (!active) return
        const loadedMaterial = data.material
        setMaterialState({ id: materialId, material: loadedMaterial, error: '' })
        setSelectedSubmissionId('')
        if (String(loadedMaterial.category || 'lesson').toLowerCase() === 'lesson') {
          setSubmissionsState({ id: materialId, submissions: [], error: '', loading: false })
          return
        }

        try {
          const submissionsResponse = await api.get(`/professor/materials/${materialId}/submissions`)
          if (!active) return
          setSubmissionsState({ id: materialId, submissions: submissionsResponse.data.submissions || [], error: '', loading: false })
        } catch (submissionsError) {
          if (!active) return
          setSubmissionsState({
            id: materialId,
            submissions: [],
            error: submissionsError.response?.data?.message || 'Could not load student submissions.',
            loading: false,
          })
        }
      } catch (error) {
        if (!active) return
        const message = error.response?.data?.message || 'Could not load this class material.'
        setMaterialState({ id: materialId, material: null, error: message })
        setSubmissionsState({ id: materialId, submissions: [], error: message, loading: false })
      }
    }

    loadMaterialReview()

    return () => { active = false }
  }, [materialId])

  const material = materialState.id === materialId ? materialState.material : null
  const submissionsStateMatches = submissionsState.id === materialId
  const submissions = submissionsStateMatches ? submissionsState.submissions : EMPTY_SUBMISSIONS
  const submissionsLoading = !submissionsStateMatches || submissionsState.loading
  const submissionsError = submissionsStateMatches ? submissionsState.error : ''
  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission._id === selectedSubmissionId) || null,
    [submissions, selectedSubmissionId],
  )
  const gradeDraftMatches = gradeDraft.submissionId === selectedSubmission?._id
  const gradePoints = gradeDraftMatches
    ? gradeDraft.points
    : selectedSubmission?.pointsEarned === null || selectedSubmission?.pointsEarned === undefined
      ? ''
      : String(selectedSubmission.pointsEarned)
  const gradeFeedback = gradeDraftMatches ? gradeDraft.feedback : selectedSubmission?.feedback || ''
  const isAssessment = String(material?.category || 'lesson').toLowerCase() !== 'lesson'
  const isQuiz = String(material?.category || '').toLowerCase() === 'quiz'
  const assessmentLabel = isQuiz ? 'Quiz' : 'Seatwork'
  const selectedFile = selectedSubmission || material
  const pointsPossible = Number(material?.pointsPossible || 100)
  const minimumPassingPoints = Number((pointsPossible * 0.7).toFixed(2))
  const previewKey = selectedSubmission ? `submission:${selectedSubmission._id}` : `material:${materialId}`
  const isPreviewable = Boolean(selectedFile && canPreview(selectedFile))
  const activeFilePreview = filePreview.key === previewKey ? filePreview : {
    key: previewKey,
    url: '',
    kind: isPreviewable ? '' : 'unsupported',
    buffer: null,
    paragraphs: [],
    slides: [],
    error: '',
    loading: isPreviewable,
  }
  const handleOfficeFallback = useCallback(() => {
    setFilePreview((current) => ({ ...current, kind: 'unsupported', error: 'This Office file could not be rendered in the browser. Download it to view.' }))
  }, [])

  useEffect(() => {
    if (!selectedFile || !canPreview(selectedFile)) return undefined

    let active = true
    let objectUrl = ''
    const endpoint = selectedSubmission
      ? `/professor/materials/${materialId}/submissions/${selectedSubmission._id}/preview`
      : `/professor/materials/${materialId}/preview`

    api.get(endpoint, { responseType: 'blob' }).then(({ data }) => {
      if (!active) return
      const kind = getFileKind(selectedFile)
      if (kind === 'docx' || kind === 'pptx') {
        data.arrayBuffer().then((buffer) => {
          if (!active) return
          try {
            const extracted = extractOfficeText(buffer, (selectedFile.originalFileName || '').toLowerCase().endsWith('x') ? (kind === 'docx' ? '.docx' : '.pptx') : (kind === 'docx' ? '.doc' : '.ppt'))
            setFilePreview({
              key: previewKey,
              url: '',
              kind,
              buffer,
              paragraphs: extracted.paragraphs || [],
              slides: extracted.slides || [],
              error: '',
              loading: false,
            })
          } catch {
            setFilePreview({ key: previewKey, url: '', kind: 'unsupported', buffer: null, paragraphs: [], slides: [], error: 'Could not read this Office file. Download it to view.', loading: false })
          }
        })
        return
      }
      objectUrl = URL.createObjectURL(data)
      setFilePreview({ key: previewKey, url: objectUrl, kind, buffer: null, paragraphs: [], slides: [], error: '', loading: false })
    }).catch(async (error) => {
      if (!active) return
      let message = error.response?.data?.message || 'Could not load the file preview.'
      if (error.response?.data instanceof Blob) {
        try {
          const details = JSON.parse(await error.response.data.text())
          message = details.message || message
        } catch { /* Keep the default message. */ }
      }
      setFilePreview({ key: previewKey, url: '', kind: '', buffer: null, paragraphs: [], slides: [], error: message, loading: false })
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [materialId, previewKey, selectedFile, selectedSubmission])

  async function downloadSelectedFile() {
    if (!selectedFile) return
    const endpoint = selectedSubmission
      ? `/professor/materials/${materialId}/submissions/${selectedSubmission._id}/preview`
      : `/professor/materials/${materialId}/download`
    try {
      const { data } = await api.get(endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = selectedFile.originalFileName || 'class-file'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      setFilePreview((current) => ({ ...current, error: 'Could not download this file. Please try again.' }))
    }
  }

  function selectSubmission(submissionId) {
    setSelectedSubmissionId(submissionId)
    setIsPreviewVisible(true)
    setGradeState({ saving: false, error: '', message: '' })
  }

  async function saveGrade(event) {
    event.preventDefault()
    if (!selectedSubmission) return
    setGradeState({ saving: true, error: '', message: '' })
    try {
      const { data } = await api.patch(`/professor/materials/${materialId}/submissions/${selectedSubmission._id}/grade`, {
        pointsEarned: gradePoints,
        feedback: gradeFeedback,
      })
      setSubmissionsState((current) => ({
        ...current,
        submissions: current.submissions.map((submission) => submission._id === data.submission._id ? { ...submission, ...data.submission } : submission),
      }))
      setGradeState({ saving: false, error: '', message: data.notificationWarning || data.message })
    } catch (error) {
      setGradeState({ saving: false, error: error.response?.data?.message || 'Could not save this score.', message: '' })
    }
  }

  const isLoading = materialState.id !== materialId || (!material && !materialState.error)
  if (isLoading) {
    return <main className="professor-dashboard professor-review-page"><p className="professor-empty"><LoaderCircle size={18} /> Loading task review…</p></main>
  }
  if (materialState.error || !material) {
    return <main className="professor-dashboard professor-review-page"><Link className="professor-back-link" to="/professor"><ArrowLeft size={15} /> Back to dashboard</Link><div className="professor-error" role="alert">{materialState.error || 'Task not found.'}</div></main>
  }

  return (
    <main className="professor-dashboard professor-review-page">
      <Link className="professor-back-link" to={`/professor/classes/${material.classOffering?._id || ''}`}><ArrowLeft size={15} /> Back to classroom</Link>
      <header className="professor-review-hero">
        <div>
          <span className="professor-eyebrow">{isAssessment ? `${assessmentLabel.toUpperCase()} · SUBMISSION REVIEW` : 'CLASS MATERIAL · FILE PREVIEW'}</span>
          <h1>{material.title}</h1>
          <p>{material.classOffering?.subject?.name || 'Class'} · Section {material.classOffering?.section || '—'} · {material.classOffering?.schoolYear || ''} {material.classOffering?.term || ''}</p>
        </div>
        <span className="professor-classroom-icon"><Eye size={28} /></span>
      </header>

      <section className="professor-review-summary" aria-label={isAssessment ? `${assessmentLabel} overview` : 'Learning material overview'}>
        {isAssessment ? <>
          <article><span>Category</span><strong>{assessmentLabel}</strong></article>
          <article><span>Deadline</span><strong>{formatDate(material.deadline)}</strong></article>
          <article><span>Student submissions</span><strong>{submissionsLoading ? 'Loading…' : submissions.length}</strong></article>
          <article><span>Points · passing score</span><strong>{pointsPossible} points · 70% ({minimumPassingPoints} points)</strong></article>
        </> : <>
          <article><span>Category</span><strong>Lesson</strong></article>
          <article><span>File size</span><strong>{formatSize(material.fileSize)}</strong></article>
          <article><span>Uploaded</span><strong>{formatDate(material.createdAt)}</strong></article>
        </>}
      </section>

      <div className="professor-review-grid">
        <aside className="professor-review-sidebar">
          <section className="professor-review-card">
            <div className="professor-review-card-heading"><div><span className="professor-eyebrow">{isAssessment ? 'PROFESSOR UPLOAD' : 'SHARED WITH STUDENTS'}</span><h2>{isAssessment ? `${assessmentLabel} overview` : 'Learning material'}</h2></div><FileText size={18} /></div>
            <p className="professor-review-description">{material.description || (isAssessment ? `No additional ${isQuiz ? 'quiz' : 'seatwork'} instructions were added.` : 'No additional notes were added for this learning material.')}</p>
            <div className="professor-review-file-meta"><strong>{material.originalFileName}</strong><span>{formatSize(material.fileSize)} · Uploaded {formatDate(material.createdAt)}</span></div>
            <button className="classroom-copy-button professor-review-download" type="button" onClick={() => selectSubmission('')}><Eye size={14} />{isAssessment ? `Show ${assessmentLabel.toLowerCase()} preview` : 'Show material preview'}</button>
          </section>

          {isAssessment && <section className="professor-review-card professor-review-submissions">
            <div className="professor-review-card-heading"><div><span className="professor-eyebrow">STUDENT WORK</span><h2>Student submissions</h2></div><span className="professor-materials-count">{submissions.length}</span></div>
            {submissionsLoading ? <p className="professor-empty">Loading submissions…</p> : submissionsError ? <p className="professor-error" role="alert">{submissionsError}</p> : submissions.length === 0 ? <p className="professor-empty">No students have submitted work yet. New submissions will appear here.</p> : (
              <div className="professor-submission-list">
                {sortSubmissionsByLastName(submissions).map((submission) => (
                  <button
                    type="button"
                    className={`professor-submission-select ${selectedSubmissionId === submission._id ? 'active' : ''}`}
                    key={submission._id}
                    onClick={() => selectSubmission(submission._id)}
                  >
                    <span className="professor-submission-avatar">{submission.student?.fullName?.charAt(0)?.toUpperCase() || 'S'}</span>
                    <span className="professor-submission-copy"><strong>{submission.student?.fullName || 'Student'}</strong><small>{formatDate(submission.submittedAt)}</small><small>{submission.originalFileName || 'Text response only'}</small></span>
                    <span className="professor-submission-state"><span className={`material-status ${submission.isLate || submission.status === 'late' ? 'scheduled' : 'published'}`}>{submission.isLate || submission.status === 'late' ? 'Late' : 'Submitted'}</span><span className="professor-submission-open">Open work →</span></span>
                  </button>
                ))}
              </div>
            )}
          </section>}
        </aside>

        <section className={`professor-review-viewer-card${selectedSubmission && !isPreviewVisible ? ' preview-hidden' : ''}`} aria-label="File viewer">
          <div className="professor-review-viewer-toolbar">
            <div><span className="professor-eyebrow">{selectedSubmission ? 'STUDENT SUBMISSION · PREVIEW' : `${isAssessment ? `${assessmentLabel.toUpperCase()} FILE` : 'LEARNING MATERIAL'} · PREVIEW`}</span><strong>{selectedFile?.originalFileName || material.title}</strong></div>
            <div className="professor-review-toolbar-actions">
              {selectedFile && <button className="classroom-copy-button" type="button" aria-expanded={isPreviewVisible} aria-controls="professor-submission-preview" onClick={() => setIsPreviewVisible((visible) => !visible)}>{isPreviewVisible ? <EyeOff size={14} /> : <Eye size={14} />}{isPreviewVisible ? 'Hide preview' : 'Preview file'}</button>}
              {selectedFile && <button className="classroom-copy-button" type="button" onClick={downloadSelectedFile}><Download size={14} /> Download</button>}
            </div>
          </div>
          {isPreviewVisible && <div id="professor-submission-preview" className="professor-review-preview-content">
          {selectedSubmission?.text && <div className="professor-review-response"><strong>Student note</strong><p>{selectedSubmission.text}</p></div>}
          {!selectedFile ? <div className="professor-review-empty"><FileText size={30} /><strong>{isAssessment ? 'Select a submission to review' : 'Material preview unavailable'}</strong><span>{isAssessment ? 'Choose student work from the list to preview it here.' : 'Choose another file to preview.'}</span></div> : activeFilePreview.loading ? (
            <div className="professor-review-empty"><LoaderCircle size={24} className="professor-review-spinner" /><span>Loading file preview…</span></div>
          ) : activeFilePreview.error ? (
            <div className="professor-review-empty"><FileText size={30} /><strong>Preview unavailable</strong><span>{activeFilePreview.error}</span></div>
          ) : !canPreview(selectedFile) || activeFilePreview.kind === 'unsupported' ? (
            <div className="professor-review-empty"><FileText size={30} /><strong>Preview unavailable</strong><span>{activeFilePreview.error || 'Download the file to open it in a compatible app.'}</span></div>
          ) : activeFilePreview.kind === 'image' ? (
            <div className="professor-review-image-wrap"><img src={activeFilePreview.url} alt={selectedFile.originalFileName || 'Uploaded file'} /></div>
          ) : activeFilePreview.kind === 'docx' ? (
            <DocxViewer buffer={activeFilePreview.buffer} fileName={selectedFile.originalFileName} onFallback={handleOfficeFallback} />
          ) : activeFilePreview.kind === 'pptx' ? (
            <PptxViewer buffer={activeFilePreview.buffer} fileName={selectedFile.originalFileName} onFallback={handleOfficeFallback} />
          ) : (
            <iframe className="professor-review-pdf" src={activeFilePreview.url} title={`Preview ${selectedFile.originalFileName || material.title}`} />
          )}
          </div>}
          {selectedSubmission && (
            <form className="professor-grade-form" onSubmit={saveGrade}>
              <div className="professor-grade-heading"><div><strong>Grade this submission</strong><small>Passing requires at least {minimumPassingPoints} of {pointsPossible} points (70%).</small></div>
                {selectedSubmission.pointsEarned !== null && selectedSubmission.pointsEarned !== undefined && (
                  <span className={`professor-grade-result ${selectedSubmission.isPassing ? 'pass' : 'fail'}`}>{selectedSubmission.isPassing ? 'PASS' : 'NOT PASSING'} · {selectedSubmission.pointsEarned}/{pointsPossible}</span>
                )}
              </div>
              <div className="professor-grade-fields">
                <label className="material-field"><span>Points earned</span><input required type="number" min="0" max={pointsPossible} step="0.01" value={gradePoints} onChange={(event) => setGradeDraft((current) => ({ submissionId: selectedSubmission._id, points: event.target.value, feedback: current.submissionId === selectedSubmission._id ? current.feedback : selectedSubmission.feedback || '' }))} placeholder={`0–${pointsPossible}`} /></label>
                <label className="material-field professor-grade-feedback"><span>Feedback <small>Optional</small></span><textarea rows="2" maxLength="2000" value={gradeFeedback} onChange={(event) => setGradeDraft((current) => ({ submissionId: selectedSubmission._id, points: current.submissionId === selectedSubmission._id ? current.points : selectedSubmission.pointsEarned === null || selectedSubmission.pointsEarned === undefined ? '' : String(selectedSubmission.pointsEarned), feedback: event.target.value }))} placeholder="Add feedback for the student" /></label>
              </div>
              {gradeState.error && <p className="professor-error" role="alert">{gradeState.error}</p>}
              {gradeState.message && <p className="professor-grade-message" role="status">{gradeState.message}</p>}
              <div className="professor-grade-actions"><button className="classroom-copy-button" type="submit" disabled={gradeState.saving}>{gradeState.saving ? 'Saving score…' : 'Save score & feedback'}</button></div>
            </form>
          )}
          {selectedSubmission && <div className="professor-review-footer"><FileText size={14} /> Reviewing work submitted by {selectedSubmission.student?.fullName || 'Student'} at {formatDate(selectedSubmission.submittedAt)}</div>}
        </section>
      </div>
    </main>
  )
}
