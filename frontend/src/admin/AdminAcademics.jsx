import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, CalendarDays, Check, CircleCheck, Layers3, Plus, Save, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import './admin.css'

const DEPARTMENTS = [
  'Department of Engineering',
  'Department of Engineering Technology',
  'Department of Information Technology and Computer Studies',
  'Department of Industrial Education (Technical Teacher Education)',
  'Department of Mathematics and Sciences',
  'Department of Liberal Arts and Humanities',
  'Department of Physical Education and NSTP',
]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const OTHER_SUBJECT = '__other_subject__'
const OTHER_SECTION = '__other_section__'
const COURSE_PROGRAM_GROUPS = [
  { label: 'Engineering Programs', programs: [
    'Bachelor of Science in Civil Engineering (BSCE)',
    'Bachelor of Science in Electrical Engineering (BSEE)',
    'Bachelor of Science in Electronics Engineering (BSECE)',
    'Bachelor of Science in Mechanical Engineering (BSME)',
  ] },
  { label: 'Information Technology and Computer Studies', programs: [
    'Bachelor of Science in Information Technology (BSIT)',
  ] },
  { label: 'Mathematics and Sciences', programs: [
    'Bachelor of Science in Environmental Science (BSES)',
    'Mathematics & Basic Sciences',
  ] },
  { label: 'Engineering Technology (BET) Majors', programs: [
    'Bachelor of Engineering Technology (BET) - Automotive Technology',
    'Bachelor of Engineering Technology (BET) - Chemical Technology',
    'Bachelor of Engineering Technology (BET) - Civil Technology',
    'Bachelor of Engineering Technology (BET) - Dies and Moulds Technology',
    'Bachelor of Engineering Technology (BET) - Electrical Technology',
    'Bachelor of Engineering Technology (BET) - Electronics Technology',
    'Bachelor of Engineering Technology (BET) - Electromechanical Technology',
    'Bachelor of Engineering Technology (BET) - HVAC/R Technology',
    'Bachelor of Engineering Technology (BET) - Instrumentation & Control Technology',
    'Bachelor of Engineering Technology (BET) - Mechatronics Technology',
    'Bachelor of Engineering Technology (BET) - Mechanical Technology',
    'Bachelor of Engineering Technology (BET) - Non-Destructive Testing Technology',
  ] },
  { label: 'Industrial Education (Technical Teacher Education)', programs: [
    'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electrical Technology (ET)',
    'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electronics Technology (ELXT)',
    'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Programming (ICT)',
    'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Hardware Servicing (ICTCH)',
    // Keep previously saved program names available to edit existing offerings.
    'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electronics',
    'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electrical',
    'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Programming',
  ] },
  { label: 'Liberal Arts and Humanities', programs: ['General Education (GE)'] },
  { label: 'Physical Education and NSTP', programs: ['Mandatory Institutional Subjects (PE/NSTP)', 'Physical Education & NSTP'] },
]
const EMPTY_SUBJECT = { name: '', subjectCode: '', department: DEPARTMENTS[0], description: '', units: '3' }
const EMPTY_CUSTOM_SUBJECT = { name: '', subjectCode: '', department: DEPARTMENTS[0], description: '', units: '3' }
const EMPTY_OFFERING = {
  department: '', subjectId: '', professorId: '', section: '', courseProgram: '', schoolYear: '', term: '',
  schedule: [{ day: 'Monday', startTime: '09:00', endTime: '10:30', room: '' }],
}

function letteredSections(programCode, years, track = '', letters = ['A']) {
  return years.flatMap((year) => letters.map((letter) => `${programCode}${track ? `-${track}` : ''}-${year}${letter}-T`))
}

