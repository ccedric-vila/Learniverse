import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import './professor.css'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const EMPTY_SCHEDULE = [{ day: 'Monday', startTime: '09:00', endTime: '10:30', room: '' }]
const EMPTY_FORM = { department: '', courseProgram: '', subjectId: '', section: '', schoolYear: '', term: '', schedule: EMPTY_SCHEDULE }
const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1))
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

function formatTime12(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`
}

function TimeInput({ label, value, onChange }) {
  const [rawHours, rawMinutes] = value.split(':')
  const hours24 = Number(rawHours)
  const hour = String(hours24 % 12 || 12)
  const minute = rawMinutes || '00'
  const period = hours24 >= 12 ? 'PM' : 'AM'

  function updateTime(nextHour = hour, nextMinute = minute, nextPeriod = period) {
    const hour24 = (Number(nextHour) % 12) + (nextPeriod === 'PM' ? 12 : 0)
    onChange(`${String(hour24).padStart(2, '0')}:${nextMinute}`)
  }

  return (
    <label className="professor-create-time-field">
      <span>{label}</span>
      <span className="professor-create-time-input">
        <select aria-label={`${label} hour`} value={hour} onChange={(event) => updateTime(event.target.value)}>
          {HOURS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <span aria-hidden="true">:</span>
        <select aria-label={`${label} minute`} value={minute} onChange={(event) => updateTime(hour, event.target.value)}>
          {MINUTES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select aria-label={`${label} AM or PM`} value={period} onChange={(event) => updateTime(hour, minute, event.target.value)}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </span>
    </label>
  )
}

function getError(error, fallback) {
  return error.response?.data?.message || fallback
}

function findMeetingConflicts(schedule, occupiedSchedule) {
  return schedule.map((meeting, index) => {
    const newClassConflicts = schedule.flatMap((otherMeeting, otherIndex) => (
      otherIndex > index
        && meeting.day === otherMeeting.day
        && meeting.startTime < otherMeeting.endTime
        && otherMeeting.startTime < meeting.endTime
        ? [{ meetingIndex: otherIndex + 1, startTime: otherMeeting.startTime, endTime: otherMeeting.endTime }]
        : []
    ))
    const occupiedClassConflicts = occupiedSchedule.filter((occupied) => (
      meeting.day === occupied.day
      && meeting.startTime < occupied.endTime
      && occupied.startTime < meeting.endTime
    ))
    const earlierNewClassConflicts = schedule.slice(0, index).flatMap((otherMeeting, otherIndex) => (
      meeting.day === otherMeeting.day
        && meeting.startTime < otherMeeting.endTime
        && otherMeeting.startTime < meeting.endTime
        ? [{ meetingIndex: otherIndex + 1, startTime: otherMeeting.startTime, endTime: otherMeeting.endTime }]
        : []
    ))
    return [...newClassConflicts, ...earlierNewClassConflicts, ...occupiedClassConflicts]
  })
}

export default function ProfessorCreateClass() {
  const navigate = useNavigate()
  const [options, setOptions] = useState({ subjects: [], departments: [], courseProgramGroups: [], occupiedSchedule: [], existingClasses: [] })
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdOffering, setCreatedOffering] = useState(null)
  const [existingSubjectPreviewOpen, setExistingSubjectPreviewOpen] = useState(false)

  useEffect(() => {
    let active = true
    api.get('/professor/classes/options')
      .then(({ data }) => { if (active) setOptions(data) })
      .catch((requestError) => { if (active) setError(getError(requestError, 'Could not load class creation options.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const programs = options.courseProgramGroups
    .flatMap((group) => group.programs)
    .filter((program) => program.department === form.department)
  const subjects = options.subjects.filter((subject) => (
    subject.isActive !== false
    && subject.department === form.department
    && (!subject.courseProgram || subject.courseProgram === form.courseProgram
      || ['General Education (GE)', 'Mandatory Institutional Subjects (PE/NSTP)', 'Mathematics & Basic Sciences'].includes(subject.courseProgram))
  ))
  const selectedSubject = options.subjects.find((subject) => subject._id === form.subjectId)
  const enteredSection = form.section.trim().toLocaleLowerCase()
  const existingSubjectClasses = (options.existingClasses || []).filter((offering) => (
    offering.subjectId === form.subjectId
    && offering.section.trim().toLocaleLowerCase() === enteredSection
    && offering.schedule.length > 0
  ))
  const scheduleConflicts = findMeetingConflicts(form.schedule, options.occupiedSchedule || [])
  const hasScheduleConflicts = scheduleConflicts.some((conflicts) => conflicts.length > 0)

  function updateMeeting(index, field, value) {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.map((meeting, meetingIndex) => (
        meetingIndex === index ? { ...meeting, [field]: value } : meeting
      )),
    }))
  }

  async function submitClass(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setCreatedOffering(null)
    try {
      const { data } = await api.post('/professor/classes', form)
      setCreatedOffering(data.offering)
    } catch (requestError) {
      setError(getError(requestError, 'Could not create this class.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="professor-dashboard professor-create-class-page">
      <Link className="professor-create-back" to="/professor#classes"><ArrowLeft size={15} />Back to teaching dashboard</Link>
      <section className="professor-create-heading">
        <span className="professor-eyebrow">YOUR TEACHING SPACE</span>
        <h1>Create a class</h1>
        <p>Set up a class for your students. Your name will be assigned as the professor automatically.</p>
      </section>

      {error && <div className="professor-error" role="alert">{error}</div>}
      {!createdOffering && <form className="professor-create-form" onSubmit={submitClass}>
        <div className="professor-create-form-heading">
          <span className="professor-create-form-icon"><CalendarDays size={18} /></span>
          <div><h2>Class details</h2><p>Choose the subject and when your class meets.</p></div>
        </div>

        {loading ? <p className="professor-create-loading">Loading available subjects…</p> : (
          <>
            <div className="professor-create-fields">
              <label>
                <span>Department <b>*</b></span>
                <select required value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value, courseProgram: '', subjectId: '' }))}>
                  <option value="">Select department</option>
                  {options.departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </label>
              <label>
                <span>Course program <b>*</b></span>
                <select required disabled={!form.department} value={form.courseProgram} onChange={(event) => setForm((current) => ({ ...current, courseProgram: event.target.value, subjectId: '' }))}>
                  <option value="">Select course program</option>
                  {programs.map((program) => <option key={program.name} value={program.name}>{program.name}</option>)}
                </select>
              </label>
              <div className="professor-create-subject-field">
                <label>
                  <span>Subject <b>*</b></span>
                  <select required disabled={!form.courseProgram} value={form.subjectId} onChange={(event) => {
                    setForm((current) => ({ ...current, subjectId: event.target.value }))
                    setExistingSubjectPreviewOpen(false)
                  }}>
                    <option value="">Select a subject</option>
                    {subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}{subject.subjectCode ? ` · ${subject.subjectCode}` : ''}</option>)}
                  </select>
                </label>
                {form.courseProgram && subjects.length === 0 && <small className="professor-create-field-note">No active subjects are available for this department and program.</small>}
                {selectedSubject && existingSubjectClasses.length > 0 && (
                  <div className="professor-create-existing-subject">
                    <button
                      className="professor-create-existing-subject-toggle"
                      type="button"
                      aria-expanded={existingSubjectPreviewOpen}
                      aria-controls="professor-existing-subject-preview"
                      onClick={() => setExistingSubjectPreviewOpen((open) => !open)}
                    >
                      {existingSubjectPreviewOpen ? 'Hide existing classes' : `Preview existing classes (${existingSubjectClasses.length})`}
                    </button>
                    {existingSubjectPreviewOpen && (
                      <div className="professor-create-existing-subject-preview" id="professor-existing-subject-preview" role="status">
                        <strong>{selectedSubject.name} already has a scheduled class for section {form.section.trim()}.</strong>
                        <span>Check its meeting times before creating another class for this section.</span>
                        {existingSubjectClasses.map((offering, offeringIndex) => (
                          <span key={`${offering.section}-${offeringIndex}`}>
                            Section {offering.section}{offering.schedule.length > 0 && ` · ${offering.schedule.map((meeting) => `${meeting.day} ${formatTime12(meeting.startTime)}–${formatTime12(meeting.endTime)}`).join(', ')}`
                            }
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <label>
                <span>Section <b>*</b></span>
                <input required maxLength={30} value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} placeholder="e.g. BSIT-1A-T" />
              </label>
              <label>
                <span>School year <b>*</b></span>
                <select required value={form.schoolYear} onChange={(event) => setForm((current) => ({ ...current, schoolYear: event.target.value }))}>
                  <option value="">Select school year</option>
                  <option value="2026-2027">2026-2027</option>
                  <option value="2027-2028">2027-2028</option>
                </select>
              </label>
              <label>
                <span>Term <b>*</b></span>
                <select required value={form.term} onChange={(event) => setForm((current) => ({ ...current, term: event.target.value }))}>
                  <option value="">Select term</option>
                  <option value="1st">1st</option>
                  <option value="2nd">2nd</option>
                  <option value="3rd">3rd</option>
                </select>
              </label>
            </div>

            <fieldset className="professor-create-schedule">
              <legend>Class schedule <b>*</b></legend>
              <p>Existing class times are shown by day. Overlapping times are blocked.</p>
              {form.schedule.map((meeting, index) => (
                <div className="professor-create-meeting" key={`meeting-${index}`}>
                  <select aria-label={`Meeting ${index + 1} day`} value={meeting.day} onChange={(event) => updateMeeting(index, 'day', event.target.value)}>
                    {DAYS.map((day) => {
                      const count = (options.occupiedSchedule || []).filter((occupied) => occupied.day === day).length
                      return <option key={day} value={day}>{day}{count ? ` (${count} busy)` : ''}</option>
                    })}
                  </select>
                  <TimeInput label="Starts" value={meeting.startTime} onChange={(value) => updateMeeting(index, 'startTime', value)} />
                  <TimeInput label="Ends" value={meeting.endTime} onChange={(value) => updateMeeting(index, 'endTime', value)} />
                  <input aria-label={`Meeting ${index + 1} room`} maxLength={100} placeholder="Room (optional)" value={meeting.room} onChange={(event) => updateMeeting(index, 'room', event.target.value)} />
                  <button className="professor-create-remove" type="button" aria-label={`Remove meeting ${index + 1}`} disabled={form.schedule.length === 1} onClick={() => setForm((current) => ({ ...current, schedule: current.schedule.filter((_, meetingIndex) => meetingIndex !== index) }))}><Trash2 size={15} /></button>
                  {(options.occupiedSchedule || []).some((occupied) => occupied.day === meeting.day) && (
                    <div className="professor-create-busy-times">
                      <strong>{meeting.day} already has:</strong>
                      {(options.occupiedSchedule || []).filter((occupied) => occupied.day === meeting.day).map((occupied, occupiedIndex) => (
                        <span key={`${occupied.section}-${occupiedIndex}`}>{occupied.subject} · Section {occupied.section}, {formatTime12(occupied.startTime)}–{formatTime12(occupied.endTime)}{occupied.room ? ` · ${occupied.room}` : ''}</span>
                      ))}
                    </div>
                  )}
                  {scheduleConflicts[index].length > 0 && (
                    <div className="professor-create-conflicts" role="alert">
                      {scheduleConflicts[index].map((conflict, conflictIndex) => (
                        <span key={`${conflict.startTime}-${conflictIndex}`}>
                          Overlaps {formatTime12(conflict.startTime)}–{formatTime12(conflict.endTime)}{'subject' in conflict
                            ? ` with ${conflict.subject} · Section ${conflict.section}`
                            : ` with meeting ${conflict.meetingIndex}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button className="professor-create-add-meeting" type="button" onClick={() => setForm((current) => ({ ...current, schedule: [...current.schedule, { day: 'Monday', startTime: '09:00', endTime: '10:30', room: '' }] }))}><Plus size={14} />Add meeting</button>
            </fieldset>

            <p className="professor-create-code-note">A unique class join code will be generated automatically.</p>
            <div className="professor-create-actions">
              <button className="professor-create-cancel" type="button" onClick={() => navigate('/professor#classes')}>Cancel</button>
              <button className="professor-create-submit" type="submit" disabled={saving || !subjects.length || hasScheduleConflicts}><Save size={15} />{saving ? 'Creating class…' : 'Create class'}</button>
            </div>
          </>
        )}
      </form>}
      {createdOffering && (
        <div className="professor-create-success-backdrop">
          <section className="professor-create-success-dialog" role="dialog" aria-modal="true" aria-labelledby="professor-create-success-title">
            <span className="professor-create-success-icon"><CheckCircle2 size={30} /></span>
            <h2 id="professor-create-success-title">Class created successfully</h2>
            <p>{createdOffering.subject?.name} · Section {createdOffering.section} is ready for students.</p>
            <span className="professor-create-success-code-label">Class join code</span>
            <code>{createdOffering.classCode}</code>
            <p className="professor-create-success-hint">Share this code with your students so they can join.</p>
            <button type="button" onClick={() => navigate('/professor#classes')}>View my classes</button>
          </section>
        </div>
      )}
    </main>
  )
}
