import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, BookOpen, CalendarDays, Check, Clipboard, Clock3, Download, Eye, FileText, Files, Mail, MapPin, Pencil, Plus, RefreshCw, Save, School, Search, Trash2, Upload, UsersRound, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { strToU8, zipSync } from 'fflate'
import { Link, useParams } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import ProfessorQuizManager from './ProfessorQuizManager'
import './professor.css'

const EMPTY_MATERIALS = []
const CLASS_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function compareStudentsByLastName(first, second) {
  const firstName = first.fullName.trim().split(/\s+/)
  const secondName = second.fullName.trim().split(/\s+/)
  return nameCollator.compare(firstName.at(-1), secondName.at(-1))
    || nameCollator.compare(first.fullName, second.fullName)
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function safeFileName(value) {
  return value.trim().replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'class'
}

function formatEnrolledDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function downloadDocxRoster(offering, students) {
  const rows = [
    ['No.', 'Student name', 'Email', 'Date enrolled'],
    ...students.map((student, index) => [
      String(index + 1),
      student.fullName,
      student.email,
      formatEnrolledDate(student.enrolledAt),
    ]),
  ]
  const tableRows = rows.map((row, rowIndex) => {
    const cells = row.map((text) => `<w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r>${rowIndex === 0 ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`).join('')
    return `<w:tr>${cells}</w:tr>`
  }).join('')
  const classTitle = `${offering.subject?.name || 'Class'} — Section ${offering.section || ''}`
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(classTitle)} Student Roster</w:t></w:r></w:p>
<w:p><w:r><w:t>${escapeXml(students.length)} enrolled students · Sorted alphabetically by surname · Exported ${escapeXml(new Date().toLocaleString())}</w:t></w:r></w:p>
<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B7C9C2"/><w:left w:val="single" w:sz="4" w:color="B7C9C2"/><w:bottom w:val="single" w:sz="4" w:color="B7C9C2"/><w:right w:val="single" w:sz="4" w:color="B7C9C2"/><w:insideH w:val="single" w:sz="4" w:color="DCE6E1"/><w:insideV w:val="single" w:sz="4" w:color="DCE6E1"/></w:tblBorders></w:tblPr>${tableRows}</w:tbl>
<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
</w:body></w:document>`
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(documentXml),
  }
  const docx = zipSync(files, { level: 6 })
  const url = URL.createObjectURL(new Blob([docx], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName(classTitle)}-student-roster.docx`
  link.click()
  URL.revokeObjectURL(url)
}

function downloadPdfRoster(offering, students) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 14
  const columns = [
    { title: 'No.', width: 15 },
    { title: 'Student name', width: 80 },
    { title: 'Email', width: 100 },
    { title: 'Date enrolled', width: pageWidth - margin * 2 - 195 },
  ]
  const drawHeader = (top) => {
    pdf.setFillColor(232, 243, 238)
    pdf.rect(margin, top, pageWidth - margin * 2, 9, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    let x = margin + 2
    columns.forEach((column) => {
      pdf.text(column.title, x, top + 6)
      x += column.width
    })
  }
  const classTitle = `${offering.subject?.name || 'Class'} - Section ${offering.section || ''}`
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text(`${classTitle} Student Roster`, margin, 19)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`${students.length} enrolled students | Sorted alphabetically by surname | Exported ${new Date().toLocaleString()}`, margin, 27)
  let y = 34
  drawHeader(y)
  y += 12
  pdf.setFontSize(8)
  students.forEach((student, index) => {
    const values = [String(index + 1), student.fullName, student.email, formatEnrolledDate(student.enrolledAt)]
    const wrapped = values.map((value, columnIndex) => pdf.splitTextToSize(value || '—', columns[columnIndex].width - 4))
    const rowHeight = Math.max(8, ...wrapped.map((lines) => lines.length * 4)) + 2
    if (y + rowHeight > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage()
      y = margin
      drawHeader(y)
      y += 12
    }
    let x = margin + 2
    wrapped.forEach((lines, columnIndex) => {
      pdf.text(lines, x, y + 3)
      x += columns[columnIndex].width
    })
    pdf.setDrawColor(225, 233, 229)
    pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
    y += rowHeight
  })
  if (!students.length) pdf.text('No students are enrolled in this class yet.', margin, y + 3)
  pdf.save(`${safeFileName(classTitle)}-student-roster.pdf`)
}

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }).format(date)
}

