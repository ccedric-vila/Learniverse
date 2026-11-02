import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, BookOpen, CalendarDays, Clock3, MapPin, School } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, useAuth } from '../auth/AuthContext'
import './professor.css'

const classNameCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const EMPTY_DASHBOARD = {
  professor: {}, stats: { activeClasses: 0, todayMeetings: 0, weeklyMeetings: 0 },
  today: '', todayMeetings: [], offerings: [], schedule: [],
}

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatMeeting(meeting) {
  return `${formatTime(meeting.startTime)} – ${formatTime(meeting.endTime)}`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const [todayLabel] = useState(() => new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date()))
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/professor/dashboard')
      .then(({ data }) => { if (active) setDashboard(data) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load your teaching dashboard.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const firstName = (dashboard.professor?.fullName || user?.fullName || 'Professor').split(' ')[0]
  const alphabetizedOfferings = [...dashboard.offerings].sort((first, second) => (
    classNameCollator.compare(first.subject?.name || '', second.subject?.name || '')
      || classNameCollator.compare(first.section || '', second.section || '')
  ))

  return (
    <main className="professor-dashboard professor-dashboard-home">
      <section className="professor-welcome">
        <div>
          <span className="professor-eyebrow"><span className="professor-live-dot" /> YOUR TEACHING SPACE</span>
          <h1>{getGreeting()}, {firstName}</h1>
          <p>{dashboard.professor?.department || user?.department || 'Your classes and weekly schedule, all in one place.'} <span>Here’s your teaching overview for today.</span></p>
          <div className="professor-welcome-actions">
            <span className="professor-date-chip"><CalendarDays size={14} />{todayLabel}</span>
            <Link to="/professor#schedule">View today’s schedule <ArrowUpRight size={14} /></Link>
            <Link to="/professor#classes">Browse classes <ArrowUpRight size={14} /></Link>
          </div>
        </div>
        <div className="professor-welcome-icon" aria-hidden="true"><School size={35} strokeWidth={1.5} /></div>
      </section>

      {error && <div className="professor-error" role="alert"><AlertCircle size={17} />{error}</div>}

      <section className="professor-stats" aria-label="Teaching summary">
        <article className="professor-stat"><span className="professor-stat-icon"><BookOpen size={18} /></span><div><small>Active classes</small><strong>{loading ? '—' : dashboard.stats.activeClasses}</strong><span>Ready for your students</span></div></article>
        <article className="professor-stat"><span className="professor-stat-icon mint"><CalendarDays size={18} /></span><div><small>Meetings today</small><strong>{loading ? '—' : dashboard.stats.todayMeetings}</strong><span>{dashboard.stats.todayMeetings === 0 ? 'No classes scheduled today' : dashboard.stats.todayMeetings === 1 ? 'Class on your schedule' : 'Classes on your schedule'}</span></div></article>
        <article className="professor-stat"><span className="professor-stat-icon gold"><Clock3 size={18} /></span><div><small>Weekly meetings</small><strong>{loading ? '—' : dashboard.stats.weeklyMeetings}</strong><span>Across your active classes</span></div></article>
      </section>

      <section className="professor-section" id="schedule">
        <div className="professor-section-heading"><div><span className="professor-eyebrow">{dashboard.today || 'TODAY'}</span><h2>Today’s schedule</h2><p>Review your classes and open a classroom.</p></div></div>
        {loading ? <p className="professor-empty">Loading your schedule…</p> : dashboard.todayMeetings.length === 0 ? (
          <div className="professor-empty"><CalendarDays size={24} /><strong>No classes scheduled today</strong><span>Enjoy the open time in your schedule.</span></div>
        ) : (
          <div className="professor-today-list">{dashboard.todayMeetings.map((meeting, index) => <Link className="professor-today-card" to={`/professor/classes/${meeting.offeringId}`} key={`${meeting.offeringId}-${meeting.startTime}-${index}`}>
            <div className="professor-time"><strong>{formatTime(meeting.startTime)}</strong><span>{formatTime(meeting.endTime)}</span></div>
            <div className="professor-meeting-copy"><strong>{meeting.subject?.name || 'Subject unavailable'}</strong><span>{meeting.subject?.subjectCode || '—'} · Section {meeting.section}</span></div>
            {meeting.room && <span className="professor-room"><MapPin size={14} />{meeting.room}</span>}<ArrowUpRight className="professor-card-arrow" size={16} />
          </Link>)}</div>
        )}
      </section>

      <section className="professor-section" id="classes">
        <div className="professor-section-heading"><div><span className="professor-eyebrow">YOUR ASSIGNMENTS</span><h2>Assigned classes</h2><p>Quick access to your active classroom spaces.</p></div><span className="professor-count">{loading ? '—' : dashboard.offerings.length} classes</span></div>
        {loading ? <p className="professor-empty">Loading assigned classes…</p> : dashboard.offerings.length === 0 ? (
          <div className="professor-empty"><BookOpen size={24} /><strong>No active classes assigned</strong><span>Your administrator’s class assignments will appear here.</span></div>
        ) : (
          <div className="professor-class-grid">{alphabetizedOfferings.map((offering) => <Link className="professor-class-card" to={`/professor/classes/${offering._id}`} key={offering._id} aria-label={`Open ${offering.subject?.name || 'class'} Section ${offering.section}`}>
            <div className="professor-class-top"><span className="professor-class-icon"><BookOpen size={18} /></span><span className="professor-class-code">{offering.subject?.subjectCode || 'CLASS'} · {offering.section}</span></div>
            <h3>{offering.subject?.name || 'Subject unavailable'}</h3>
            <p className="professor-class-term">{offering.schoolYear} · {offering.term}</p>
            <div className="professor-class-schedule">{offering.schedule?.length ? offering.schedule.map((meeting, index) => <div className="professor-class-meeting" key={`${meeting.day}-${meeting.startTime}-${index}`}><CalendarDays size={14} /><span><strong>{meeting.day}</strong> {formatMeeting(meeting)}{meeting.room && <em> · {meeting.room}</em>}</span></div>) : <span>No schedule listed</span>}</div>
            <div className="professor-join-code"><span>Student class code</span><strong>{offering.classCode}</strong></div>
            <span className="professor-class-open">Open class <ArrowUpRight size={14} /></span>
          </Link>)}</div>
        )}
      </section>
    </main>
  )
}
