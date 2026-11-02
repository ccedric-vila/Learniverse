import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileUp,
  GraduationCap,
  MapPin,
  School,
  UserRoundPen,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, useAuth } from '../auth/AuthContext'
import './professor.css'

const classNameCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SCHEDULE_DAYS = DAYS.slice(1)
const EMPTY_DASHBOARD = {
  professor: {},
  stats: { activeClasses: 0, todayMeetings: 0, weeklyMeetings: 0, totalStudents: 0, assignments: 0 },
  today: '',
  todayMeetings: [],
  offerings: [],
  schedule: [],
  recentActivities: [],
}

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }).format(date)
}

function formatMeeting(meeting) {
  return `${formatTime(meeting.startTime)} – ${formatTime(meeting.endTime)}`
}

function getUpcomingMeetings(schedule) {
  const now = new Date()
  return schedule
    .map((meeting) => {
      const meetingDay = DAYS.indexOf(meeting.day)
      if (meetingDay < 0) return null
      const daysUntil = (meetingDay - now.getDay() + 7) % 7
      return daysUntil <= 1 ? { ...meeting, daysUntil } : null
    })
    .filter(Boolean)
    .sort((first, second) => first.daysUntil - second.daysUntil || first.startTime.localeCompare(second.startTime))
}

function formatActivityTime(value) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const minutesAgo = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutesAgo < 1) return 'Just now'
  if (minutesAgo < 60) return `${minutesAgo} min ago`
  if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)} hr ago`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp))
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
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(() => {
    const today = DAYS[new Date().getDay()]
    return SCHEDULE_DAYS.includes(today) ? today : 'Monday'
  })
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
  const upcomingMeetings = getUpcomingMeetings(dashboard.schedule)
  const recentActivities = Array.isArray(dashboard.recentActivities) ? dashboard.recentActivities : []
  const selectedDayMeetings = dashboard.schedule
    .filter((meeting) => meeting.day === selectedScheduleDay)
    .sort((first, second) => first.startTime.localeCompare(second.startTime))

  return (
    <main className="professor-dashboard professor-dashboard-home">
      <section className="professor-welcome">
        <div className="professor-welcome-copy">
          <span className="professor-eyebrow"><span className="professor-live-dot" /> TEACHING OVERVIEW · {todayLabel.toUpperCase()}</span>
          <h1>{getGreeting()}, {firstName} <span className="professor-greeting-spark">✦</span></h1>
          <p>Here’s what’s happening across your classes today.</p>
        </div>
        <div className="professor-welcome-icon" aria-hidden="true"><School size={35} strokeWidth={1.5} /></div>
      </section>

      {error && <div className="professor-error" role="alert"><AlertCircle size={17} />{error}</div>}

      <section className="professor-quick-actions" aria-label="Quick links">
        <Link to="/professor#classes"><BookOpen size={17} /><span><strong>My classes</strong><small>Open a classroom</small></span><ArrowUpRight size={14} /></Link>
        <Link to="/professor#schedule"><CalendarDays size={17} /><span><strong>My schedule</strong><small>Plan your teaching week</small></span><ArrowUpRight size={14} /></Link>
        <Link to="/profile"><UserRoundPen size={17} /><span><strong>Account settings</strong><small>Manage your profile</small></span><ArrowUpRight size={14} /></Link>
      </section>

      <section className="professor-stats" aria-label="Teaching summary">
        <article className="professor-stat"><span className="professor-stat-icon"><BookOpen size={19} /></span><div><small>Active classes</small><strong>{loading ? '—' : dashboard.stats.activeClasses}</strong><span>Assigned this term</span></div></article>
        <details className="professor-stat professor-student-stat">
          <summary className="professor-student-stat-summary">
            <span className="professor-stat-icon blue"><GraduationCap size={19} /></span>
            <span className="professor-student-stat-copy"><small>My students</small><strong>{loading ? '—' : dashboard.stats.totalStudents}</strong><span>Across active classes · hover or select to preview</span></span>
          </summary>
          <div className="professor-student-class-preview">
            <strong>Students in each class</strong>
            {loading ? <span>Loading class counts…</span> : alphabetizedOfferings.length ? alphabetizedOfferings.map((offering) => (
              <Link to={`/professor/classes/${offering._id}`} key={offering._id}>
                <span>{offering.subject?.name || 'Subject unavailable'} · Section {offering.section}</span>
                <b>{offering.studentCount || 0}</b>
              </Link>
            )) : <span>No active classes.</span>}
          </div>
        </details>
        <article className="professor-stat"><span className="professor-stat-icon gold"><FileUp size={18} /></span><div><small>Assignments</small><strong>{loading ? '—' : dashboard.stats.assignments}</strong><span>Published for your classes</span></div></article>
        <article className="professor-stat"><span className="professor-stat-icon coral"><CalendarDays size={18} /></span><div><small>Classes today</small><strong>{loading ? '—' : dashboard.stats.todayMeetings}</strong><span>{dashboard.today || 'Today'}</span></div></article>
      </section>

      <div className="professor-dashboard-layout">
        <div className="professor-dashboard-main-column">
          <section className="professor-dashboard-panels">
            <article className="professor-dashboard-panel professor-upcoming-panel">
              <header className="professor-dashboard-panel-heading">
                <div><span className="professor-eyebrow">TODAY & TOMORROW</span><h2>Upcoming classes</h2><p>Your classes scheduled for today and tomorrow.</p></div>
                <span className="professor-panel-heading-icon"><CalendarDays size={17} /></span>
              </header>
              {loading ? <p className="professor-panel-empty">Loading your schedule…</p> : upcomingMeetings.length ? (
                <div className="professor-upcoming-list">{upcomingMeetings.map((meeting, index) => (
                  <Link className="professor-upcoming-item" to={`/professor/classes/${meeting.offeringId}`} key={`${meeting.offeringId}-${meeting.day}-${meeting.startTime}-${index}`}>
                    <span className="professor-upcoming-time"><strong>{formatTime(meeting.startTime)}</strong><small>{meeting.day.slice(0, 3)}</small></span>
                    <span className="professor-upcoming-copy"><strong>{meeting.subject?.name || 'Subject unavailable'}</strong><small>Section {meeting.section}{meeting.room ? ` · ${meeting.room}` : ''}</small></span>
                    <span className="professor-upcoming-when">{meeting.daysUntil === 0 ? 'Today' : 'Tomorrow'}</span>
                  </Link>
                ))}</div>
              ) : <div className="professor-panel-empty"><CalendarDays size={22} /><strong>No classes today or tomorrow</strong><span>Your schedule is clear for these two days.</span></div>}
              <Link className="professor-panel-link" to="/professor#schedule">View weekly schedule <ArrowRight size={14} /></Link>
            </article>
          </section>

          <section className="professor-section professor-weekly-schedule" id="schedule">
            <div className="professor-section-heading">
              <div><span className="professor-eyebrow">WEEK AT A GLANCE</span><h2>Teaching schedule</h2><p>Choose a day to see your classes and meeting details.</p></div>
              <span className="professor-count">{loading ? '—' : `${dashboard.schedule.length} meetings`}</span>
            </div>
            {loading ? <p className="professor-empty">Loading your schedule…</p> : (
              <>
                <div className="professor-schedule-days" role="group" aria-label="Select a day to view classes">
                  {SCHEDULE_DAYS.map((day) => {
                    const count = dashboard.schedule.filter((meeting) => meeting.day === day).length
                    const isToday = dashboard.today === day
                    return (
                      <button
                        className={`professor-schedule-day${selectedScheduleDay === day ? ' active' : ''}${isToday ? ' today' : ''}`}
                        type="button"
                        key={day}
                        aria-pressed={selectedScheduleDay === day}
                        onClick={() => setSelectedScheduleDay(day)}
                      >
                        <span>{day.slice(0, 3)}</span>
                        <strong>{count}</strong>
                        <small>{isToday ? 'Today' : count === 1 ? 'class' : 'classes'}</small>
                      </button>
                    )
                  })}
                </div>
                <div className="professor-selected-day-heading">
                  <div><CalendarDays size={16} /><h3>{selectedScheduleDay}{dashboard.today === selectedScheduleDay ? ' · Today' : ''}</h3></div>
                  <span>{selectedDayMeetings.length} {selectedDayMeetings.length === 1 ? 'meeting' : 'meetings'}</span>
                </div>
                {selectedDayMeetings.length ? (
                  <div className="professor-selected-day-list">
                    {selectedDayMeetings.map((meeting, index) => (
                      <Link className="professor-selected-meeting" to={`/professor/classes/${meeting.offeringId}`} key={`${meeting.offeringId}-${meeting.startTime}-${index}`}>
                        <span className="professor-selected-meeting-time"><Clock3 size={15} /><strong>{formatTime(meeting.startTime)}</strong><small>{formatTime(meeting.endTime)}</small></span>
                        <span className="professor-selected-meeting-copy"><strong>{meeting.subject?.name || 'Subject unavailable'}</strong><small>{meeting.subject?.subjectCode || 'CLASS'} · Section {meeting.section}</small></span>
                        <span className="professor-selected-meeting-room"><MapPin size={14} />{meeting.room || 'Room not set'}</span>
                        <ArrowUpRight size={15} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="professor-schedule-day-empty"><CalendarDays size={20} /><span>No classes scheduled for {selectedScheduleDay}.</span></div>
                )}
              </>
            )}
          </section>

          <section className="professor-section professor-all-classes" id="classes">
        <div className="professor-section-heading"><div><span className="professor-eyebrow">CLASS DIRECTORY</span><h2>All assigned classes</h2><p>Course schedules and student join codes.</p></div><span className="professor-count">{loading ? '—' : `${dashboard.offerings.length} classes`}</span></div>
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
        </div>

        <aside className="professor-dashboard-rail">
          <section className="professor-dashboard-panel professor-activity-panel" aria-labelledby="professor-activity-heading">
            <header className="professor-dashboard-panel-heading">
              <div><span className="professor-eyebrow">STUDENT PROGRESS</span><h2 id="professor-activity-heading">Recent activity</h2><p>Latest submissions across your classes.</p></div>
              <span className="professor-panel-count">{loading ? '—' : recentActivities.length}</span>
            </header>
            {loading ? <p className="professor-panel-empty">Loading student activity…</p> : recentActivities.length ? (
              <div className="professor-activity-list">
                {recentActivities.map((activity) => (
                  <Link className="professor-activity-item" to={`/professor/classes/${activity.offeringId}`} key={activity.id}>
                    <span className="professor-activity-avatar">
                      {activity.student.profileImage
                        ? <img src={activity.student.profileImage} alt="" />
                        : (activity.student.fullName || 'S').trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="professor-activity-copy">
                      <strong>{activity.student.fullName || 'Student'} <span>{activity.action || (activity.type === 'quiz' ? 'completed a quiz' : 'submitted an assignment')}</span></strong>
                      <small>{activity.title} · {activity.subject?.name || 'Subject unavailable'}{activity.subject?.subjectCode ? ` (${activity.subject.subjectCode})` : ''} · Section {activity.section}</small>
                    </span>
                    <span className={`professor-activity-status ${activity.status}`}>
                      <ClipboardCheck size={12} />
                      {activity.status === 'reviewed' ? 'Reviewed' : activity.status === 'late' ? 'Late' : activity.status === 'timed_out' ? 'Timed out' : activity.status === 'pending' ? 'Pending' : 'Submitted'}
                    </span>
                    <time className="professor-activity-time" dateTime={activity.occurredAt}>{formatActivityTime(activity.occurredAt)}</time>
                    <ArrowRight className="professor-activity-arrow" size={14} />
                  </Link>
                ))}
              </div>
            ) : <div className="professor-panel-empty"><ClipboardCheck size={22} /><strong>No recent student activity</strong><span>Assignment and quiz submissions from your classes will appear here.</span></div>}
          </section>
        </aside>
      </div>
    </main>
  )
}