function sectionsForProgram(program = '') {
  if (program.includes('(BSIT)')) {
    return [
      'BSIT-S-1A-T', 'BSIT-S-1B-T', 'BSIT-S-2A-T', 'BSIT-S-3A-T', 'BSIT-S-4A-T',
      'BSIT-NS-1A-T', 'BSIT-NS-2A-T', 'BSIT-NS-3A-T', 'BSIT-NS-4A-T',
    ]
  }
  if (program.includes('(BSCE)')) return letteredSections('BSCE', [1, 2, 3, 4])
  if (program.includes('(BSEE)')) return letteredSections('BSEE', [1, 2, 3, 4])
  if (program.includes('(BSECE)')) return letteredSections('BSECE', [1, 2, 3, 4])
  if (program.includes('(BSME)')) return letteredSections('BSME', [1, 2, 3, 4])
  if (program.includes('(BSES)')) return letteredSections('BSES', [1, 2, 3, 4])
  if (program.includes('(BTVTED)')) {
    if (program.includes('Computer Programming')) return ['BTVTEd-ICT-1A-T', 'BTVTEd-ICT-2A-T']
    if (program.includes('Computer Hardware')) return ['BTVTEd-ICT-CH-1A-T', 'BTVTEd-ICT-CH-2A-T']
    if (program.includes('Electronics')) return ['BTVTEd-ELXT-1A-T']
    if (program.includes('Electrical')) return ['BTVTEd-ET-1A-T']
  }
  if (program.includes('Automotive Technology')) return letteredSections('BETAT', [1, 2], 'NS')
  if (program.includes('Chemical Technology')) return [...letteredSections('BETCHT', [1], 'S'), ...letteredSections('BETCHT', [1], 'NS')]
  if (program.includes('Civil Technology')) return letteredSections('BETCT', [1, 2])
  if (program.includes('Dies and Moulds Technology')) return letteredSections('BETDMT', [1, 2], 'NS')
  if (program.includes('Electrical Technology')) return letteredSections('BETET', [1, 2], 'NS')
  if (program.includes('Electronics Technology')) return letteredSections('BETELXT', [1, 2], 'NS')
  if (program.includes('Electromechanical Technology')) return letteredSections('BETEMT', [1, 2], 'NS')
  if (program.includes('HVAC/R Technology')) return letteredSections('BETHVAC', [1, 2], 'NS')
  if (program.includes('Instrumentation & Control Technology')) return letteredSections('BETICT', [1, 2])
  if (program.includes('Mechatronics Technology')) return letteredSections('BETMECT', [1, 2])
  if (program.includes('Mechanical Technology')) return letteredSections('BETMT', [1, 2], 'S')
  if (program.includes('Non-Destructive Testing Technology')) return letteredSections('BETNDT', [1, 2], 'S')
  return []
}

function getError(error, fallback) {
  return error.response?.data?.message || fallback
}

function scheduleLabel(schedule = []) {
  return schedule.map(({ day, startTime, endTime, room }) => `${day} ${startTime}–${endTime}${room ? ` · ${room}` : ''}`).join(' / ')
}

function departmentForProgram(program) {
  if (/^(General Education)/.test(program)) return 'Department of Liberal Arts and Humanities'
  if (/^(Mandatory Institutional Subjects|Physical Education & NSTP)/.test(program)) return 'Department of Physical Education and NSTP'
  if (/^(Mathematics & Basic Sciences)|\(BSES\)/.test(program)) return 'Department of Mathematics and Sciences'
  if (program.includes('(BSIT)')) return 'Department of Information Technology and Computer Studies'
  if (program.includes('(BTVTED)')) return 'Department of Industrial Education (Technical Teacher Education)'
  if (program.includes('(BET)')) return 'Department of Engineering Technology'
  if (/\((BSCE|BSEE|BSECE|BSME)\)/.test(program)) return 'Department of Engineering'
  return ''
}

async function requestAcademicData() {
  const [subjectResponse, professorResponse, offeringResponse] = await Promise.all([
    api.get('/admin/subjects'), api.get('/admin/professors'), api.get('/admin/classes'),
  ])
  return {
    subjects: subjectResponse.data.subjects,
    professors: professorResponse.data.professors,
    offerings: offeringResponse.data.offerings,
  }
}