export default function ProfessorClassroom() {
  const { classId } = useParams()
  const [requestState, setRequestState] = useState({ classId: null, offering: null, error: '' })
  const [materialsState, setMaterialsState] = useState({ classId: null, materials: [], error: '' })
  const [studentsState, setStudentsState] = useState({ classId: null, students: [], error: '', loading: false })
  const [allMaterialsState, setAllMaterialsState] = useState({ materials: [], error: '', loading: false })
  const [copied, setCopied] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('lesson')
  const [deadline, setDeadline] = useState('')
  const [pointsPossible, setPointsPossible] = useState('100')
  const [availableAt, setAvailableAt] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isMaterialFormOpen, setIsMaterialFormOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [materialMessage, setMaterialMessage] = useState('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialFilter, setMaterialFilter] = useState('all')
  const [activeClassTab, setActiveClassTab] = useState('overview')
  const [quizDraftDirty, setQuizDraftDirty] = useState(false)
  const [pendingClassTab, setPendingClassTab] = useState(null)
  const [classDetailsForm, setClassDetailsForm] = useState({ section: '', schoolYear: '', term: '', schedule: [] })
  const [classDetailsSaving, setClassDetailsSaving] = useState(false)
  const [classDetailsError, setClassDetailsError] = useState('')
  const [classDetailsMessage, setClassDetailsMessage] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [rosterExportError, setRosterExportError] = useState('')
  const quizDraftDiscardRef = useRef(null)
  const materialDialogRef = useRef(null)

  useEffect(() => {
    let active = true
    api.get(`/professor/classes/${classId}`)
      .then(({ data }) => { if (active) setRequestState({ classId, offering: data.offering, error: '' }) })
      .catch((requestError) => {
        if (active) setRequestState({ classId, offering: null, error: requestError.response?.data?.message || 'Could not load this class.' })
      })
    return () => { active = false }
  }, [classId])

  useEffect(() => {
    const dialog = materialDialogRef.current
    if (!dialog) return
    if (isMaterialFormOpen && !dialog.open) dialog.showModal()
    if (!isMaterialFormOpen && dialog.open) dialog.close()
  }, [isMaterialFormOpen])

  async function loadMaterials() {
    try {
      const { data } = await api.get(`/professor/classes/${classId}/materials`)
      setMaterialsState({ classId, materials: data.materials, error: '' })
    } catch (materialsError) {
      setMaterialsState({ classId, materials: [], error: materialsError.response?.data?.message || 'Could not load class materials.' })
    }
  }

  async function loadAllProfessorMaterials() {
    setAllMaterialsState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const { data } = await api.get('/professor/materials')
      setAllMaterialsState({ materials: data.materials || [], error: '', loading: false })
    } catch (requestError) {
      setAllMaterialsState((current) => ({
        ...current,
        error: requestError.response?.data?.message || 'Could not load your uploaded files.',
        loading: false,
      }))
    }
  }

  async function loadClassStudents() {
    setStudentsState((current) => ({ ...current, classId, loading: true, error: '' }))
    try {
      const { data } = await api.get(`/professor/classes/${classId}/students`)
      setStudentsState({ classId, students: data.students || [], error: '', loading: false })
    } catch (requestError) {
      setStudentsState({
        classId,
        students: [],
        error: requestError.response?.data?.message || 'Could not load students in this class.',
        loading: false,
      })
    }
  }

  function exportStudentRoster(format) {
    setRosterExportError('')
    try {
      if (format === 'pdf') downloadPdfRoster(offering, alphabetizedStudents)
      else downloadDocxRoster(offering, alphabetizedStudents)
    } catch (exportError) {
      console.error(`Could not export the student roster as ${format.toUpperCase()}:`, exportError)
      setRosterExportError(`Could not export the ${format.toUpperCase()} roster. Please try again.`)
    }
  }

  useEffect(() => {
    let active = true
    api.get(`/professor/classes/${classId}/materials`)
      .then(({ data }) => { if (active) setMaterialsState({ classId, materials: data.materials, error: '' }) })
      .catch((materialsError) => {
        if (active) setMaterialsState({ classId, materials: [], error: materialsError.response?.data?.message || 'Could not load class materials.' })
      })
    return () => { active = false }
  }, [classId])

  const loading = requestState.classId !== classId
  const offering = loading ? null : requestState.offering
  const error = loading ? '' : requestState.error
  const materials = materialsState.classId === classId ? materialsState.materials : EMPTY_MATERIALS
  const allMaterials = allMaterialsState.materials
  const students = studentsState.classId === classId ? studentsState.students : EMPTY_MATERIALS
  const alphabetizedStudents = [...students].sort(compareStudentsByLastName)
  const studentQuery = studentSearch.trim().toLowerCase()
  const visibleStudents = alphabetizedStudents.filter((student) => !studentQuery
    || [student.fullName, student.email].some((value) => String(value || '').toLowerCase().includes(studentQuery)))
  const visibleMaterials = useMemo(() => {
    const query = materialSearch.trim().toLowerCase()
    return materials.filter((material) => {
      const categoryValue = String(material.category || 'lesson').toLowerCase()
      const matchesFilter = materialFilter === 'all'
        || (materialFilter === 'lessons' && categoryValue === 'lesson')
        || (materialFilter === 'seatwork' && categoryValue === 'seatwork')
        || (materialFilter === 'quizzes' && categoryValue === 'quiz')
      const matchesSearch = !query || [material.title, material.originalFileName, material.description, material.category]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    })
  }, [materials, materialFilter, materialSearch])
  const visibleAllMaterials = useMemo(() => {
    const query = materialSearch.trim().toLowerCase()
    return allMaterials.filter((material) => {
      const categoryValue = String(material.category || 'lesson').toLowerCase()
      const matchesFilter = materialFilter === 'all'
        || (materialFilter === 'lessons' && categoryValue === 'lesson')
        || (materialFilter === 'seatwork' && categoryValue === 'seatwork')
        || (materialFilter === 'quizzes' && categoryValue === 'quiz')
      const matchesSearch = !query || [
        material.title,
        material.originalFileName,
        material.description,
        material.category,
        material.classOffering?.subject?.name,
        material.classOffering?.section,
      ].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    })
  }, [allMaterials, materialFilter, materialSearch])

  function editClassDetails() {
    setClassDetailsForm({
      section: offering.section || '',
      schoolYear: offering.schoolYear || '',
      term: offering.term || '',
      schedule: (offering.schedule || []).map((meeting) => ({ ...meeting })),
    })
    setClassDetailsError('')
    setClassDetailsMessage('')
    setActiveClassTab('details')
  }

  function applyClassTabChange(tab) {
    if (tab === 'details') {
      editClassDetails()
      return
    }
    setActiveClassTab(tab)
    if (tab === 'students') loadClassStudents()
    if (tab === 'files') loadAllProfessorMaterials()
  }

  function requestClassTabChange(tab) {
    if (tab === activeClassTab) return
    if (activeClassTab === 'quizzes' && quizDraftDirty) {
      setPendingClassTab(tab)
      return
    }
    applyClassTabChange(tab)
  }

  function confirmLeaveQuizTab() {
    const nextTab = pendingClassTab
    setPendingClassTab(null)
    quizDraftDiscardRef.current?.()
    setQuizDraftDirty(false)
    if (nextTab) applyClassTabChange(nextTab)
  }

  function updateClassMeeting(index, field, value) {
    setClassDetailsForm((current) => ({
      ...current,
      schedule: current.schedule.map((meeting, meetingIndex) => (
        meetingIndex === index ? { ...meeting, [field]: value } : meeting
      )),
    }))
  }

  async function saveClassDetails(event) {
    event.preventDefault()
    setClassDetailsSaving(true)
    setClassDetailsError('')
    setClassDetailsMessage('')
    try {
      const { data } = await api.patch(`/professor/classes/${classId}`, classDetailsForm)
      setRequestState({ classId, offering: data.offering, error: '' })
      setClassDetailsMessage(data.notificationWarning || 'Class details saved successfully.')
    } catch (requestError) {
      setClassDetailsError(requestError.response?.data?.message || 'Could not save class details.')
    } finally {
      setClassDetailsSaving(false)
    }
  }

  async function copyClassCode() {
    try {
      await navigator.clipboard.writeText(offering.classCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setRequestState((current) => ({
        ...current,
        error: 'Could not copy the class code. Please select and copy it manually.',
      }))
    }
  }

  async function uploadClassMaterial(event) {
    event.preventDefault()
    if (!file) return setMaterialMessage('Choose a file to upload.')
    const form = event.currentTarget
    const formData = new FormData()
    formData.append('title', title)
    formData.append('description', description)
    formData.append('category', category)
    if (category !== 'lesson' && deadline) formData.append('deadline', new Date(deadline).toISOString())
    if (category !== 'lesson') formData.append('pointsPossible', pointsPossible)
    if (availableAt) formData.append('availableAt', new Date(availableAt).toISOString())
    formData.append('file', file)
    setUploading(true)
    setUploadProgress(0)
    setMaterialMessage('')
    try {
      const { data } = await api.post(`/professor/classes/${classId}/materials`, formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        },
      })
      setTitle('')
      setDescription('')
      setCategory('lesson')
      setDeadline('')
      setPointsPossible('100')
      setAvailableAt('')
      setFile(null)
      form.reset()
      setMaterialMessage(data.notificationWarning || (data.material.availableAt > new Date().toISOString() ? 'File uploaded and scheduled.' : 'File uploaded and shared with students.'))
      setIsMaterialFormOpen(false)
      await loadMaterials()
    } catch (uploadError) {
      setMaterialMessage(uploadError.response?.data?.message || 'Could not upload this file.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  async function downloadMaterial(materialId) {
    try {
      const { data } = await api.get(`/professor/materials/${materialId}/download`)
      window.location.assign(data.url)
    } catch (downloadError) {
      setMaterialMessage(downloadError.response?.data?.message || 'Could not prepare this download.')
    }
  }

  async function deleteMaterial(materialId) {
    if (!window.confirm('Delete this class material? Students will no longer be able to access it.')) return
    setMaterialMessage('')
    try {
      await api.delete(`/professor/materials/${materialId}`)
      setMaterialMessage('Class material deleted.')
      setAllMaterialsState((current) => ({
        ...current,
        materials: current.materials.filter((material) => material._id !== materialId),
      }))
      await loadMaterials()
    } catch (deleteError) {
      setMaterialMessage(deleteError.response?.data?.message || 'Could not delete this material.')
    }
  }

  if (loading) return <main className="professor-dashboard"><p className="professor-empty">Loading class…</p></main>
  if (error && !offering) return <main className="professor-dashboard"><Link className="professor-back-link" to="/professor#classes"><ArrowLeft size={15} /> Back to my classes</Link><div className="professor-error" role="alert">{error}</div></main>
  if (!offering) return null

  return (
    <main className="professor-dashboard professor-classroom">
      <Link className="professor-back-link" to="/professor#classes"><ArrowLeft size={15} /> Back to my classes</Link>
      <section className="professor-classroom-hero">
        <div>
          <span className="professor-eyebrow">CLASSROOM · SECTION {offering.section}</span>
          <h1>{offering.subject?.name || 'Class details'}</h1>
          <p>{offering.subject?.subjectCode || '—'} <span>·</span> {offering.schoolYear} <span>·</span> {offering.term}</p>
        </div>
        <span className="professor-classroom-icon"><School size={30} /></span>
      </section>

      {error && <div className="professor-error" role="alert">{error}</div>}

      <nav className="professor-class-tabs" aria-label="Class sections" role="tablist">
        <button id="professor-class-overview-tab" role="tab" aria-selected={activeClassTab === 'overview'} aria-controls="professor-class-overview-panel" className={activeClassTab === 'overview' ? 'active' : ''} type="button" onClick={() => requestClassTabChange('overview')}><School size={15} />Class overview</button>
        <button id="professor-class-details-tab" role="tab" aria-selected={activeClassTab === 'details'} aria-controls="professor-class-details-panel" className={activeClassTab === 'details' ? 'active' : ''} type="button" onClick={() => requestClassTabChange('details')}><Pencil size={14} />Class details</button>
        <button id="professor-class-students-tab" role="tab" aria-selected={activeClassTab === 'students'} aria-controls="professor-class-students-panel" className={activeClassTab === 'students' ? 'active' : ''} type="button" onClick={() => requestClassTabChange('students')}><UsersRound size={15} />Students{studentsState.classId === classId && !studentsState.loading ? ` ${students.length}` : ''}</button>
        <button id="professor-class-quizzes-tab" role="tab" aria-selected={activeClassTab === 'quizzes'} aria-controls="professor-class-quizzes-panel" className={activeClassTab === 'quizzes' ? 'active' : ''} type="button" onClick={() => requestClassTabChange('quizzes')}><Clipboard size={15} />Quiz creation</button>
        <button id="professor-class-files-tab" role="tab" aria-selected={activeClassTab === 'files'} aria-controls="professor-class-files-panel" className={activeClassTab === 'files' ? 'active' : ''} type="button" onClick={() => requestClassTabChange('files')}><Files size={15} />All uploaded files</button>
      </nav>
      {pendingClassTab && (
        <div
          className="quiz-draft-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingClassTab(null)
          }}
        >
          <section
            className="quiz-draft-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-quiz-draft-confirmation-title"
            aria-describedby="class-quiz-draft-confirmation-description"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setPendingClassTab(null)
            }}
          >
            <span className="quiz-draft-confirmation-icon"><AlertTriangle size={21} /></span>
            <h3 id="class-quiz-draft-confirmation-title">Leave quiz creation?</h3>
            <p id="class-quiz-draft-confirmation-description">Your quiz draft has not been published. If you leave this section, the information and questions you entered will be lost and cannot be recovered.</p>
            <div className="quiz-draft-confirmation-actions">
              <button type="button" className="quiz-draft-stay-button" autoFocus onClick={() => setPendingClassTab(null)}>Stay and keep editing</button>
              <button type="button" className="quiz-draft-leave-button" onClick={confirmLeaveQuizTab}>Leave and discard draft</button>
            </div>
          </section>
        </div>
      )}

      {activeClassTab === 'details' ? (
        <section id="professor-class-details-panel" className="professor-class-details-panel" role="tabpanel" aria-labelledby="professor-class-details-tab">
          <div className="professor-files-title">
            <span className="professor-files-title-icon"><Pencil size={19} /></span>
            <div><span className="professor-eyebrow">CLASS SETTINGS</span><h2>Edit class details</h2><p>Update your class section, term, and weekly meeting schedule.</p></div>
          </div>
          {classDetailsMessage && <p className="professor-class-details-message" role="status">{classDetailsMessage}</p>}
          {classDetailsError && <div className="professor-error" role="alert">{classDetailsError}</div>}
          <form className="professor-class-details-form" onSubmit={saveClassDetails}>
            <div className="professor-class-details-fields">
              <label><span>Section</span><input required maxLength={30} value={classDetailsForm.section} onChange={(event) => setClassDetailsForm((current) => ({ ...current, section: event.target.value }))} /></label>
              <label><span>School year</span><input required maxLength={30} value={classDetailsForm.schoolYear} onChange={(event) => setClassDetailsForm((current) => ({ ...current, schoolYear: event.target.value }))} /></label>
              <label><span>Term</span><input required maxLength={50} value={classDetailsForm.term} onChange={(event) => setClassDetailsForm((current) => ({ ...current, term: event.target.value }))} /></label>
              <div className="professor-class-details-readonly"><span>Subject</span><strong>{offering.subject?.name || 'Unavailable'}</strong><small>Subject assignment is managed by your administrator.</small></div>
            </div>
            <div className="professor-class-details-schedule-heading"><div><span className="professor-eyebrow">WEEKLY MEETINGS</span><h3>Class schedule</h3></div><button className="classroom-copy-button" type="button" onClick={() => setClassDetailsForm((current) => ({ ...current, schedule: [...current.schedule, { day: 'Monday', startTime: '09:00', endTime: '10:30', room: '' }] }))}><Plus size={14} />Add meeting</button></div>
            <div className="professor-class-details-schedule">
              {classDetailsForm.schedule.map((meeting, index) => (
                <div className="professor-class-details-meeting" key={`class-meeting-${index}`}>
                  <label><span>Day</span><select value={meeting.day} onChange={(event) => updateClassMeeting(index, 'day', event.target.value)}>{CLASS_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
                  <label><span>Starts</span><input type="time" required value={meeting.startTime} onChange={(event) => updateClassMeeting(index, 'startTime', event.target.value)} /></label>
                  <label><span>Ends</span><input type="time" required value={meeting.endTime} onChange={(event) => updateClassMeeting(index, 'endTime', event.target.value)} /></label>
                  <label><span>Room</span><input maxLength={100} value={meeting.room || ''} onChange={(event) => updateClassMeeting(index, 'room', event.target.value)} placeholder="Room (optional)" /></label>
                  <button className="professor-class-details-remove" type="button" disabled={classDetailsForm.schedule.length === 1} aria-label={`Remove meeting ${index + 1}`} onClick={() => setClassDetailsForm((current) => ({ ...current, schedule: current.schedule.filter((_, meetingIndex) => meetingIndex !== index) }))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className="professor-class-details-actions"><button className="classroom-copy-button" type="button" onClick={() => setActiveClassTab('overview')}>Cancel</button><button className="professor-class-details-save" type="submit" disabled={classDetailsSaving}>{classDetailsSaving ? <RefreshCw size={14} className="professor-files-spinner" /> : <Save size={14} />}{classDetailsSaving ? 'Saving…' : 'Save class details'}</button></div>
          </form>
        </section>
      ) : activeClassTab === 'students' ? (
        <section id="professor-class-students-panel" className="professor-students-tab-panel" role="tabpanel" aria-labelledby="professor-class-students-tab">
          <div className="professor-students-toolbar">
            <div className="professor-files-title">
              <span className="professor-files-title-icon"><UsersRound size={20} /></span>
              <div><span className="professor-eyebrow">CLASS ROSTER</span><h2>Enrolled students</h2><p>Students currently enrolled in {offering.subject?.name || 'this class'}.</p></div>
            </div>
            <div className="professor-students-actions">
              <button className="professor-roster-export" type="button" disabled={studentsState.loading} onClick={() => exportStudentRoster('pdf')}><Download size={14} />Export PDF</button>
              <button className="professor-roster-export" type="button" disabled={studentsState.loading} onClick={() => exportStudentRoster('docx')}><FileText size={14} />Export DOCX</button>
              <button className="professor-files-refresh" type="button" disabled={studentsState.loading} onClick={loadClassStudents}><RefreshCw size={15} className={studentsState.loading ? 'professor-files-spinner' : ''} />Refresh roster</button>
            </div>
          </div>
          <p className="professor-roster-export-note">Exports include all enrolled students, sorted alphabetically by surname.</p>
          {rosterExportError && <p className="professor-error" role="alert">{rosterExportError}</p>}
          <div className="professor-students-controls">
            <label className="class-material-search"><Search size={15} /><input type="search" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search students by name or email" aria-label="Search students" />{studentSearch && <button type="button" aria-label="Clear student search" onClick={() => setStudentSearch('')}><X size={14} /></button>}</label>
            <span className="professor-files-count">{studentsState.loading ? 'Loading…' : `${visibleStudents.length} of ${students.length} students`}</span>
          </div>
          {studentsState.error && <div className="professor-error" role="alert">{studentsState.error}</div>}
          {studentsState.loading ? <div className="professor-empty"><RefreshCw size={20} className="professor-files-spinner" /><span>Loading enrolled students…</span></div> : students.length === 0 ? (
            <div className="professor-empty professor-students-empty"><UsersRound size={26} /><strong>No students enrolled yet</strong><span>Share the class join code to invite students to this class.</span></div>
          ) : visibleStudents.length === 0 ? (
            <div className="professor-empty professor-students-empty"><Search size={24} /><strong>No matching students</strong><span>Try a different name or email.</span></div>
          ) : (
            <div className="professor-students-list">
              {visibleStudents.map((student) => (
                <article className="professor-student-card" key={student.id}>
                  <span className="professor-student-avatar">{student.profileImage ? <img src={student.profileImage} alt="" /> : student.fullName?.trim().charAt(0).toUpperCase()}</span>
                  <span className="professor-student-copy"><strong>{student.fullName}</strong><span>{student.email}</span></span>
                  <span className="professor-student-enrolled">Joined {new Date(student.enrolledAt).toLocaleDateString()}</span>
                  <a className="professor-student-email" href={`mailto:${student.email}`} aria-label={`Email ${student.fullName}`} title={`Email ${student.fullName}`}><Mail size={15} /></a>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : activeClassTab === 'quizzes' ? (
        <section id="professor-class-quizzes-panel" className="professor-quiz-tab-panel" role="tabpanel" aria-labelledby="professor-class-quizzes-tab">
          <ProfessorQuizManager
            classId={classId}
            className={`${offering.subject?.name || 'Class'} - Section ${offering.section}`}
            onDraftStateChange={setQuizDraftDirty}
            onDraftDiscardRef={quizDraftDiscardRef}
          />
        </section>
      ) : activeClassTab === 'files' ? (
        <section id="professor-class-files-panel" className="professor-files-tab-panel" role="tabpanel" aria-labelledby="professor-class-files-tab">
          <div className="professor-files-toolbar">
            <div className="professor-files-title"><span className="professor-files-title-icon"><Files size={20} /></span><div><span className="professor-eyebrow">YOUR LIBRARY</span><h2>All uploaded files</h2><p>Materials you’ve shared across your active classes.</p></div></div>
            <button className="professor-files-refresh" type="button" disabled={allMaterialsState.loading} onClick={loadAllProfessorMaterials}><RefreshCw size={15} className={allMaterialsState.loading ? 'professor-files-spinner' : ''} />Refresh files</button>
          </div>
          <div className="professor-files-controls">
            <label className="class-material-search"><Search size={15} /><input type="search" value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search title, file, class, or section" aria-label="Search all uploaded files" />{materialSearch && <button type="button" aria-label="Clear search" onClick={() => setMaterialSearch('')}><X size={14} /></button>}</label>
            <div className="class-material-filter" role="group" aria-label="Filter all uploaded files">
              {[
                { value: 'all', label: `All ${allMaterials.length}` },
                { value: 'lessons', label: `Lessons ${allMaterials.filter((item) => String(item.category || 'lesson').toLowerCase() === 'lesson').length}` },
                { value: 'seatwork', label: `Seatwork ${allMaterials.filter((item) => String(item.category || 'lesson').toLowerCase() === 'seatwork').length}` },
                { value: 'quizzes', label: `Quizzes ${allMaterials.filter((item) => String(item.category || '').toLowerCase() === 'quiz').length}` },
              ].map((filter) => <button key={filter.value} type="button" className={materialFilter === filter.value ? 'active' : ''} aria-pressed={materialFilter === filter.value} onClick={() => setMaterialFilter(filter.value)}>{filter.label}</button>)}
            </div>
            <span className="professor-files-count">{allMaterialsState.loading ? 'Loading…' : `${visibleAllMaterials.length} of ${allMaterials.length} files`}</span>
          </div>
          {materialMessage && <p className="material-message" role="status">{materialMessage}</p>}
          {allMaterialsState.error ? <div className="professor-error" role="alert">{allMaterialsState.error}</div> : allMaterialsState.loading ? <div className="professor-empty"><RefreshCw size={20} className="professor-files-spinner" /><span>Loading your uploaded files…</span></div> : allMaterials.length === 0 ? (
            <div className="professor-empty professor-files-empty"><Files size={27} /><strong>No uploaded files yet</strong><span>Files you share in your active classes will be collected here.</span><button type="button" className="classroom-copy-button" onClick={() => { setActiveClassTab('overview'); setIsMaterialFormOpen(true) }}><Upload size={14} /> Add class material</button></div>
          ) : visibleAllMaterials.length === 0 ? <div className="professor-empty professor-files-empty"><Search size={24} /><strong>No matching files</strong><span>Try changing your search or file category filter.</span></div> : (
            <div className="professor-all-files-list">
              {visibleAllMaterials.map((material) => {
                const isLesson = String(material.category || 'lesson').toLowerCase() === 'lesson'
                const isQuiz = String(material.category || '').toLowerCase() === 'quiz'
                const scheduled = material.isScheduled
                return <article className="professor-all-file-card" key={material._id}>
                  <Link className="class-material-open" to={`/professor/materials/${material._id}`} aria-label={`${isLesson ? 'Preview' : 'Review'} ${material.title}`}>
                    <span className="class-material-file-icon"><FileText size={19} /></span>
                    <span className="class-material-copy">
                      <strong>{material.title}</strong>
                      <span>{material.originalFileName} · {(material.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                      <span className="professor-file-class"><BookOpen size={12} />{material.classOffering?.subject?.name || 'Class'} · Section {material.classOffering?.section || '—'}</span>
                      <span className="class-material-tags">
                        <span className="class-material-category">{isLesson ? 'Lesson' : isQuiz ? 'Quiz' : 'Seatwork'}</span>
                        {!isLesson && material.deadline && <span className="class-material-deadline">Due {new Date(material.deadline).toLocaleString()}</span>}
                        <span className={`material-status ${scheduled ? 'scheduled' : 'published'}`}>{scheduled ? `Scheduled ${new Date(material.availableAt).toLocaleString()}` : 'Visible to students'}</span>
                      </span>
                    </span>
                  </Link>
                  <div className="professor-all-file-actions">
                    <button className="material-icon-button" type="button" aria-label={`Download ${material.title}`} title="Download file" onClick={() => downloadMaterial(material._id)}><Download size={15} /></button>
                    <button className="material-icon-button delete" type="button" aria-label={`Delete ${material.title}`} title="Delete material" onClick={() => deleteMaterial(material._id)}><Trash2 size={15} /></button>
                  </div>
                </article>
              })}
            </div>
          )}
        </section>
      ) : <div id="professor-class-overview-panel" className="professor-classroom-columns" role="tabpanel" aria-labelledby="professor-class-overview-tab">
        <section className="classroom-overview-grid" aria-label="Class information">
          <article className="classroom-info-card"><span className="classroom-info-icon"><BookOpen size={18} /></span><div><small>Subject</small><strong>{offering.subject?.name || 'Unavailable'}</strong><span>{offering.subject?.units ?? '—'} units</span></div></article>
          <article className="classroom-info-card"><span className="classroom-info-icon mint"><CalendarDays size={18} /></span><div><small>Section</small><strong>{offering.section}</strong><span>{offering.schoolYear} · {offering.term}</span></div></article>
        </section>
        <div className="professor-classroom-main-column">
          <section className="professor-section classroom-section">
            <div className="professor-section-heading"><div><span className="professor-eyebrow">WEEKLY MEETINGS</span><h2>Class schedule</h2></div><button className="classroom-copy-button" type="button" onClick={editClassDetails}><Pencil size={14} />Edit details</button></div>
            {offering.schedule?.length ? <div className="classroom-schedule-list">{offering.schedule.map((meeting, index) => <article className="classroom-schedule-row" key={`${meeting.day}-${meeting.startTime}-${index}`}>
              <span className="classroom-day"><CalendarDays size={15} />{meeting.day}</span>
              <span className="classroom-meeting-time"><Clock3 size={15} />{formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}</span>
              <span className="classroom-room">{meeting.room ? <><MapPin size={14} />{meeting.room}</> : 'Room not set'}</span>
            </article>)}</div> : <p className="professor-empty">No schedule has been added.</p>}
          </section>

          <section className="classroom-code-panel">
            <div><span className="professor-eyebrow">STUDENT ACCESS</span><h2>Class join code</h2><p>Share this code with students so they can find this class.</p></div>
            <div className="classroom-code-actions"><strong className="classroom-code">{offering.classCode}</strong><button className="classroom-copy-button" type="button" onClick={copyClassCode}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? 'Copied' : 'Copy code'}</button></div>
          </section>
        </div>

        <aside className="professor-materials-panel" id="materials">
          <div className="professor-materials-heading"><div><span className="professor-eyebrow">CLASS FILES</span><h2>Class materials</h2><p>Lessons, seatwork, and take-home quizzes for your students.</p></div><span className="professor-materials-count">{materialsState.classId === classId ? materialsState.materials.length : '—'}</span></div>
          <button className="add-material-button" type="button" aria-expanded={isMaterialFormOpen} aria-controls="class-material-upload-dialog" onClick={() => { setIsMaterialFormOpen(true); setMaterialMessage('') }}><Upload size={15} />Add class material</button>
          {!isMaterialFormOpen && materialMessage && <p className="material-message" role="status">{materialMessage}</p>}
          <dialog
            ref={materialDialogRef}
            id="class-material-upload-dialog"
            className="material-upload-dialog"
            aria-labelledby="material-dialog-title"
            onCancel={(event) => { event.preventDefault(); if (!uploading) setIsMaterialFormOpen(false) }}
            onClose={() => setIsMaterialFormOpen(false)}
            onClick={(event) => { if (event.target === event.currentTarget && !uploading) setIsMaterialFormOpen(false) }}
          >
            <div className="material-dialog-header">
              <span className="material-dialog-icon"><Upload size={19} /></span>
              <div><span className="professor-eyebrow">SHARE WITH YOUR CLASS</span><h2 id="material-dialog-title">Add class material</h2><p>Share a lesson, seatwork, or take-home quiz.</p></div>
              <button className="material-dialog-close" type="button" aria-label="Close upload form" disabled={uploading} onClick={() => setIsMaterialFormOpen(false)}><X size={18} /></button>
            </div>
            <form className="material-upload-form" onSubmit={uploadClassMaterial}>
              <div className="material-form-grid">
                <label className="material-field"><span>Title <b>*</b></span><input required maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Week 1 lecture slides" /></label>
                <label className="material-field"><span>Category <b>*</b></span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="lesson">Lesson</option><option value="seatwork">Seatwork</option><option value="quiz">Quiz</option></select></label>
                <label className="material-field material-field-wide"><span>File <b>*</b><small>PDF, DOC/DOCX, or PPT/PPTX · up to 20 MB</small></span><input required type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(event) => setFile(event.target.files?.[0] || null)} />{file && <small className="material-selected-file" role="status"><FileText size={13} />{file.name}</small>}</label>
                {category !== 'lesson' && <>
                  <label className="material-field"><span>Total points <b>*</b></span><input required type="number" min="1" max="100000" step="1" value={pointsPossible} onChange={(event) => setPointsPossible(event.target.value)} placeholder="100" /></label>
                  <label className="material-field"><span>Deadline <b>*</b></span><input required type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
                  <p className="material-form-note material-field-wide">{category === 'quiz' ? 'Students download the quiz, complete it, and upload their answers. You’ll grade submissions manually. A score of 70% or higher is passing.' : 'Students need at least 70% of the total points to pass.'}</p>
                </>}
                <label className="material-field material-field-wide"><span>Description</span><textarea rows="3" maxLength="2000" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add instructions or notes for your students" /></label>
                <label className="material-field material-field-wide"><span>Publish later <small>Optional — leave empty to publish immediately</small></span><input type="datetime-local" value={availableAt} onChange={(event) => setAvailableAt(event.target.value)} /></label>
              </div>
              {uploading && <div className="material-progress" role="status"><span style={{ width: `${uploadProgress}%` }} /><small>{uploadProgress}% uploaded</small></div>}
              {materialMessage && <p className="material-message" role="status">{materialMessage}</p>}
              <div className="material-dialog-footer"><span>Files are visible to students after publication.</span><div><button className="material-dialog-cancel" type="button" disabled={uploading} onClick={() => setIsMaterialFormOpen(false)}>Cancel</button><button className="material-dialog-submit" type="submit" disabled={uploading || !file}><Upload size={15} />{uploading ? 'Uploading…' : availableAt ? 'Upload & schedule' : 'Upload material'}</button></div></div>
            </form>
          </dialog>

        <div className="class-material-list">
          <div className="class-material-list-heading"><div><strong>Uploaded files</strong><small>Preview lessons or review seatwork and quiz submissions.</small></div><span>{materialsState.classId !== classId ? 'Loading…' : `${visibleMaterials.length} of ${materials.length}`}</span></div>
          {materialsState.error && <p className="material-message" role="alert">{materialsState.error}</p>}
          {materials.length > 0 && (
            <div className="class-material-controls">
              <label className="class-material-search">
                <Search size={14} />
                <input type="search" value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search files or categories" aria-label="Search uploaded materials" />
                {materialSearch && <button type="button" aria-label="Clear search" onClick={() => setMaterialSearch('')}><X size={13} /></button>}
              </label>
              <div className="class-material-filter" role="group" aria-label="Filter uploaded materials">
                {[
                  { value: 'all', label: `All ${materials.length}` },
                  { value: 'lessons', label: `Lessons ${materials.filter((item) => String(item.category || 'lesson').toLowerCase() === 'lesson').length}` },
                  { value: 'seatwork', label: `Seatwork ${materials.filter((item) => String(item.category || 'lesson').toLowerCase() === 'seatwork').length}` },
                  { value: 'quizzes', label: `Quizzes ${materials.filter((item) => String(item.category || '').toLowerCase() === 'quiz').length}` },
                ].map((filter) => (
                  <button key={filter.value} type="button" className={materialFilter === filter.value ? 'active' : ''} aria-pressed={materialFilter === filter.value} onClick={() => setMaterialFilter(filter.value)}>{filter.label}</button>
                ))}
              </div>
            </div>
          )}
          {materialsState.classId !== classId ? <p className="class-material-empty">Loading class materials…</p> : materials.length === 0 ? <p className="class-material-empty">No files uploaded for this class yet. Add a lesson, seatwork, or quiz to share it with students.</p> : visibleMaterials.length === 0 ? <p className="class-material-empty">No materials match your search or filter. Try another keyword or select All.</p> : visibleMaterials.map((material) => {
            const scheduled = material.isScheduled
            const isLesson = String(material.category || 'lesson').toLowerCase() === 'lesson'
            const isQuiz = String(material.category || '').toLowerCase() === 'quiz'
            return <article className="class-material-row" key={material._id}>
              <Link className="class-material-open" to={`/professor/materials/${material._id}`} aria-label={`${isLesson ? 'Preview learning material' : `Review ${isQuiz ? 'quiz' : 'seatwork'} submissions`}: ${material.title}`}>
                <span className="class-material-file-icon"><FileText size={18} /></span>
                <span className="class-material-copy">
                  <strong>{material.title}</strong>
                  <span>{material.originalFileName} · {(material.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                  {material.description && <small>{material.description}</small>}
                  <span className="class-material-tags">
                    <span className="class-material-category">{isLesson ? 'Lesson' : isQuiz ? 'Quiz' : 'Seatwork'}</span>
                    {!isLesson && <span className="class-material-points">{material.pointsPossible || 100} points · Pass at 70%</span>}
                    {!isLesson && material.deadline && <span className="class-material-deadline">Due {new Date(material.deadline).toLocaleString()}</span>}
                    <span className={`material-status ${scheduled ? 'scheduled' : 'published'}`}>{scheduled ? `Scheduled ${new Date(material.availableAt).toLocaleString()}` : 'Visible to students'}</span>
                  </span>
                  <span className="class-material-open-hint"><Eye size={12} />{isLesson ? 'Preview learning material' : `Review ${isQuiz ? 'quiz' : 'seatwork'} submissions`}</span>
                </span>
              </Link>
              <div className="class-material-actions">
                <button className="material-icon-button" type="button" aria-label={`Download ${material.title}`} title="Download file" onClick={() => downloadMaterial(material._id)}><Download size={15} /></button>
                <button className="material-icon-button delete" type="button" aria-label={`Delete ${material.title}`} title="Delete material" onClick={() => deleteMaterial(material._id)}><Trash2 size={15} /></button>
              </div>
            </article>
          })}

        </div>
        </aside>
      </div>}
    </main>
  )
}
