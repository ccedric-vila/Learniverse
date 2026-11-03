import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, BookOpen, CalendarClock, CheckCircle2, ClipboardList, ListChecks, RefreshCw, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import './student.css'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'missing', label: 'Missing' },
  { value: 'done', label: 'Done' },
]

function getActivityStatus(task, now) {
  if (task.completed === true) return 'done'
  if (task.completed !== false) return 'unknown'

  const deadline = task.deadline ? new Date(task.deadline).getTime() : Number.NaN
  return Number.isFinite(deadline) && deadline < now ? 'missing' : 'assigned'
}

function isAvailable(task, now) {
  const availableAt = task.availableAt || task.publishAt || task.publishedAt
  if (!availableAt) return task.isScheduled !== true && task.isPublished !== false && task.published !== false
  const timestamp = new Date(availableAt).getTime()
  return Number.isFinite(timestamp) && timestamp <= now && task.isPublished !== false && task.published !== false
}

function formatDeadline(deadline) {
  if (!deadline) return 'No deadline set'
  const date = new Date(deadline)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Deadline unavailable'
}

function getActivityType(type) {
  const normalized = String(type || 'assignment').toLowerCase()
  if (normalized === 'quiz') return 'Quiz'
  if (normalized === 'seatwork') return 'Seatwork'
  return normalized.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getTaskId(task) {
  return task.id || task._id || task.materialId
}

function getActivityHref(activity) {
  return activity.type === 'quiz'
    ? {
        to: `/student/classes/${activity.classId}`,
        state: { activeTab: 'quizzes' },
      }
    : { to: `/student/classes/${activity.classId}/materials/${activity.id}` }
}

export default function StudentTodo() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState([])
  const [now, setNow] = useState(0)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('soonest')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let active = true

    api.get('/student/dashboard')
      .then(async ({ data }) => {
        if (!Array.isArray(data.offerings)) throw new Error('Your class list could not be read.')
        const offerings = data.offerings
        const uniqueOfferings = [...new Map(offerings.map((offering) => [offering._id, offering])).values()]
        const results = await Promise.all(uniqueOfferings.map(async (offering) => {
          try {
            const { data: taskData } = await api.get(`/student/classes/${offering._id}/tasks`)
            if (!Array.isArray(taskData.tasks)) throw new Error('Activity list has an unexpected format.')
            return { offering, tasks: taskData.tasks, error: '' }
          } catch (requestError) {
            return {
              offering,
              tasks: [],
              error: requestError.response?.data?.message || requestError.message || `Could not load activities for ${offering.subject?.name || 'a class'}.`,
            }
          }
        }))

        if (!active) return
        setNow(Date.now())
        const nextActivities = []
        const seen = new Set()
        const nextErrors = []
        results.forEach(({ offering, tasks, error }) => {
          if (error) nextErrors.push(error)
          tasks.forEach((task) => {
            const id = getTaskId(task)
            if (!id || !isAvailable(task, Date.now())) return
            const type = String(task.type || 'assignment').toLowerCase()
            const key = `${type}:${id}`
            if (seen.has(key)) return
            seen.add(key)
            nextActivities.push({
              ...task,
              id,
              type,
              classId: offering._id,
              className: offering.subject?.name || 'Class',
              section: offering.section || '',
              professorName: offering.professor?.fullName || '',
            })
          })
        })
        setActivities(nextActivities)
        setErrors(nextErrors)
      })
      .catch((requestError) => {
        if (active) {
          setActivities([])
          setNow(Date.now())
          setErrors([requestError.response?.data?.message || requestError.message || 'Could not load your classes and activities.'])
        }
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [refreshVersion])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const classifiedActivities = useMemo(() => activities.map((activity) => ({
    ...activity,
    status: getActivityStatus(activity, now),
  })), [activities, now])
  const counts = useMemo(() => ({
    assigned: classifiedActivities.filter((activity) => activity.status === 'assigned').length,
    missing: classifiedActivities.filter((activity) => activity.status === 'missing').length,
    done: classifiedActivities.filter((activity) => activity.status === 'done').length,
  }), [classifiedActivities])
  const classes = useMemo(() => {
    const uniqueClasses = new Map()
    classifiedActivities.forEach((activity) => uniqueClasses.set(activity.classId, activity.className))
    return [...uniqueClasses].sort((first, second) => first[1].localeCompare(second[1]))
  }, [classifiedActivities])
  const visibleActivities = useMemo(() => {
    const query = search.trim().toLowerCase()
    return classifiedActivities
      .filter((activity) => activeTab === 'all' || activity.status === activeTab)
      .filter((activity) => classFilter === 'all' || activity.classId === classFilter)
      .filter((activity) => !query || String(activity.title || '').toLowerCase().includes(query))
      .sort((first, second) => {
        const firstDeadline = first.deadline ? new Date(first.deadline).getTime() : Number.POSITIVE_INFINITY
        const secondDeadline = second.deadline ? new Date(second.deadline).getTime() : Number.POSITIVE_INFINITY
        return sortOrder === 'latest' ? secondDeadline - firstDeadline : firstDeadline - secondDeadline
      })
  }, [activeTab, classFilter, classifiedActivities, search, sortOrder])

  function refreshActivities() {
    setLoading(true)
    setErrors([])
    setRefreshVersion((value) => value + 1)
  }

  function renderActivityAction(activity) {
    const destination = getActivityHref(activity)
    return <Link className="student-todo-open" to={destination.to} state={destination.state}>
      {activity.status === 'done' ? 'View details' : 'View activity'}<ArrowRight size={14} />
    </Link>
  }

  return (
    <main className="student-page student-todo-page">
      <header className="student-todo-hero">
        <div>
          <span className="student-eyebrow">YOUR LEARNING CHECKLIST</span>
          <h1>To-Do</h1>
          <p>Keep track of your assignments, quizzes, and other academic activities.</p>
        </div>
        <span className="student-todo-hero-icon" aria-hidden="true"><ListChecks size={25} /></span>
      </header>

      <section className="student-todo-summary" aria-label="Activity summary">
        <article className="student-todo-summary-card assigned">
          <span className="student-todo-summary-icon"><ClipboardList size={18} /></span>
          <div><small>Assigned</small><strong>{loading || errors.length ? '—' : counts.assigned}</strong><span>Ready to work on</span></div>
        </article>
        <article className="student-todo-summary-card missing">
          <span className="student-todo-summary-icon"><CalendarClock size={18} /></span>
          <div><small>Missing</small><strong>{loading || errors.length ? '—' : counts.missing}</strong><span>Past due and not submitted</span></div>
        </article>
        <article className="student-todo-summary-card done">
          <span className="student-todo-summary-icon"><CheckCircle2 size={18} /></span>
          <div><small>Done</small><strong>{loading || errors.length ? '—' : counts.done}</strong><span>Submitted activities</span></div>
        </article>
      </section>

      {errors.map((error, index) => <p className="student-todo-error" role="alert" key={`${error}-${index}`}><AlertCircle size={15} />{error}</p>)}

      <section className="student-todo-content" aria-label="Academic activities">
        <div className="student-todo-toolbar">
          <label className="student-todo-search">
            <Search size={16} />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search activities by title" aria-label="Search activities" />
          </label>
          <label className="student-todo-select">
            <span className="student-todo-sr-only">Filter by class</span>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="all">All classes</option>
              {classes.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
            </select>
          </label>
          <label className="student-todo-select student-todo-sort">
            <span className="student-todo-sr-only">Sort deadlines</span>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="soonest">Soonest deadline</option>
              <option value="latest">Latest deadline</option>
            </select>
          </label>
          <button className="student-todo-refresh" type="button" onClick={refreshActivities} disabled={loading} aria-label="Refresh activities">
            <RefreshCw size={15} className={loading ? 'student-todo-spinning' : ''} /><span>Refresh</span>
          </button>
        </div>

        <div className="student-todo-tabs" role="tablist" aria-label="Filter activities by status">
          {STATUS_TABS.map((tab) => (
            <button type="button" role="tab" aria-selected={activeTab === tab.value} className={activeTab === tab.value ? 'active' : ''} onClick={() => setActiveTab(tab.value)} key={tab.value}>
              {tab.label}{tab.value !== 'all' && <span>{errors.length ? '—' : counts[tab.value]}</span>}
            </button>
          ))}
        </div>

        {loading ? <div className="student-todo-empty"><RefreshCw size={21} className="student-todo-spinning" /><strong>Loading your activities…</strong></div> : visibleActivities.length === 0 ? (
          <div className="student-todo-empty">
            <BookOpen size={24} />
            <strong>{search || classFilter !== 'all' ? 'No matching activities' : activeTab === 'all' ? 'No activities yet' : `No ${activeTab} activities`}</strong>
            <span>{search || classFilter !== 'all' ? 'Try adjusting your search or class filter.' : 'Published assignments and quizzes from your classes will appear here.'}</span>
          </div>
        ) : (
          <div className="student-todo-list">
            {visibleActivities.map((activity) => (
              <article className={`student-todo-item ${activity.status}`} key={`${activity.classId}:${activity.type}:${activity.id}`}>
                <span className={`student-todo-status-icon ${activity.status}`} aria-hidden="true">
                  {activity.status === 'done' ? <CheckCircle2 size={18} /> : activity.status === 'missing' ? <CalendarClock size={18} /> : activity.status === 'assigned' ? <ClipboardList size={18} /> : <AlertCircle size={18} />}
                </span>
                <div className="student-todo-copy">
                  <div className="student-todo-title-row">
                    <h2>{activity.title || 'Untitled activity'}</h2>
                    <span className={`student-todo-status-label ${activity.status}`}>{activity.status === 'unknown' ? 'Status unavailable' : activity.status}</span>
                  </div>
                  <div className="student-todo-meta">
                    <span>{getActivityType(activity.type)}</span>
                    <span>{activity.className}{activity.section ? ` · Section ${activity.section}` : ''}</span>
                    {activity.professorName && <span>{activity.professorName}</span>}
                  </div>
                  <p className="student-todo-deadline"><CalendarClock size={14} />{activity.deadline ? `Due ${formatDeadline(activity.deadline)}` : 'No deadline set'}</p>
                </div>
                {renderActivityAction(activity)}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