export default function AdminAcademics({ mode = 'subjects' }) {
  const [subjects, setSubjects] = useState([])
  const [professors, setProfessors] = useState([])
  const [offerings, setOfferings] = useState([])
  const [subjectForm, setSubjectForm] = useState(EMPTY_SUBJECT)
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectProgramFilter, setSubjectProgramFilter] = useState('')
  const [subjectDepartmentFilter, setSubjectDepartmentFilter] = useState('')
  const [subjectStatusFilter, setSubjectStatusFilter] = useState('ALL')
  const [offeringForm, setOfferingForm] = useState(EMPTY_OFFERING)
  const [customSubject, setCustomSubject] = useState(EMPTY_CUSTOM_SUBJECT)
  const [customSection, setCustomSection] = useState('')
  const [editingSubject, setEditingSubject] = useState(null)
  const [editingOffering, setEditingOffering] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seedingProgram, setSeedingProgram] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const subjectPrograms = [...new Set(subjects
    .filter((subject) => !subjectDepartmentFilter || subject.department === subjectDepartmentFilter)
    .map((subject) => subject.courseProgram)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const filteredSubjects = subjects.filter((subject) => {
    const search = subjectSearch.trim().toLowerCase()
    const matchesSearch = !search || [subject.name, subject.subjectCode, subject.description]
      .some((value) => value?.toLowerCase().includes(search))
    const matchesProgram = !subjectProgramFilter || subject.courseProgram === subjectProgramFilter
    const matchesDepartment = !subjectDepartmentFilter || subject.department === subjectDepartmentFilter
    const matchesStatus = subjectStatusFilter === 'ALL'
      || (subjectStatusFilter === 'ACTIVE' ? subject.isActive : !subject.isActive)
    return matchesSearch && matchesProgram && matchesDepartment && matchesStatus
  })
  const activeSubjectCount = subjects.filter((subject) => subject.isActive).length
  const inactiveSubjectCount = subjects.length - activeSubjectCount
  const departmentCount = new Set(subjects.map((subject) => subject.department).filter(Boolean)).size
  const availableCourseProgramGroups = COURSE_PROGRAM_GROUPS
    .map((group) => ({
      ...group,
      programs: group.programs.filter((program) => departmentForProgram(program) === offeringForm.department),
    }))
    .filter((group) => group.programs.length > 0)

  async function loadData() {
    try {
      const data = await requestAcademicData()
      setSubjects(data.subjects)
      setProfessors(data.professors)
      setOfferings(data.offerings)
    } catch (requestError) {
      setError(getError(requestError, 'Could not load academic records.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    requestAcademicData()
      .then((data) => {
        if (!active) return
        setSubjects(data.subjects)
        setProfessors(data.professors)
        setOfferings(data.offerings)
      })
      .catch((requestError) => { if (active) setError(getError(requestError, 'Could not load academic records.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function resetSubject() {
    setEditingSubject(null)
    setSubjectForm(EMPTY_SUBJECT)
  }

  function resetOffering() {
    setEditingOffering(null)
    setOfferingForm(EMPTY_OFFERING)
    setCustomSubject(EMPTY_CUSTOM_SUBJECT)
    setCustomSection('')
  }

  async function submitSubject(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = { ...subjectForm, units: Number(subjectForm.units) }
      if (editingSubject) await api.patch(`/admin/subjects/${editingSubject}`, payload)
      else await api.post('/admin/subjects', payload)
      setNotice(editingSubject
        ? 'Subject changes saved. Class offerings now use the updated subject details.'
        : 'Subject added to the catalog. It will be available in Class Offerings for any course program.')
      resetSubject()
      await loadData()
    } catch (requestError) {
      setError(getError(requestError, 'Could not save this subject.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitOffering(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      let payload = { ...offeringForm }
      if (payload.section === OTHER_SECTION) payload.section = customSection.trim()
      if (payload.subjectId === OTHER_SUBJECT) {
        const { data } = await api.post('/admin/subjects/other', {
          ...customSubject,
          courseProgram: payload.courseProgram,
        })
        payload.subjectId = data.subject._id
      }
      if (editingOffering) await api.patch(`/admin/classes/${editingOffering}`, payload)
      else await api.post('/admin/classes', payload)
      setNotice(editingOffering ? 'Class offering changes saved.' : 'Class offering created with a new class code.')
      resetOffering()
      await loadData()
    } catch (requestError) {
      setError(getError(requestError, 'Could not save this class offering.'))
    } finally {
      setSaving(false)
    }
  }

  async function setSubjectStatus(subject) {
    setError('')
    setNotice('')
    try {
      await api.patch(`/admin/subjects/${subject._id}`, { isActive: !subject.isActive })
      setNotice(`Subject ${subject.isActive ? 'deactivated' : 'activated'}.`)
      await loadData()
    } catch (requestError) {
      setError(getError(requestError, 'Could not update subject status.'))
    }
  }

  function filterSubjectsByDepartment(department) {
    setSubjectDepartmentFilter(department)
    setSubjectProgramFilter('')
  }

  async function setOfferingStatus(offering) {
    setError('')
    setNotice('')
    try {
      await api.patch(`/admin/classes/${offering._id}`, { isActive: !offering.isActive })
      setNotice(`Class offering ${offering.isActive ? 'deactivated' : 'activated'}.`)
      await loadData()
    } catch (requestError) {
      setError(getError(requestError, 'Could not update class status.'))
    }
  }

  function editSubject(subject) {
    setEditingSubject(subject._id)
    setSubjectForm({
      name: subject.name, subjectCode: subject.subjectCode, department: subject.department,
      description: subject.description || '', units: String(subject.units ?? 3),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editOffering(offering) {
    setEditingOffering(offering._id)
    const courseProgram = offering.courseProgram || ''
    setOfferingForm({
      subjectId: offering.subject?._id || '', professorId: offering.professor?._id || '',
      department: courseProgram ? departmentForProgram(courseProgram) : '',
      section: offering.section, courseProgram, schoolYear: offering.schoolYear, term: offering.term,
      schedule: offering.schedule.map(({ day, startTime, endTime, room }) => ({ day, startTime, endTime, room: room || '' })),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateMeeting(index, field, value) {
    setOfferingForm((form) => ({
      ...form,
      schedule: form.schedule.map((meeting, meetingIndex) => meetingIndex === index ? { ...meeting, [field]: value } : meeting),
    }))
  }

  async function selectCourseProgram(courseProgram) {
    setOfferingForm((form) => ({ ...form, courseProgram, section: '', subjectId: '' }))
    setCustomSubject({ ...EMPTY_CUSTOM_SUBJECT, department: courseProgram ? departmentForProgram(courseProgram) : DEPARTMENTS[0] })
    setCustomSection('')
    setError('')
    setNotice('')
    if (!courseProgram || subjects.some((subject) => subject.isActive && subject.courseProgram === courseProgram)) return

    setSeedingProgram(courseProgram)
    try {
      const { data } = await api.post('/admin/subjects/seed-curriculum', { courseProgram })
      const { data: subjectData } = await api.get('/admin/subjects')
      setSubjects(subjectData.subjects)
      setNotice(data.message)
    } catch (requestError) {
      setError(getError(requestError, 'Could not load subjects for this program.'))
    } finally {
      setSeedingProgram('')
    }
  }

  function selectOfferingDepartment(department) {
    setOfferingForm((form) => ({ ...form, department, courseProgram: '', section: '', subjectId: '' }))
    setCustomSubject(EMPTY_CUSTOM_SUBJECT)
    setCustomSection('')
    setError('')
    setNotice('')
  }

  return (
    <main className="admin-page admin-academics-page">
      <Link className="admin-back-link" to="/admin"><ArrowLeft size={15} /> Back to dashboard</Link>
      <section className={`professor-form-heading${mode === 'subjects' ? ' subject-catalog-hero' : ''}`}>
        <span className="admin-eyebrow">ACADEMIC SETUP</span>
        <h1>{mode === 'subjects' ? 'Manage subjects' : 'Class offerings'}</h1>
        <p>{mode === 'subjects' ? 'Organize your curriculum in one place. Keep subject details accurate and ready for class scheduling.' : 'Assign subjects to professors, set class schedules, and manage join codes.'}</p>
      </section>
      <nav className="academics-nav" aria-label="Academic management">
        <Link className={mode === 'subjects' ? 'active' : ''} to="/admin/subjects"><BookOpen size={15} /> Subjects</Link>
        <Link className={mode === 'classes' ? 'active' : ''} to="/admin/classes"><CalendarDays size={15} /> Class offerings</Link>
      </nav>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status"><Check size={16} />{notice}</p>}

      {mode === 'subjects' && <section className="subject-summary-grid" aria-label="Subject catalog summary">
        <article className="subject-summary-card"><span className="subject-summary-icon"><BookOpen size={17} /></span><div><small>Total subjects</small><strong>{loading ? '—' : subjects.length}</strong><span>Catalog records</span></div></article>
        <article className="subject-summary-card active"><span className="subject-summary-icon"><CircleCheck size={17} /></span><div><small>Active subjects</small><strong>{loading ? '—' : activeSubjectCount}</strong><span>Available for scheduling</span></div></article>
        <article className="subject-summary-card departments"><span className="subject-summary-icon"><Layers3 size={17} /></span><div><small>Departments</small><strong>{loading ? '—' : departmentCount}</strong><span>{inactiveSubjectCount} inactive subjects</span></div></article>
      </section>}

      <div className={mode === 'subjects' ? 'subject-management-layout' : 'class-management-layout'}>
      <div className="academics-form-grid single">
        {mode === 'subjects' && (
        <form id="subject-editor" className="professor-form subject-editor" onSubmit={submitSubject}>
          <div className="form-section-title"><span className="form-section-icon"><BookOpen size={18} /></span><div><h2>{editingSubject ? 'Edit subject details' : 'Add a subject to the catalog'}</h2><p>Enter the subject information used across class offerings.</p></div></div>
          <div className="form-grid">
            <label className="admin-field full-width"><span>Subject name <b>*</b></span><input required maxLength="150" value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} placeholder="Science, Technology, and Society" /></label>
            <label className="admin-field"><span>Subject code <b>*</b></span><input required maxLength="20" value={subjectForm.subjectCode} onChange={(event) => setSubjectForm({ ...subjectForm, subjectCode: event.target.value.toUpperCase() })} placeholder="STS101" /></label>
            <label className="admin-field"><span>Units</span><input type="number" min="0" max="20" step="0.5" value={subjectForm.units} onChange={(event) => setSubjectForm({ ...subjectForm, units: event.target.value })} /></label>
            <label className="admin-field full-width"><span>Department <b>*</b></span><select value={subjectForm.department} onChange={(event) => setSubjectForm({ ...subjectForm, department: event.target.value })}>{DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></label>
            <label className="admin-field full-width"><span>Description</span><textarea maxLength="2000" rows="3" value={subjectForm.description} onChange={(event) => setSubjectForm({ ...subjectForm, description: event.target.value })} placeholder="Optional subject overview" /></label>
          </div>
          <div className="professor-form-actions"><button className="admin-cancel-button" type="button" onClick={resetSubject}>Clear</button><button className="admin-primary-button" disabled={saving} type="submit"><Save size={15} />{saving ? 'Saving…' : editingSubject ? 'Save subject' : 'Add subject'}</button></div>
        </form>
        )}
        {mode === 'classes' && (
        <form className="professor-form" onSubmit={submitOffering}>
          <div className="form-section-title"><span className="form-section-icon"><CalendarDays size={18} /></span><div><h2>{editingOffering ? 'Edit class offering' : 'Create a class offering'}</h2><p>Choose a subject, professor, course program, section, and schedule.</p></div></div>
          <div className="form-grid">
            <label className="admin-field"><span>Department <b>*</b></span><select required value={offeringForm.department} onChange={(event) => selectOfferingDepartment(event.target.value)}><option value="">Select department</option>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
            <label className="admin-field"><span>Course program <b>*</b></span><select required disabled={!offeringForm.department} value={offeringForm.courseProgram} onChange={(event) => selectCourseProgram(event.target.value)}><option value="">{offeringForm.department ? 'Select course program' : 'Choose a department first'}</option>{availableCourseProgramGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.programs.map((program) => <option key={program} value={program}>{program}</option>)}</optgroup>)}</select></label>
            <div className="admin-field"><label htmlFor="offering-section">Section <b>*</b></label><select id="offering-section" required disabled={!offeringForm.courseProgram} value={offeringForm.section} onChange={(event) => setOfferingForm({ ...offeringForm, section: event.target.value })}><option value="">{offeringForm.courseProgram ? 'Select a section' : 'Choose a course program first'}</option>{sectionsForProgram(offeringForm.courseProgram).map((section) => <option key={section} value={section}>{section}</option>)}{offeringForm.section && offeringForm.section !== OTHER_SECTION && !sectionsForProgram(offeringForm.courseProgram).includes(offeringForm.section) && <option value={offeringForm.section}>Current section: {offeringForm.section}</option>}<option value={OTHER_SECTION}>Other — type a section</option></select>{offeringForm.section === OTHER_SECTION && <input className="other-subject-input" aria-label="Custom section code" required maxLength={30} value={customSection} onChange={(event) => setCustomSection(event.target.value)} placeholder="Type section code (e.g. BSIT-NS-4A-T)" />}</div>
            {offeringForm.courseProgram && offeringForm.section.trim() ? <div className="admin-field"><label htmlFor="offering-subject">Subject <b>*</b></label><select id="offering-subject" required disabled={seedingProgram === offeringForm.courseProgram} value={offeringForm.subjectId} onChange={(event) => setOfferingForm({ ...offeringForm, subjectId: event.target.value })}><option value="">{seedingProgram === offeringForm.courseProgram ? 'Loading program subjects…' : 'Select a subject for this program'}</option>{subjects.filter((subject) => subject.isActive && (!subject.courseProgram || subject.courseProgram === offeringForm.courseProgram || ['General Education (GE)', 'Mandatory Institutional Subjects (PE/NSTP)', 'Mathematics & Basic Sciences'].includes(subject.courseProgram))).map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}<option value={OTHER_SUBJECT}>Other — add a new subject</option></select>{offeringForm.subjectId === OTHER_SUBJECT && <div className="custom-subject-fields">
              <label className="admin-field"><span>Subject name <b>*</b></span><input required maxLength={150} value={customSubject.name} onChange={(event) => setCustomSubject({ ...customSubject, name: event.target.value })} placeholder="Enter subject name" /></label>
              <label className="admin-field"><span>Subject code <b>*</b></span><input required maxLength={20} value={customSubject.subjectCode} onChange={(event) => setCustomSubject({ ...customSubject, subjectCode: event.target.value.toUpperCase() })} placeholder="e.g. IT101" /></label>
              <label className="admin-field"><span>Units <b>*</b></span><input required type="number" min="0" max="20" step="0.5" value={customSubject.units} onChange={(event) => setCustomSubject({ ...customSubject, units: event.target.value })} /></label>
              <label className="admin-field"><span>Department <b>*</b></span><select required value={customSubject.department} onChange={(event) => setCustomSubject({ ...customSubject, department: event.target.value })}>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
              <label className="admin-field custom-subject-description"><span>Description <small>Optional</small></span><textarea maxLength={2000} rows={2} value={customSubject.description} onChange={(event) => setCustomSubject({ ...customSubject, description: event.target.value })} placeholder="Brief subject overview" /></label>
            </div>}{seedingProgram === offeringForm.courseProgram && <small>Preparing the curriculum subject list…</small>}</div> : <div className="admin-field subject-program-prompt"><span>Subjects</span><p>Select a course program and enter a section first to see the matching subjects.</p></div>}
            <label className="admin-field"><span>Professor <b>*</b></span><select required value={offeringForm.professorId} onChange={(event) => setOfferingForm({ ...offeringForm, professorId: event.target.value })}><option value="">Select professor</option>{professors.map((professor) => <option key={professor._id} value={professor._id}>{professor.fullName}</option>)}</select></label>
            <label className="admin-field"><span>School year <b>*</b></span><input required maxLength="30" value={offeringForm.schoolYear} onChange={(event) => setOfferingForm({ ...offeringForm, schoolYear: event.target.value })} placeholder="2026–2027" /></label>
            <label className="admin-field full-width"><span>Term <b>*</b></span><input required maxLength="50" value={offeringForm.term} onChange={(event) => setOfferingForm({ ...offeringForm, term: event.target.value })} placeholder="First Semester" /></label>
            <div className="schedule-editor admin-field full-width"><span>Schedule <b>*</b></span>{offeringForm.schedule.map((meeting, index) => <div className="schedule-row" key={index}>
              <select aria-label="Day" value={meeting.day} onChange={(event) => updateMeeting(index, 'day', event.target.value)}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select>
              <input aria-label="Start time" type="time" required value={meeting.startTime} onChange={(event) => updateMeeting(index, 'startTime', event.target.value)} />
              <input aria-label="End time" type="time" required value={meeting.endTime} onChange={(event) => updateMeeting(index, 'endTime', event.target.value)} />
              <input aria-label="Room" maxLength="100" placeholder="Room (optional)" value={meeting.room} onChange={(event) => updateMeeting(index, 'room', event.target.value)} />
              <button className="icon-action danger" type="button" aria-label="Remove meeting" disabled={offeringForm.schedule.length === 1} onClick={() => setOfferingForm({ ...offeringForm, schedule: offeringForm.schedule.filter((_, meetingIndex) => meetingIndex !== index) })}><Trash2 size={15} /></button>
            </div>)}<button className="add-meeting-button" type="button" onClick={() => setOfferingForm({ ...offeringForm, schedule: [...offeringForm.schedule, { day: 'Monday', startTime: '09:00', endTime: '10:30', room: '' }] })}><Plus size={14} /> Add meeting</button></div>
          </div>
          {!editingOffering && <p className="form-help-note">A unique 8-character class code is generated automatically when you create the offering.</p>}
          <div className="professor-form-actions"><button className="admin-cancel-button" type="button" onClick={resetOffering}>Clear</button><button className="admin-primary-button" disabled={saving || seedingProgram !== '' || professors.length === 0} type="submit"><Save size={15} />{saving ? 'Saving…' : editingOffering ? 'Save offering' : 'Create offering'}</button></div>
        </form>
        )}
      </div>

      {mode === 'subjects' && (
      <section className="admin-panel subject-catalog-panel">
        <div className="admin-panel-heading"><div><span className="admin-eyebrow">SUBJECT CATALOG</span><h2>Catalog records</h2><p>Search, filter, edit, or update subject availability.</p></div><span className="record-count">{loading ? 'Loading…' : `${filteredSubjects.length} of ${subjects.length} subjects`}</span></div>
        <div className="subject-filters" role="search" aria-label="Filter subjects">
          <label className="subject-search-field"><Search size={16} /><span className="sr-only">Search subjects</span><input type="search" value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} placeholder="Search by subject, code, or description" /></label>
          <label className="subject-filter-select subject-department-filter"><span>Department</span><select value={subjectDepartmentFilter} onChange={(event) => filterSubjectsByDepartment(event.target.value)}><option value="">All departments</option>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
          <label className="subject-filter-select subject-program-filter"><span>Course program</span><select disabled={!subjectDepartmentFilter} value={subjectProgramFilter} onChange={(event) => setSubjectProgramFilter(event.target.value)}><option value="">{subjectDepartmentFilter ? 'All programs in department' : 'Choose department first'}</option>{subjectPrograms.map((program) => <option key={program} value={program}>{program}</option>)}</select></label>
          <label className="subject-filter-select"><span className="sr-only">Filter by status</span><select value={subjectStatusFilter} onChange={(event) => setSubjectStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
          {(subjectSearch || subjectProgramFilter || subjectDepartmentFilter || subjectStatusFilter !== 'ALL') && <button className="subject-filter-clear" type="button" onClick={() => { setSubjectSearch(''); setSubjectProgramFilter(''); setSubjectDepartmentFilter(''); setSubjectStatusFilter('ALL') }}>Clear filters</button>}
        </div>
        {loading ? <p className="admin-empty">Loading subjects…</p> : subjects.length === 0 ? <div className="admin-empty subject-empty"><BookOpen size={26} /><strong>Your subject catalog is empty</strong><span>Add the first subject using the form above.</span></div> : filteredSubjects.length === 0 ? <p className="admin-empty">No subjects match these filters. Try changing your search or filters.</p> : <div className="professor-table-wrap"><table className="professor-table subject-table"><thead><tr><th>Subject</th><th>Department</th><th>Units</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredSubjects.map((subject) => <tr key={subject._id}><td><div className="academic-record"><strong>{subject.name}</strong><small>{subject.subjectCode}</small></div></td><td>{subject.department}</td><td><span className="subject-unit-pill">{subject.units} {Number(subject.units) === 1 ? 'unit' : 'units'}</span></td><td><span className={`account-status ${subject.isActive ? 'active' : 'inactive'}`}>{subject.isActive ? 'Active' : 'Inactive'}</span></td><td><div className="table-actions"><button type="button" onClick={() => editSubject(subject)}>Edit</button><button type="button" onClick={() => setSubjectStatus(subject)}>{subject.isActive ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>}
      </section>
      )}
      {mode === 'classes' && (
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-eyebrow">ASSIGNMENTS &amp; SCHEDULES</span><h2>Class offerings</h2></div><span className="record-count">{offerings.length} total</span></div>
        {loading ? <p className="admin-empty">Loading class offerings…</p> : offerings.length === 0 ? <p className="admin-empty">No classes scheduled yet. Create a class offering above.</p> : <div className="professor-table-wrap"><table className="professor-table offering-table"><thead><tr><th>Class</th><th>Professor</th><th>Term</th><th>Schedule</th><th>Join code</th><th>Status</th><th>Actions</th></tr></thead><tbody>{offerings.map((offering) => <tr key={offering._id}><td><div className="academic-record"><strong>{offering.subject?.name || 'Subject unavailable'}</strong><small>{offering.courseProgram || 'Program not set'} · Section {offering.section}</small></div></td><td>{offering.professor?.fullName || 'Professor unavailable'}</td><td>{offering.schoolYear}<br />{offering.term}</td><td className="schedule-cell">{scheduleLabel(offering.schedule)}</td><td><span className="class-code">{offering.classCode}</span></td><td><span className={`account-status ${offering.isActive ? 'active' : 'inactive'}`}>{offering.isActive ? 'Active' : 'Inactive'}</span></td><td><div className="table-actions"><button type="button" onClick={() => editOffering(offering)}>Edit</button><button type="button" onClick={() => setOfferingStatus(offering)}>{offering.isActive ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>}
      </section>
      )}
      </div>
    </main>
  )
}
