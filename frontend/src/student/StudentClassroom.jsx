import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Download, FileText, FolderOpen, LockKeyhole, MapPin } from 'lucide-react'
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

function formatDeadline(deadline) {
  if (!deadline) return 'No deadline set'
  const date = new Date(deadline)
  if (!Number.isFinite(date.getTime())) return 'Deadline unavailable'
  const dateLabel = getDeadlineDateLabel(date)
  const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
  return `Due ${dateLabel} · ${timeLabel}`
}

function getDeadlineDateLabel(date) {
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const deadlineDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (deadlineDay.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) return 'today'
  if (deadlineDay.getTime() === tomorrow.getTime()) return 'tomorrow'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function getUpcomingDeadline(tasks) {
  return tasks
    .filter((task) => !task.completed && !task.overdue && task.deadline && Number.isFinite(new Date(task.deadline).getTime()))
    .sort((first, second) => new Date(first.deadline) - new Date(second.deadline))[0] || null
}

export default function StudentClassroom() {
  const { classId } = useParams()
  const location = useLocation()
  const [request, setRequest] = useState({ classId: null, offering: null, error: '' })
  const [activeTab, setActiveTab] = useState(() => location.state?.activeTab || 'stream')
  const [materialsState, setMaterialsState] = useState({ classId: null, materials: [], error: '' })
  const [quizOutlineState, setQuizOutlineState] = useState({ classId: null, quizzes: [], error: '' })
  const [tasksState, setTasksState] = useState({ classId: null, tasks: [], error: '' })
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

  useEffect(() => {
    let active = true
    api.get(`/student/classes/${classId}/quizzes`)
      .then(({ data }) => { if (active) setQuizOutlineState({ classId, quizzes: data.quizzes || [], error: '' }) })
      .catch((requestError) => {
        if (active) setQuizOutlineState({
          classId,
          quizzes: [],
          error: requestError.response?.data?.message || 'Could not load topic quiz progress.',
        })
      })
    return () => { active = false }
  }, [classId])

  useEffect(() => {
    if (activeTab !== 'stream') return undefined
    let active = true
    api.get(`/student/classes/${classId}/tasks`)
      .then(({ data }) => {
        if (active) setTasksState({ classId, tasks: data.tasks || [], error: '' })
      })
      .catch((tasksRequestError) => {
        if (active) setTasksState({
          classId,
          tasks: [],
          error: tasksRequestError.response?.data?.message || 'Could not load this class task list.',
        })
      })
    return () => { active = false }
  }, [classId, activeTab])

  const loading = request.classId !== classId
  const offering = loading ? null : request.offering
  const error = loading ? '' : request.error
  const materials = materialsState.classId === classId ? materialsState.materials : []
  const materialsError = materialsState.classId === classId ? materialsState.error : ''
  const materialsLoading = materialsState.classId !== classId
  const outlineQuizzes = quizOutlineState.classId === classId ? quizOutlineState.quizzes : []
  const outlineQuizzesError = quizOutlineState.classId === classId ? quizOutlineState.error : ''
  const lessonTopics = materials
    .filter((material) => (material.category || 'lesson') === 'lesson')
    .sort((first, second) => (first.sequence || 0) - (second.sequence || 0))
  const topicProgress = lessonTopics.map((lesson, index) => {
    const sequence = lesson.sequence || index + 1
    return { lesson, sequence, quiz: outlineQuizzes.find((entry) => entry.sequence === sequence) }
  })
  const passedTopicCount = topicProgress.filter(({ quiz }) => quiz?.passed).length
  const nextTopic = topicProgress.find(({ quiz }) => !quiz?.passed)
  const learningProgress = lessonTopics.length ? Math.round((passedTopicCount / lessonTopics.length) * 100) : 0
  const tasks = tasksState.classId === classId ? tasksState.tasks : []
  const tasksError = tasksState.classId === classId ? tasksState.error : ''
  const tasksLoading = tasksState.classId !== classId
  const upcomingDeadline = getUpcomingDeadline(tasks)
  const upcomingDeadlineDate = upcomingDeadline ? new Date(upcomingDeadline.deadline) : null
  const upcomingDeadlineLabel = upcomingDeadlineDate ? getDeadlineDateLabel(upcomingDeadlineDate) : ''
  const isDeadlineSoon = upcomingDeadlineLabel === 'today' || upcomingDeadlineLabel === 'tomorrow'

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
        <div className="student-materials-layout">
          <div className="student-materials-main">
            {materialsLoading ? <div className="student-empty"><FolderOpen size={23} /><strong>Loading class materials…</strong></div> : materials.length === 0 ? <div className="student-empty"><FolderOpen size={24} /><strong>No class materials yet</strong><span>Your professor’s published files will appear here.</span></div> : <div className="student-materials-list">{materials.map((material) => {
              const locked = material.category === 'lesson' && material.unlocked === false
              return <article className={`student-material-row${locked ? ' student-material-row-locked' : ''}`} key={material._id}>
                <span className="student-material-icon">{locked ? <LockKeyhole size={18} /> : <FileText size={18} />}</span><div className="student-material-copy">{locked ? <strong>{material.title}</strong> : <Link to={`/student/classes/${classId}/materials/${material._id}`}>{material.title}</Link>}<span>{material.originalFileName} · {(material.fileSize / (1024 * 1024)).toFixed(1)} MB</span>{material.description && <small>{material.description}</small>}<div className="student-material-meta"><span className="student-material-category">{(material.category || 'lesson').replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>{material.category !== 'lesson' && <span className="student-material-points">{material.pointsPossible || 100} pts · 70% to pass</span>}{material.deadline && <span className="student-material-deadline">Due {new Date(material.deadline).toLocaleString()}</span>}</div>{locked ? <em>Locked · Pass {material.lockedBy} to open this lesson</em> : <em>Shared {new Date(material.availableAt).toLocaleDateString()}</em>}</div>
                {locked ? <span className="student-download-button student-material-locked-button">Locked</span> : <Link className="student-download-button student-preview-button" to={`/student/classes/${classId}/materials/${material._id}`}>Open material</Link>}
                <button className="student-download-button" type="button" disabled={locked || downloadingId === material._id} onClick={() => downloadMaterial(material._id)}><Download size={14} />{locked ? 'Locked' : downloadingId === material._id ? 'Preparing…' : 'Download'}</button>
              </article>
            })}</div>}
          </div>
          <aside className="student-learning-progress" aria-labelledby="student-learning-progress-heading">
            <div className="student-learning-progress-heading">
              <span className="student-eyebrow">YOUR PROGRESS</span>
              <h3 id="student-learning-progress-heading">Learning path</h3>
              <p>Pass each topic’s quiz to unlock what’s next.</p>
            </div>
            {outlineQuizzesError && <p className="student-alert" role="alert">{outlineQuizzesError}</p>}
            {materialsLoading || quizOutlineState.classId !== classId
              ? <p className="student-learning-progress-empty">Loading your progress…</p>
              : lessonTopics.length === 0
                ? <p className="student-learning-progress-empty">Your progress will appear once lessons are shared.</p>
                : <>
                  <div className="student-learning-progress-summary">
                    <div><strong>{passedTopicCount}<span> / {lessonTopics.length}</span></strong><small>quizzes passed</small></div>
                    <span className="student-learning-progress-percent">{learningProgress}%</span>
                  </div>
                  <div className="student-learning-progress-track" role="progressbar" aria-label="Course quiz progress" aria-valuenow={learningProgress} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${learningProgress}%` }} />
                  </div>
                  {nextTopic ? <div className="student-learning-next">
                    <span className="student-learning-next-label">UP NEXT · TOPIC {nextTopic.sequence}</span>
                    <strong>{nextTopic.lesson.title}</strong>
                    {nextTopic.quiz
                      ? nextTopic.quiz.unlocked
                        ? <button type="button" onClick={() => setActiveTab('quizzes')}><BookOpen size={14} />{nextTopic.quiz.attempt ? 'Retake quiz' : 'Take quiz'}<ArrowRight size={13} /></button>
                        : <span className="student-learning-next-locked"><LockKeyhole size={13} />Pass {nextTopic.quiz.lockedBy} to unlock</span>
                      : nextTopic.lesson.unlocked === false
                        ? <span className="student-learning-next-locked"><LockKeyhole size={13} />Pass {nextTopic.lesson.lockedBy} to unlock</span>
                        : <Link to={`/student/classes/${classId}/materials/${nextTopic.lesson._id}`}><FileText size={14} />Open lesson<ArrowRight size={13} /></Link>}
                  </div> : <div className="student-learning-complete"><CheckCircle2 size={17} /><span><strong>Course path complete</strong><small>You’ve passed every topic quiz.</small></span></div>}
                </>}
          </aside>
        </div>
      </section> : activeTab === 'quizzes' ? <StudentQuizSection classId={classId} /> : activeTab === 'practice' ? <StudentQuizSection classId={classId} practice /> : <>

      <section className="student-classroom-content">
        <div className="student-classroom-main">
          <article className="student-classroom-intro">
            <span className="student-classroom-intro-icon"><BookOpen size={20} /></span>
            <div className="student-classroom-intro-copy">
              <span className="student-eyebrow">CLASS OVERVIEW</span>
              <h2>{offering.subject?.name || 'Welcome to your class'}</h2>
              <p>{offering.subject?.description || 'Your class materials, schedule, and upcoming work are all in one place.'}</p>
            </div>
            <button type="button" className="student-open-materials" onClick={() => setActiveTab('materials')}>Browse materials <FolderOpen size={14} /></button>
          </article>

          <article className="student-classroom-schedule">
            <div className="student-classroom-panel-heading">
              <div><span className="student-classroom-panel-icon"><CalendarDays size={16} /></span><div><span className="student-eyebrow">PLAN YOUR WEEK</span><h2>Class schedule</h2></div></div>
              <span>{offering.schedule?.length || 0} {(offering.schedule?.length || 0) === 1 ? 'meeting' : 'meetings'}</span>
            </div>
            {offering.schedule?.length ? <div className="student-classroom-meetings">{offering.schedule.map((meeting, index) => <article key={`${meeting.day}-${meeting.startTime}-${index}`}>
              <strong>{meeting.day}</strong>
              <span><Clock3 size={14} />{formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}</span>
              <span>{meeting.room ? <><MapPin size={14} />{meeting.room}</> : 'Room not set'}</span>
            </article>)}</div> : <p className="student-classroom-no-meetings">No class meeting times have been added yet.</p>}
          </article>

          <article className="student-classroom-professor">
            <div className="student-classroom-professor-icon"><BookOpen size={16} /></div>
            <div><span className="student-eyebrow">YOUR PROFESSOR</span><strong>{offering.professor?.fullName || 'Professor'}</strong><p>{offering.professor?.department || offering.subject?.department || 'Course instructor'}</p></div>
            <div className="student-classroom-units"><span>SECTION</span><strong>{offering.section}</strong><small>{offering.subject?.units ?? '—'} units</small></div>
          </article>
        </div>

        <aside className="student-stream-sidebar">
          <article className="student-stream-sidecard student-class-task-card" aria-labelledby="student-class-task-heading">
            <div className="student-class-task-heading">
              <div><span className="student-eyebrow">ASSIGNMENTS & QUIZZES</span><h2 id="student-class-task-heading">Task list</h2></div>
              <span className="student-class-task-count">{tasksLoading || tasksError ? '—' : tasks.filter((task) => !task.completed).length}</span>
            </div>
            {!tasksLoading && !tasksError && upcomingDeadline && <div className="student-class-task-reminder" role="note">
              <CalendarDays size={15} />
              <span><small>REMINDER</small><strong>{isDeadlineSoon ? `Due ${upcomingDeadlineLabel}` : upcomingDeadlineLabel}</strong><span>{upcomingDeadline.title} · {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(upcomingDeadlineDate)}</span></span>
            </div>}
            {tasksError && <p className="student-class-task-error" role="alert">{tasksError}</p>}
            {tasksLoading ? <p className="student-class-task-empty">Loading class tasks…</p> : tasksError ? null : <>
              <div className="student-class-task-section">
                <h3>To accomplish <span>{tasks.filter((task) => !task.completed).length}</span></h3>
                {tasks.filter((task) => !task.completed).length ? <div className="student-class-task-list">{tasks.filter((task) => !task.completed).map((task) => {
                  const content = <>
                    <span className="student-class-task-checkbox" role="img" aria-label={`Not completed: ${task.title}`} />
                    <span className="student-class-task-copy"><strong>{task.title}</strong><small>{formatDeadline(task.deadline)}</small></span>
                    {task.locked ? <span className="student-class-task-locked">Locked · Pass {task.lockedBy}</span> : task.overdue ? <span className="student-class-task-overdue">Overdue</span> : <ArrowRight className="student-class-task-open-icon" size={13} />}
                  </>
                  return task.type === 'quiz'
                    ? <button className={`student-class-task-item${task.overdue && !task.locked ? ' overdue' : ''}`} type="button" disabled={task.locked} onClick={() => setActiveTab('quizzes')} key={`${task.type}-${task.id}`}>{content}</button>
                    : <Link className={`student-class-task-item${task.overdue ? ' overdue' : ''}`} to={`/student/classes/${classId}/materials/${task.id}`} key={`${task.type}-${task.id}`}>{content}</Link>
                })}</div> : <p className="student-class-task-empty"><CheckCircle2 size={15} />You’re all caught up in this class.</p>}
              </div>
              <div className="student-class-task-section completed">
                <h3>Completed <span>{tasks.filter((task) => task.completed).length}</span></h3>
                {tasks.filter((task) => task.completed).length ? <div className="student-class-task-list">{tasks.filter((task) => task.completed).map((task) => {
                  const content = <>
                    <span className="student-class-task-checkbox checked" role="img" aria-label={`Completed: ${task.title}`} />
                    <span className="student-class-task-copy"><strong>{task.title}</strong><small>{task.type === 'quiz' ? 'Quiz submitted' : 'Work submitted'} · {formatDeadline(task.deadline)}</small></span>
                  </>
                  return task.type === 'quiz'
                    ? <button className="student-class-task-item done" type="button" onClick={() => setActiveTab('quizzes')} key={`${task.type}-${task.id}`}>{content}</button>
                    : <Link className="student-class-task-item done" to={`/student/classes/${classId}/materials/${task.id}`} key={`${task.type}-${task.id}`}>{content}</Link>
                })}</div> : <p className="student-class-task-empty">Submitted work will appear here.</p>}
              </div>
            </>}
          </article>
        </aside>
      </section>
      </>}
    </main>
  )
}
