import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, CalendarDays, Clock3, Download, FileText, FolderOpen, MapPin, MessageSquareText } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import StudentQuizSection from './StudentQuizSection'
import './student.css'

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export default function StudentClassroom() {
  const { classId } = useParams()
  const location = useLocation()
  const [request, setRequest] = useState({ classId: null, offering: null, error: '' })
  const [activeTab, setActiveTab] = useState('stream')
  const [materialsState, setMaterialsState] = useState({ classId: null, materials: [], error: '' })
  const [downloadingId, setDownloadingId] = useState('')

  useEffect(() => {
    let active = true
    api.get(`/student/classes/${classId}`)
      .then(({ data }) => { if (active) setRequest({ classId, offering: data.offering, error: '' }) })
      .catch((requestError) => {
        if (active) setRequest({ classId, offering: null, error: requestError.response?.data?.message || 'Could not load this class.' })
      })
    return () => { active = false }
  }, [classId])

  useEffect(() => {
    let active = true
    api.get(`/student/classes/${classId}/materials`)
      .then(({ data }) => { if (active) setMaterialsState({ classId, materials: data.materials, error: '' }) })
      .catch((materialsRequestError) => {
        if (active) setMaterialsState({ classId, materials: [], error: materialsRequestError.response?.data?.message || 'Could not load class materials.' })
      })
    return () => { active = false }
  }, [classId])

  const loading = request.classId !== classId
  const offering = loading ? null : request.offering
  const error = loading ? '' : request.error
  const materials = materialsState.classId === classId ? materialsState.materials : []
  const materialsError = materialsState.classId === classId ? materialsState.error : ''
  const materialsLoading = materialsState.classId !== classId

  async function downloadMaterial(materialId) {
    setDownloadingId(materialId)
    setMaterialsState((current) => ({ ...current, error: '' }))
    try {
      const { data } = await api.get(`/student/materials/${materialId}/download`)
      window.location.assign(data.url)
    } catch (downloadError) {
      setMaterialsState((current) => ({ ...current, error: downloadError.response?.data?.message || 'Could not prepare the file download.' }))
    } finally {
      setDownloadingId('')
    }
  }

  if (loading) return <main className="student-page"><p className="student-empty">Loading class…</p></main>
  if (error || !offering) return <main className="student-page"><Link className="student-back-link" to="/student"><ArrowLeft size={15} /> Back to dashboard</Link><p className="student-alert" role="alert">{error || 'Class not found.'}</p></main>

  return (
    <main className="student-page student-classroom-page">
      <Link className="student-back-link" to="/student"><ArrowLeft size={15} /> Back to my classes</Link>
      {location.state?.notice && <p className="student-success" role="status">{location.state.notice}</p>}
      <section className="student-classroom-hero"><div><span className="student-eyebrow">MY CLASS · SECTION {offering.section}</span><h1>{offering.subject?.name || 'Class'}</h1><p>{offering.subject?.subjectCode || '—'} <span>·</span> {offering.schoolYear} <span>·</span> {offering.term}</p></div><span className="student-welcome-art"><BookOpen size={29} /></span></section>

      <nav className="student-class-tabs" aria-label="Class sections" role="tablist">
        <button role="tab" aria-selected={activeTab === 'stream'} className={activeTab === 'stream' ? 'active' : ''} type="button" onClick={() => setActiveTab('stream')}><CalendarDays size={15} /> Class information</button>
        <button role="tab" aria-selected={activeTab === 'materials'} className={activeTab === 'materials' ? 'active' : ''} type="button" onClick={() => setActiveTab('materials')}><FolderOpen size={15} /> Class materials <span className="student-material-tab-count">{materialsLoading ? '…' : materials.length}</span></button>
        <button role="tab" aria-selected={activeTab === 'quizzes'} className={activeTab === 'quizzes' ? 'active' : ''} type="button" onClick={() => setActiveTab('quizzes')}><BookOpen size={15} /> Quizzes</button>
        <button role="tab" aria-selected={activeTab === 'practice'} className={activeTab === 'practice' ? 'active' : ''} type="button" onClick={() => setActiveTab('practice')}><FileText size={15} /> Practice</button>
      </nav>

      {activeTab === 'materials' ? <section className="student-materials-page" role="tabpanel">
        <div className="student-materials-page-heading"><div><span className="student-eyebrow">SHARED BY YOUR PROFESSOR</span><h2>Class materials</h2><p>Files and resources for {offering.subject?.name || 'this class'}.</p></div><span className="student-materials-total">{materialsLoading ? 'Loading…' : `${materials.length} ${materials.length === 1 ? 'file' : 'files'}`}</span></div>
        {materialsError && <p className="student-alert" role="alert">{materialsError}</p>}
        {materialsLoading ? <div className="student-empty"><FolderOpen size={23} /><strong>Loading class materials…</strong></div> : materials.length === 0 ? <div className="student-empty"><FolderOpen size={24} /><strong>No class materials yet</strong><span>Your professor’s published files will appear here.</span></div> : <div className="student-materials-list">{materials.map((material) => <article className="student-material-row" key={material._id}>
          <span className="student-material-icon"><FileText size={18} /></span><div className="student-material-copy"><Link to={`/student/classes/${classId}/materials/${material._id}`}>{material.title}</Link><span>{material.originalFileName} · {(material.fileSize / (1024 * 1024)).toFixed(1)} MB</span>{material.description && <small>{material.description}</small>}<div className="student-material-meta"><span className="student-material-category">{(material.category || 'lesson').replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>{material.category !== 'lesson' && <span className="student-material-points">{material.pointsPossible || 100} pts · 70% to pass</span>}{material.deadline && <span className="student-material-deadline">Due {new Date(material.deadline).toLocaleString()}</span>}</div><em>Shared {new Date(material.availableAt).toLocaleDateString()}</em></div>
          <Link className="student-download-button student-preview-button" to={`/student/classes/${classId}/materials/${material._id}`}>Open material</Link>
          <button className="student-download-button" type="button" disabled={downloadingId === material._id} onClick={() => downloadMaterial(material._id)}><Download size={14} />{downloadingId === material._id ? 'Preparing…' : 'Download'}</button>
        </article>)}</div>}
      </section> : activeTab === 'quizzes' ? <StudentQuizSection classId={classId} /> : activeTab === 'practice' ? <StudentQuizSection classId={classId} practice /> : <>

      <section className="student-classroom-overview">
        <article><small>Professor</small><strong>{offering.professor?.fullName || 'Professor'}</strong><span>{offering.professor?.department || offering.subject?.department || ''}</span></article>
        <article><small>Section</small><strong>{offering.section}</strong><span>{offering.subject?.units ?? '—'} subject units</span></article>
      </section>

      <section className="student-section">
        <div className="student-section-heading"><div><span className="student-eyebrow">WHEN TO MEET</span><h2>Class schedule</h2></div></div>
        <div className="student-detail-schedule">{offering.schedule?.map((meeting, index) => <article key={`${meeting.day}-${meeting.startTime}-${index}`}><strong><CalendarDays size={15} />{meeting.day}</strong><span><Clock3 size={14} />{formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}</span><span>{meeting.room ? <><MapPin size={14} />{meeting.room}</> : 'Room not set'}</span></article>)}</div>
      </section>

      {offering.subject?.description && <section className="student-description"><span className="student-eyebrow">ABOUT THIS SUBJECT</span><p>{offering.subject.description}</p></section>}
      <section className="student-stream-layout">
        <article className="student-stream-main">
          <div className="student-stream-banner"><span className="student-stream-banner-icon"><BookOpen size={20} /></span><div><span className="student-eyebrow">CLASS INFORMATION</span><h2>{offering.subject?.name || 'Class'}</h2><p>Section {offering.section} · {offering.term}</p></div></div>
          <div className="student-stream-empty"><span><MessageSquareText size={19} /></span><strong>Welcome to {offering.subject?.name || 'your class'}</strong><p>Class updates and announcements from your professor will appear here.</p><button type="button" className="student-open-materials" onClick={() => setActiveTab('materials')}>Browse class materials <FolderOpen size={14} /></button></div>
        </article>
        <aside className="student-stream-sidebar">
          <article className="student-stream-sidecard"><span className="student-eyebrow">PROFESSOR</span><strong>{offering.professor?.fullName || 'Professor'}</strong><p>{offering.professor?.department || offering.subject?.department || ''}</p></article>
          <article className="student-stream-sidecard"><span className="student-eyebrow">CLASS SCHEDULE</span>{offering.schedule?.length ? offering.schedule.map((meeting, index) => <div className="student-upcoming-meeting" key={`${meeting.day}-${meeting.startTime}-${index}`}><CalendarDays size={14} /><span><strong>{meeting.day}</strong><small>{formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}{meeting.room ? ` · ${meeting.room}` : ''}</small></span></div>) : <p>No meeting times listed.</p>}</article>
        </aside>
      </section>
      </>}
    </main>
  )
}
