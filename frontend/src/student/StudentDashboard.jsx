import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, Clock3, GraduationCap, MapPin, RefreshCw, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, useAuth } from '../auth/AuthContext'
import './student.css'

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function getGreeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export default function StudentDashboard({ onOpenJoinClass }) {
  const { user } = useAuth()
  const [todayLabel] = useState(() => new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date()))
  const [dashboard, setDashboard] = useState({ stats: {}, today: '', todayMeetings: [], offerings: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classSearch, setClassSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')

  const requestDashboard = useCallback(async () => {
    const { data } = await api.get('/student/dashboard')
    return data
  }, [])

  useEffect(() => {
    let active = true
    requestDashboard()
      .then((data) => { if (active) { setDashboard(data); setError('') } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load your student dashboard.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestDashboard])

  function refreshDashboard() {
    setLoading(true)
    setError('')
    requestDashboard()
      .then((data) => setDashboard(data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load your student dashboard.'))
      .finally(() => setLoading(false))
  }

  const firstName = (dashboard.student?.fullName || user?.fullName || 'Student').split(' ')[0]
  const offerings = dashboard.offerings || []
  const query = classSearch.trim().toLowerCase()
  const filteredOfferings = offerings.filter((offering) => {
    const hasSchedule = Boolean(offering.schedule?.length)
    const matchesFilter = classFilter === 'all' || (classFilter === 'scheduled' ? hasSchedule : !hasSchedule)
    const matchesSearch = !query || [
      offering.subject?.name,
      offering.subject?.subjectCode,
      offering.section,
      offering.professor?.fullName,
      offering.schoolYear,
      offering.term,
    ].some((value) => String(value || '').toLowerCase().includes(query))
    return matchesFilter && matchesSearch
  })

  return (
    <main className="student-page student-dashboard-home">
      <section className="student-welcome">
        <div className="student-welcome-copy"><span className="student-eyebrow">YOUR LEARNING SPACE</span><h1>{getGreeting()}, {firstName}</h1><p>Your classes and weekly schedule, all in one place.</p><span className="student-date-chip"><CalendarDays size={14} />{todayLabel}</span></div>
        <div className="student-welcome-actions">
          <button className="student-join-primary student-join-trigger" type="button" onClick={onOpenJoinClass}><BookOpen size={15} />Join a class</button>
          <button className="student-dashboard-refresh" type="button" onClick={refreshDashboard} disabled={loading}><RefreshCw size={15} className={loading ? 'student-refresh-spinning' : ''} />{loading ? 'Updating…' : 'Refresh dashboard'}</button>
          <span className="student-welcome-art" aria-hidden="true"><GraduationCap size={34} /></span>
        </div>
      </section>

      {error && <p className="student-alert" role="alert">{error}</p>}

      <section className="student-stats" aria-label="Learning summary">
        <a className="student-stat student-stat-link" href="#classes" aria-label="Jump to my classes"><span className="student-stat-icon"><BookOpen size={17} /></span><div><small>Joined classes</small><strong>{loading ? '—' : dashboard.stats.enrolledClasses || 0}</strong><span>View your classes <ArrowRight size={12} /></span><em>Keep all your learning spaces close.</em></div></a>
        <a className="student-stat student-stat-link" href="#schedule" aria-label="Jump to today's classes"><span className="student-stat-icon mint"><CalendarDays size={17} /></span><div><small>Meetings today</small><strong>{loading ? '—' : dashboard.stats.todayMeetings || 0}</strong><span>See today’s schedule <ArrowRight size={12} /></span><em>{dashboard.stats.todayMeetings ? 'Your classes for today.' : 'No classes on your schedule today.'}</em></div></a>
        <a className="student-stat student-stat-link" href="#schedule" aria-label="Jump to weekly schedule"><span className="student-stat-icon gold"><Clock3 size={17} /></span><div><small>Weekly meetings</small><strong>{loading ? '—' : dashboard.stats.weeklyMeetings || 0}</strong><span>Check your schedule <ArrowRight size={12} /></span><em>Plan ahead for the week.</em></div></a>
      </section>

      <section className="student-section" id="schedule">
        <div className="student-section-heading"><div><span className="student-eyebrow">{dashboard.today || 'TODAY'}</span><h2>Today’s classes</h2><p>Your upcoming classes and where to find them.</p></div><span className="student-section-count">{loading ? '—' : `${dashboard.todayMeetings.length} ${dashboard.todayMeetings.length === 1 ? 'class' : 'classes'}`}</span></div>
        {loading ? <p className="student-empty">Loading your schedule…</p> : dashboard.todayMeetings.length === 0 ? (
          <div className="student-empty"><CalendarDays size={23} /><strong>No classes scheduled today</strong><span>Your classes for today will appear here.</span></div>
        ) : <div className="student-today-list">{dashboard.todayMeetings.map((meeting, index) => <Link className="student-today-item" to={`/student/classes/${meeting.offeringId}`} key={`${meeting.offeringId}-${meeting.startTime}-${index}`}>
          <span className="student-time"><strong>{formatTime(meeting.startTime)}</strong><small>{formatTime(meeting.endTime)}</small></span>
          <span className="student-today-copy"><strong>{meeting.subject?.name || 'Class'}</strong><small>{meeting.subject?.subjectCode} · Section {meeting.section} · {meeting.professor?.fullName || 'Professor'}</small></span>
          {meeting.room && <span className="student-room"><MapPin size={13} />{meeting.room}</span>}<ArrowRight className="student-arrow" size={16} />
        </Link>)}</div>}
      </section>

      <section className="student-section" id="classes">
        <div className="student-section-heading"><div><span className="student-eyebrow">YOUR ENROLLMENTS</span><h2>My classes</h2><p>Search your subjects and jump back into a classroom.</p></div><button className="student-text-link student-join-trigger" type="button" onClick={onOpenJoinClass}>Join a class <ArrowRight size={15} /></button></div>
        {loading ? <p className="student-empty">Loading your classes…</p> : offerings.length === 0 ? (
          <div className="student-empty"><BookOpen size={24} /><strong>You haven’t joined a class yet</strong><span>Enter the class code from your professor to get started.</span><button className="student-join-link student-join-trigger" type="button" onClick={onOpenJoinClass}>Join your first class</button></div>
        ) : <>
          <div className="student-class-controls">
            <label className="student-class-search"><Search size={16} /><input type="search" value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Search subject, code, professor, or section" aria-label="Search my classes" />{classSearch && <button type="button" aria-label="Clear class search" onClick={() => setClassSearch('')}><X size={14} /></button>}</label>
            <div className="student-class-filters" role="group" aria-label="Filter classes by schedule">
              {[{ value: 'all', label: `All classes ${offerings.length}` }, { value: 'scheduled', label: 'With schedule' }, { value: 'unscheduled', label: 'No schedule' }].map((filter) => <button key={filter.value} type="button" className={classFilter === filter.value ? 'active' : ''} aria-pressed={classFilter === filter.value} onClick={() => setClassFilter(filter.value)}>{filter.label}</button>)}
            </div>
            <span className="student-class-result-count">{filteredOfferings.length} of {offerings.length} classes</span>
          </div>
          {filteredOfferings.length === 0 ? <div className="student-empty student-filter-empty"><Search size={22} /><strong>No matching classes</strong><span>Try a different search or schedule filter.</span><button type="button" className="student-filter-reset" onClick={() => { setClassSearch(''); setClassFilter('all') }}>Clear filters</button></div> : <div className="student-class-grid">{filteredOfferings.map((offering) => <Link className="student-class-card" to={`/student/classes/${offering._id}`} key={offering._id}>
          <div className="student-class-top"><span className="student-class-icon"><BookOpen size={17} /></span><span>{offering.subject?.subjectCode || 'CLASS'} · {offering.section}</span></div>
          <h3>{offering.subject?.name || 'Class'}</h3>
          <p>{offering.professor?.fullName || 'Professor'} · {offering.schoolYear} · {offering.term}</p>
          <div className="student-card-schedule">{offering.schedule?.map((meeting, index) => <span key={`${meeting.day}-${meeting.startTime}-${index}`}><CalendarDays size={13} />{meeting.day}, {formatTime(meeting.startTime)}{meeting.room ? ` · ${meeting.room}` : ''}</span>)}</div>
          <span className="student-card-open">Open class <ArrowRight size={14} /></span>
          </Link>)}</div>}
        </>}
      </section>
    </main>
  )
}
