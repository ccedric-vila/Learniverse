import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, CircleUserRound, Filter, GraduationCap, Plus, RefreshCw, Search, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, useAuth } from '../auth/AuthContext'
import './admin.css'

const DEPARTMENT_SHORT = {
  'Department of Engineering': 'Engineering',
  'Department of Engineering Technology': 'Engineering Technology',
  'Department of Information Technology and Computer Studies': 'IT & Computer Studies',
  'Department of Industrial Education (Technical Teacher Education)': 'Industrial Education',
  'Department of Mathematics and Sciences': 'Mathematics and Sciences',
  'Department of Liberal Arts and Humanities': 'Liberal Arts and Humanities',
  'Department of Physical Education and NSTP': 'Physical Education and NSTP',
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState({ stats: { professors: 0, students: 0, inactiveAccounts: 0 }, professors: [] })
  const [activeTab, setActiveTab] = useState('overview')
  const [professors, setProfessors] = useState([])
  const [professorsLoading, setProfessorsLoading] = useState(false)
  const [professorsLoaded, setProfessorsLoaded] = useState(false)
  const [professorsError, setProfessorsError] = useState('')
  const [professorSearch, setProfessorSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get('/admin/dashboard')
      .then(({ data }) => { if (active) setDashboard(data) })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load admin dashboard.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (activeTab !== 'professors' || professorsLoaded) return undefined
    let active = true
    api.get('/admin/professors?status=all')
      .then(({ data }) => {
        if (active) {
          setProfessors(data.professors)
          setProfessorsError('')
          setProfessorsLoaded(true)
        }
      })
      .catch((requestError) => {
        if (active) setProfessorsError(requestError.response?.data?.message || 'Could not load professor accounts.')
      })
      .finally(() => { if (active) setProfessorsLoading(false) })
    return () => { active = false }
  }, [activeTab, professorsLoaded])

  const departments = useMemo(
    () => [...new Set(professors.map((professor) => professor.department).filter(Boolean))].sort(),
    [professors],
  )
  const filteredProfessors = useMemo(() => {
    const query = professorSearch.trim().toLowerCase()
    return professors.filter((professor) => {
      const matchesDepartment = departmentFilter === 'all' || professor.department === departmentFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? professor.isActive : !professor.isActive)
      const matchesSearch = !query || [professor.fullName, professor.email, professor.phone, professor.department]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesDepartment && matchesStatus && matchesSearch
    })
  }, [departmentFilter, professorSearch, professors, statusFilter])

  function showProfessors() {
    if (!professorsLoaded) {
      setProfessorsError('')
      setProfessorsLoading(true)
    }
    setActiveTab('professors')
  }

  async function refreshDashboard() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/admin/dashboard')
      setDashboard(data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not refresh admin dashboard.')
    } finally {
      setLoading(false)
    }
  }

  function showActiveProfessors() {
    setStatusFilter('active')
    showProfessors()
  }

  return (
    <main className="admin-page admin-dashboard-page">
      <section className="admin-welcome">
        <div>
          <span className="admin-eyebrow"><span className="admin-live-dot" /> ADMIN WORKSPACE</span>
          <h1>Good day, {user?.fullName?.split(' ')[0] || 'Admin'}</h1>
          <p>Your campus at a glance. Manage the academic catalog, class assignments, and teaching team from one place.</p>
        </div>
        <div className="admin-welcome-actions"><button className="admin-secondary-button admin-refresh-button" type="button" onClick={refreshDashboard} disabled={loading}><RefreshCw size={15} className={loading ? 'admin-refresh-icon spinning' : 'admin-refresh-icon'} />{loading ? 'Updating…' : 'Refresh overview'}</button></div>
      </section>

      <nav className="admin-dashboard-tabs" aria-label="Admin dashboard sections" role="tablist">
        <button id="admin-overview-tab" role="tab" aria-selected={activeTab === 'overview'} aria-controls="admin-overview-panel" className={activeTab === 'overview' ? 'active' : ''} type="button" onClick={() => setActiveTab('overview')}><BookOpen size={15} />Overview</button>
        <button id="admin-professors-tab" role="tab" aria-selected={activeTab === 'professors'} aria-controls="admin-professors-panel" className={activeTab === 'professors' ? 'active' : ''} type="button" onClick={showProfessors}><UsersRound size={15} />Professors</button>
      </nav>

      {activeTab === 'overview' ? <div id="admin-overview-panel" role="tabpanel" aria-labelledby="admin-overview-tab">
        <section className="admin-overview-heading">
          <div><span className="admin-eyebrow">CAMPUS SNAPSHOT</span><h2>At a glance</h2><p>A quick summary of accounts across your campus.</p></div>
          <span className="admin-overview-mark"><GraduationCap size={20} /> TUP Taguig</span>
        </section>
        <section className="admin-stat-grid" aria-label="Account totals">
          <button className="admin-stat professor-stat admin-stat-action" type="button" onClick={showActiveProfessors} aria-label={`View ${dashboard.stats.professors} active professors`}><span className="admin-stat-icon"><CircleUserRound size={18} /></span><span>Active professors</span><strong>{loading ? '—' : dashboard.stats.professors}</strong><small>Teaching accounts <span className="admin-stat-hint">View directory <ArrowRight size={12} /></span></small></button>
          <article className="admin-stat student-stat"><span className="admin-stat-icon mint"><UsersRound size={18} /></span><span>Active students</span><strong>{loading ? '—' : dashboard.stats.students}</strong><small>Learner accounts</small></article>
          <article className="admin-stat inactive-stat"><span className="admin-stat-icon gold"><BookOpen size={18} /></span><span>Inactive accounts</span><strong>{loading ? '—' : dashboard.stats.inactiveAccounts}</strong><small>Across all roles</small></article>
        </section>

        <section className="admin-quick-actions" aria-labelledby="admin-quick-actions-heading">
          <div className="admin-section-heading"><div><span className="admin-eyebrow">GET THINGS DONE</span><h2 id="admin-quick-actions-heading">Quick actions</h2></div><p>Jump directly to a common task.</p></div>
          <div className="admin-action-grid">
            <Link className="admin-action-card subjects" to="/admin/subjects"><span className="admin-action-icon"><BookOpen size={19} /></span><span className="admin-action-copy"><strong>Manage subjects</strong><small>Update the curriculum catalog</small></span><ArrowRight size={16} className="admin-action-arrow" /></Link>
            <Link className="admin-action-card classes" to="/admin/classes"><span className="admin-action-icon"><CalendarDays size={19} /></span><span className="admin-action-copy"><strong>Manage classes</strong><small>Assign professors and schedules</small></span><ArrowRight size={16} className="admin-action-arrow" /></Link>
            <Link className="admin-action-card professors" to="/admin/professors/new"><span className="admin-action-icon"><Plus size={19} /></span><span className="admin-action-copy"><strong>Create professor</strong><small>Add a teaching team account</small></span><ArrowRight size={16} className="admin-action-arrow" /></Link>
          </div>
        </section>

        <section className="admin-panel admin-recent-panel">
          <div className="admin-panel-heading"><div><span className="admin-eyebrow">TEACHING TEAM</span><h2>Recently added professors</h2></div><button className="admin-view-link admin-tab-link" type="button" onClick={showProfessors}>View all professors <ArrowRight size={15} /></button></div>
          {error && <p className="admin-alert" role="alert">{error}</p>}
          {loading ? <p className="admin-empty">Loading professor accounts…</p> : dashboard.professors.length === 0 ? <div className="admin-empty"><CircleUserRound size={28} /><strong>No professors yet</strong><span>Create an account to add your first professor to the team.</span><Link to="/admin/professors/new">Create professor account</Link></div> : (
            <div className="professor-table-wrap"><table className="professor-table"><thead><tr><th>Professor</th><th>Department</th><th>Phone</th><th>Status</th></tr></thead><tbody>{dashboard.professors.map((professor) => <tr key={professor._id}><td><div className="professor-name"><span className="professor-avatar">{professor.fullName?.charAt(0)?.toUpperCase()}</span><span><strong>{professor.fullName}</strong><small>{professor.email}</small></span></div></td><td>{DEPARTMENT_SHORT[professor.department] || professor.department || '—'}</td><td>{professor.phone || '—'}</td><td><span className={`account-status ${professor.isActive ? 'active' : 'inactive'}`}>{professor.isActive ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div>
          )}
        </section>
        <p className="admin-security-note">Professor accounts are created by an administrator. Share their temporary password with them privately.</p>
      </div> : <section id="admin-professors-panel" className="admin-panel admin-professors-panel" role="tabpanel" aria-labelledby="admin-professors-tab">
        <div className="admin-panel-heading"><div><span className="admin-eyebrow">TEACHING TEAM</span><h2>Professor directory</h2></div><Link className="admin-primary-button" to="/admin/professors/new"><Plus size={16} />Create professor</Link></div>
        {professorsError && <p className="admin-alert" role="alert">{professorsError}</p>}
        <div className="admin-professor-filters">
          <label className="subject-search-field"><Search size={15} /><input type="search" value={professorSearch} onChange={(event) => setProfessorSearch(event.target.value)} placeholder="Search name, email, phone…" aria-label="Search professors" /></label>
          <label className="admin-professor-filter"><Filter size={14} /><span className="sr-only">Filter by department</span><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter by department"><option value="all">All departments</option>{departments.map((department) => <option key={department} value={department}>{DEPARTMENT_SHORT[department] || department}</option>)}</select></label>
          <label className="admin-professor-filter"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <span className="admin-professor-count">{professorsLoading ? 'Loading…' : `${filteredProfessors.length} of ${professors.length} professors`}</span>
        </div>
        {professorsLoading ? <p className="admin-empty">Loading professor directory…</p> : professors.length === 0 && !professorsError ? <div className="admin-empty"><CircleUserRound size={28} /><strong>No professors yet</strong><span>Create an account to add your first professor to the team.</span><Link to="/admin/professors/new">Create professor account</Link></div> : filteredProfessors.length === 0 && !professorsError ? <p className="admin-empty">No professors match these filters.</p> : (
          <div className="professor-table-wrap"><table className="professor-table"><thead><tr><th>Professor</th><th>Department</th><th>Phone</th><th>Status</th></tr></thead><tbody>{filteredProfessors.map((professor) => <tr key={professor._id}><td><div className="professor-name"><span className="professor-avatar">{professor.fullName?.charAt(0)?.toUpperCase()}</span><span><strong>{professor.fullName}</strong><small>{professor.email}</small></span></div></td><td>{DEPARTMENT_SHORT[professor.department] || professor.department || '—'}</td><td>{professor.phone || '—'}</td><td><span className={`account-status ${professor.isActive ? 'active' : 'inactive'}`}>{professor.isActive ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div>
        )}
      </section>}
    </main>
  )
}
