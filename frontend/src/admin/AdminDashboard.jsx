import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, CircleUserRound, GraduationCap, Plus, RefreshCw, UsersRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState({ stats: { professors: 0, students: 0, inactiveAccounts: 0 }, professors: [] })
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
    navigate('/admin/professors?status=active')
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

      <div>
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
          <div className="admin-panel-heading"><div><span className="admin-eyebrow">TEACHING TEAM</span><h2>Recently added professors</h2></div><Link className="admin-view-link" to="/admin/professors">View all professors <ArrowRight size={15} /></Link></div>
          {error && <p className="admin-alert" role="alert">{error}</p>}
          {loading ? <p className="admin-empty">Loading professor accounts…</p> : dashboard.professors.length === 0 ? <div className="admin-empty"><CircleUserRound size={28} /><strong>No professors yet</strong><span>Create an account to add your first professor to the team.</span><Link to="/admin/professors/new">Create professor account</Link></div> : (
            <div className="professor-table-wrap"><table className="professor-table"><thead><tr><th>Professor</th><th>Department</th><th>Phone</th><th>Status</th></tr></thead><tbody>{dashboard.professors.map((professor) => <tr key={professor._id}><td><div className="professor-name"><span className="professor-avatar">{professor.fullName?.charAt(0)?.toUpperCase()}</span><span><strong>{professor.fullName}</strong><small>{professor.email}</small></span></div></td><td>{DEPARTMENT_SHORT[professor.department] || professor.department || '—'}</td><td>{professor.phone || '—'}</td><td><span className={`account-status ${professor.isActive ? 'active' : 'inactive'}`}>{professor.isActive ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div>
          )}
        </section>
        <p className="admin-security-note">Professor accounts are created by an administrator. Share their temporary password with them privately.</p>
      </div>
    </main>
  )
}
