import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock3, GraduationCap, MapPin, RefreshCw, Search, UserRoundPen, UsersRound, X } from 'lucide-react'
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
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
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
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const schedule = dashboard.schedule || offerings.flatMap((offering) => (offering.schedule || []).map((meeting) => ({
    ...meeting,
    offeringId: offering._id,
    subject: offering.subject,
    section: offering.section,
    professor: offering.professor,
  })))
  const meetingCountsByDay = weekDays.map((day) => ({
    day,
    count: schedule.filter((meeting) => meeting.day === day).length,
  }))
  const selectedDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(selectedDate)
  const selectedDateMeetings = schedule
    .filter((meeting) => meeting.day === selectedDay)
    .sort((first, second) => first.startTime.localeCompare(second.startTime))
  const selectedDateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(selectedDate)
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarMonth)
  const monthStartOffset = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
  const calendarDays = [
    ...Array.from({ length: monthStartOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1)),
  ]
  while (calendarDays.length % 7) calendarDays.push(null)
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
      <div className="student-dashboard-grid">
        <div className="student-dashboard-main">
          <section className="student-welcome">
            <div className="student-welcome-copy">
              <span className="student-eyebrow">YOUR LEARNING SPACE</span>
              <h1>{getGreeting()}, {firstName}!</h1>
              <p>Let’s make today a good day to learn.</p>
            </div>
            <div className="student-welcome-actions">
              <span className="student-date-chip"><CalendarDays size={14} />{todayLabel}</span>
              <button className="student-join-primary student-join-trigger" type="button" onClick={onOpenJoinClass}><BookOpen size={15} />Join a class</button>
              <button className="student-dashboard-refresh" type="button" onClick={refreshDashboard} disabled={loading} aria-label={loading ? 'Refreshing dashboard' : 'Refresh dashboard'} title={loading ? 'Updating…' : 'Refresh dashboard'}><RefreshCw size={15} className={loading ? 'student-refresh-spinning' : ''} />{loading ? 'Updating…' : 'Refresh'}</button>
            </div>
          </section>

          {error && <p className="student-alert" role="alert">{error}</p>}

          <section className="student-stats" aria-label="Learning summary">
            <a className="student-stat student-stat-link stat-classes" href="#classes" aria-label="Jump to my classes"><span className="student-stat-icon"><BookOpen size={18} /></span><div><small>Joined classes</small><strong>{loading ? '—' : dashboard.stats.enrolledClasses || 0}</strong><em>Learning spaces</em></div></a>
            <a className="student-stat student-stat-link stat-today" href="#schedule" aria-label="Jump to today's classes"><span className="student-stat-icon mint"><CalendarDays size={18} /></span><div><small>Meetings today</small><strong>{loading ? '—' : dashboard.stats.todayMeetings || 0}</strong><em>{dashboard.today || 'Today'}</em></div></a>
            <a className="student-stat student-stat-link stat-week" href="#weekly-schedule" aria-label="Jump to weekly schedule"><span className="student-stat-icon gold"><Clock3 size={18} /></span><div><small>Weekly meetings</small><strong>{loading ? '—' : dashboard.stats.weeklyMeetings || 0}</strong><em>Across your classes</em></div></a>
          </section>

          <section className="student-dashboard-charts" aria-label="Schedule insights">
            <article className="student-chart-card" id="weekly-schedule">
              <div className="student-chart-heading"><div><span className="student-eyebrow">YOUR TIMETABLE</span><h2>Weekly class rhythm</h2></div><span className="student-chart-total"><CalendarDays size={14} />{loading ? '—' : `${dashboard.stats.weeklyMeetings || 0} meetings`}</span></div>
              {loading ? <p className="student-chart-loading">Loading your schedule…</p> : schedule.length === 0 ? (
                <div className="student-chart-empty"><CalendarDays size={21} /><span>Add a class to see your weekly schedule.</span></div>
              ) : <div className="student-week-bars" role="img" aria-label={meetingCountsByDay.map(({ day, count }) => `${day}: ${count} ${count === 1 ? 'class' : 'classes'}`).join(', ')}>
                {meetingCountsByDay.map(({ day, count }) => <div className={`student-week-day${day === selectedDay ? ' selected' : ''}`} key={day}>
                  <div className="student-week-bar-track"><span className="student-week-bar" style={{ height: `${count ? Math.max(12, (count / Math.max(...meetingCountsByDay.map((entry) => entry.count))) * 100) : 0}%` }} /></div>
                  <strong>{count}</strong><small>{day.slice(0, 3)}</small>
                </div>)}
              </div>}
            </article>
            <article className="student-week-summary">
              <span className="student-week-summary-icon"><GraduationCap size={22} /></span>
              <span className="student-eyebrow">THIS WEEK</span>
              <strong>{loading ? '—' : dashboard.stats.weeklyMeetings || 0}</strong>
              <small>scheduled class meetings</small>
              <span className="student-summary-rule" />
              <span className="student-summary-detail"><UsersRound size={14} />{loading ? '—' : dashboard.stats.enrolledClasses || 0} active {dashboard.stats.enrolledClasses === 1 ? 'class' : 'classes'}</span>
            </article>
          </section>

          <section className="student-section student-classes-section" id="classes">
            <div className="student-section-heading"><div><span className="student-eyebrow">YOUR ENROLLMENTS</span><h2>My classes</h2><p>Pick up where you left off.</p></div><button className="student-text-link student-join-trigger" type="button" onClick={onOpenJoinClass}>Join a class <ArrowRight size={15} /></button></div>
            {loading ? <p className="student-empty">Loading your classes…</p> : offerings.length === 0 ? (
              <div className="student-empty"><BookOpen size={24} /><strong>You haven’t joined a class yet</strong><span>Enter the class code from your professor to get started.</span><button className="student-join-link student-join-trigger" type="button" onClick={onOpenJoinClass}>Join your first class</button></div>
            ) : <>
              <div className="student-class-controls">
                <label className="student-class-search"><Search size={16} /><input type="search" value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Search your classes…" aria-label="Search my classes" />{classSearch && <button type="button" aria-label="Clear class search" onClick={() => setClassSearch('')}><X size={14} /></button>}</label>
                <div className="student-class-filters" role="group" aria-label="Filter classes by schedule">
                  {[{ value: 'all', label: `All ${offerings.length}` }, { value: 'scheduled', label: 'Scheduled' }, { value: 'unscheduled', label: 'No schedule' }].map((filter) => <button key={filter.value} type="button" className={classFilter === filter.value ? 'active' : ''} aria-pressed={classFilter === filter.value} onClick={() => setClassFilter(filter.value)}>{filter.label}</button>)}
                </div>
                <span className="student-class-result-count">{filteredOfferings.length} of {offerings.length}</span>
              </div>
              {filteredOfferings.length === 0 ? <div className="student-empty student-filter-empty"><Search size={22} /><strong>No matching classes</strong><span>Try a different search or schedule filter.</span><button type="button" className="student-filter-reset" onClick={() => { setClassSearch(''); setClassFilter('all') }}>Clear filters</button></div> : <div className="student-class-grid">{filteredOfferings.map((offering, index) => <Link className={`student-class-card student-course-card course-tone-${index % 3}`} to={`/student/classes/${offering._id}`} key={offering._id}>
                <div className="student-class-top"><span className="student-class-icon"><BookOpen size={17} /></span><span>{offering.subject?.subjectCode || 'CLASS'} · {offering.section}</span></div>
                <h3>{offering.subject?.name || 'Class'}</h3>
                <p>{offering.professor?.fullName || 'Professor'} · {offering.schoolYear} · {offering.term}</p>
                <div className="student-card-schedule">{offering.schedule?.map((meeting, meetingIndex) => <span key={`${meeting.day}-${meeting.startTime}-${meetingIndex}`}><CalendarDays size={13} />{meeting.day}, {formatTime(meeting.startTime)}{meeting.room ? ` · ${meeting.room}` : ''}</span>)}</div>
                <span className="student-card-open">Open class <ArrowRight size={14} /></span>
              </Link>)}</div>}
            </>}
          </section>
        </div>

        <aside className="student-dashboard-rail" aria-label="Your profile and calendar">
          <section className="student-profile-card">
            <div className="student-rail-heading"><h2>Profile</h2><Link to="/profile" aria-label="Edit profile"><UserRoundPen size={16} /></Link></div>
            <div className="student-profile-person">
              <span className="student-profile-avatar">{user?.profileImage ? <img src={user.profileImage} alt="" /> : firstName.charAt(0).toUpperCase()}</span>
              <strong>{dashboard.student?.fullName || user?.fullName || 'Student'}</strong>
              <small>Student</small>
              <div className="student-profile-academic">
                {[
                  ['Department', dashboard.student?.department || user?.department],
                  ['Course', dashboard.student?.courseProgram || user?.courseProgram],
                  ['Year level', dashboard.student?.yearLevel || user?.yearLevel],
                  ['Section', dashboard.student?.section || user?.section],
                ].filter(([, value]) => value).map(([label, value]) => <span key={label}><b>{label}:</b> {value}</span>)}
                {!dashboard.student?.department && !user?.department
                  && !dashboard.student?.courseProgram && !user?.courseProgram
                  && !dashboard.student?.yearLevel && !user?.yearLevel
                  && !dashboard.student?.section && !user?.section
                  ? 'Add your academic details in your profile.'
                  : null}
              </div>
            </div>
          </section>

          <section className="student-calendar-card" aria-label="Class calendar">
            <div className="student-calendar-heading">
              <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
              <h2>{monthLabel}</h2>
              <button type="button" aria-label="Next month" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
            </div>
            <div className="student-calendar-grid" role="grid" aria-label={monthLabel}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span className="student-calendar-weekday" role="columnheader" key={`${day}-${index}`}>{day}</span>)}
              {calendarDays.map((date, index) => {
                if (!date) return <span className="student-calendar-blank" role="gridcell" key={`blank-${index}`} />
                const hasClasses = schedule.some((meeting) => meeting.day === new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date))
                const selected = date.toDateString() === selectedDate.toDateString()
                const isToday = date.toDateString() === new Date().toDateString()
                return <button className={`student-calendar-day${selected ? ' selected' : ''}${isToday ? ' today' : ''}${hasClasses ? ' has-classes' : ''}`} type="button" role="gridcell" aria-label={`${new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)}${hasClasses ? ', recurring class schedule' : ''}`} aria-selected={selected} key={date.toISOString()} onClick={() => setSelectedDate(date)}>
                  {date.getDate()}{hasClasses && <i aria-hidden="true" />}
                </button>
              })}
            </div>
            <div className="student-calendar-legend"><span /><small>Class day</small><button type="button" onClick={() => { const today = new Date(); setSelectedDate(today); setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }}>Today</button></div>
          </section>

          <section className="student-agenda-card" id="schedule">
            <div className="student-agenda-heading"><div><span className="student-eyebrow">YOUR SCHEDULE</span><h2>{selectedDate.toDateString() === new Date().toDateString() ? 'Today' : selectedDay}</h2><p>{selectedDateLabel}</p></div><span>{loading ? '—' : selectedDateMeetings.length}</span></div>
            {loading ? <p className="student-agenda-empty">Loading schedule…</p> : selectedDateMeetings.length ? <div className="student-agenda-list">{selectedDateMeetings.map((meeting, index) => <Link className="student-agenda-item" to={`/student/classes/${meeting.offeringId}`} key={`${meeting.offeringId}-${meeting.startTime}-${index}`}><span className="student-agenda-time">{formatTime(meeting.startTime)}</span><span className="student-agenda-marker" /><span className="student-agenda-copy"><strong>{meeting.subject?.name || 'Class'}</strong><small>{meeting.room || meeting.subject?.subjectCode || 'Classroom'}</small></span></Link>)}</div> : <div className="student-agenda-empty"><CalendarDays size={19} /><span>No recurring classes on this day.</span></div>}
          </section>

        </aside>
      </div>
    </main>
  )
}
