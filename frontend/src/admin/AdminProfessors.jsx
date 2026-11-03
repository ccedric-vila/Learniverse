import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CircleUserRound, Filter, Plus, RefreshCw, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../auth/AuthContext'
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
const PROFESSOR_STATUSES = ['all', 'active', 'inactive']

export default function AdminProfessors() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')
  const statusFilter = PROFESSOR_STATUSES.includes(requestedStatus) ? requestedStatus : 'all'
  const departmentFilter = searchParams.get('department') || 'all'
  const [professors, setProfessors] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    api.get('/admin/professors?status=all')
      .then(({ data }) => {
        if (active) setProfessors(data.professors)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load professor accounts.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [reload])

  const departments = useMemo(
    () => [...new Set(professors.map((professor) => professor.department).filter(Boolean))].sort(),
    [professors],
  )
  const filteredProfessors = useMemo(() => {
    const query = search.trim().toLowerCase()
    return professors.filter((professor) => {
      const matchesDepartment = departmentFilter === 'all' || professor.department === departmentFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? professor.isActive : !professor.isActive)
      const matchesSearch = !query || [professor.fullName, professor.email, professor.phone, professor.department]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesDepartment && matchesStatus && matchesSearch
    })
  }, [departmentFilter, professors, search, statusFilter])

  function updateFilter(name, value) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (!value || value === 'all') next.delete(name)
      else next.set(name, value)
      return next
    }, { replace: true })
  }

  return (
    <main className="admin-page admin-professors-page">
      <Link className="admin-back-link" to="/admin"><ArrowLeft size={16} /> Back to dashboard</Link>
      <section className="admin-directory-heading">
        <div className="professor-form-heading">
          <span className="admin-eyebrow">ADMINISTRATION · TEACHING TEAM</span>
          <h1>Professor directory</h1>
          <p>Browse professor accounts and filter the list by department, status, or search.</p>
        </div>
        <Link className="admin-primary-button" to="/admin/professors/new"><Plus size={16} />Create professor</Link>
      </section>

      <section className="admin-panel admin-professors-panel" aria-label="Professor directory">
        <div className="admin-panel-heading">
          <div><span className="admin-eyebrow">TEACHING TEAM</span><h2>All professors</h2></div>
          <span className="record-count">{loading ? 'Loading…' : `${filteredProfessors.length} of ${professors.length} professors`}</span>
        </div>
        <div className="admin-professor-filters">
          <label className="subject-search-field"><Search size={15} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone…" aria-label="Search professors" /></label>
          <label className="admin-professor-filter"><Filter size={14} /><span className="sr-only">Filter by department</span><select value={departmentFilter} onChange={(event) => updateFilter('department', event.target.value)} aria-label="Filter by department"><option value="all">All departments</option>{departments.map((department) => <option key={department} value={department}>{DEPARTMENT_SHORT[department] || department}</option>)}</select></label>
          <label className="admin-professor-filter"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => updateFilter('status', event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>

        {error ? (
          <div className="admin-directory-error" role="alert">
            <p>{error}</p>
            <button className="admin-secondary-button" type="button" onClick={() => { setLoading(true); setError(''); setReload((current) => current + 1) }} disabled={loading}><RefreshCw size={14} />Try again</button>
          </div>
        ) : loading ? (
          <p className="admin-empty">Loading professor directory…</p>
        ) : professors.length === 0 ? (
          <div className="admin-empty"><CircleUserRound size={28} /><strong>No professors yet</strong><span>Create an account to add your first professor to the team.</span><Link to="/admin/professors/new">Create professor account</Link></div>
        ) : filteredProfessors.length === 0 ? (
          <p className="admin-empty">No professors match these filters.</p>
        ) : (
          <div className="professor-table-wrap"><table className="professor-table"><thead><tr><th>Professor</th><th>Department</th><th>Phone</th><th>Status</th></tr></thead><tbody>{filteredProfessors.map((professor) => <tr key={professor._id}><td><div className="professor-name"><span className="professor-avatar">{professor.fullName?.charAt(0)?.toUpperCase()}</span><span><strong>{professor.fullName}</strong><small>{professor.email}</small></span></div></td><td>{DEPARTMENT_SHORT[professor.department] || professor.department || '—'}</td><td>{professor.phone || '—'}</td><td><span className={`account-status ${professor.isActive ? 'active' : 'inactive'}`}>{professor.isActive ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div>
        )}
      </section>
      <p className="admin-security-note">Professor accounts are created by an administrator. Share their temporary password with them privately.</p>
    </main>
  )
}
