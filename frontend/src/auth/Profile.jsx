import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, Pencil, Save, Trash2, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, useAuth } from './AuthContext'
import './profile.css'

const STANDARD_YEAR_LEVELS = ['1st year', '2nd year', '3rd year', '4th year']

function profileFormFromUser(user) {
  const yearLevel = user?.yearLevel || ''
  return {
    fullName: user?.fullName || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    birthdate: user?.birthdate ? new Date(user.birthdate).toISOString().slice(0, 10) : '',
    profileImage: user?.profileImage || '',
    department: user?.department || '',
    courseProgram: user?.courseProgram || '',
    yearLevel: STANDARD_YEAR_LEVELS.includes(yearLevel) ? yearLevel : yearLevel ? 'Other' : '',
    yearLevelOther: yearLevel && !STANDARD_YEAR_LEVELS.includes(yearLevel) ? yearLevel : '',
    section: user?.section || '',
  }
}

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const imageInput = useRef(null)
  const imagePreviewDialog = useRef(null)
  const [form, setForm] = useState(() => profileFormFromUser(user))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [profileOptions, setProfileOptions] = useState({ departments: [], courseProgramGroups: [] })

  useEffect(() => {
    if (user?.role !== 'STUDENT') return
    let active = true
    api.get('/student/profile-options')
      .then(({ data }) => {
        if (active) setProfileOptions(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load department and course options.')
      })
    return () => { active = false }
  }, [user?.role])

  useEffect(() => {
    const dialog = imagePreviewDialog.current
    if (!dialog) return
    if (isImagePreviewOpen && !dialog.open) dialog.showModal()
    if (!isImagePreviewOpen && dialog.open) dialog.close()
  }, [isImagePreviewOpen])

  useEffect(() => {
    setForm(profileFormFromUser(user))
  }, [user])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'department' ? { courseProgram: '' } : {}),
    }))
    setError('')
    setNotice('')
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile images must be 5 MB or smaller.')
      return
    }

    setError('')
    setNotice('')
    setUploadingImage(true)
    try {
      const payload = new FormData()
      payload.append('image', file)
      const { data } = await api.post('/auth/profile-image', payload)
      setForm((current) => ({ ...current, profileImage: data.image.url }))
      setNotice('Image uploaded. Save changes to apply it to your profile.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not upload your profile image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const { yearLevelOther, ...profile } = form
      await updateProfile({
        ...profile,
        yearLevel: form.yearLevel === 'Other' ? yearLevelOther.trim() : form.yearLevel,
      })
      setNotice('Your profile was updated successfully.')
      setIsEditing(false)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function cancelEditing() {
    setForm(profileFormFromUser(user))
    setError('')
    setNotice('')
    setIsEditing(false)
  }

  return (
    <main className="profile-page">
      <Link className="profile-back-link" to={user?.role === 'PROFESSOR' ? '/professor' : '/student'}><ArrowLeft size={15} /> Back to dashboard</Link>
      <section className="profile-card">
        <header className="profile-heading">
          <span className="profile-icon"><UserRound size={22} /></span>
          <div><span className="profile-eyebrow">ACCOUNT</span><h1>Profile</h1><p>View and manage your personal details.</p></div>
        </header>
        <section className="profile-summary" aria-label="Profile summary">
          <div className="profile-summary-portrait">
            <button
              type="button"
              className="profile-summary-image"
              aria-label={form.profileImage ? 'View profile picture' : 'No profile picture'}
              disabled={!form.profileImage}
              onClick={() => setIsImagePreviewOpen(true)}
            >
              {form.profileImage ? <img src={form.profileImage} alt={`${form.fullName || 'Your'} profile`} /> : <UserRound size={40} />}
            </button>
            <span className="profile-role-badge">{user?.role === 'PROFESSOR' ? 'Professor account' : 'Student account'}</span>
            {isEditing && <div className="profile-summary-actions">
              <button type="button" className="profile-summary-upload" onClick={() => imageInput.current?.click()} disabled={uploadingImage}>
                <ImagePlus size={14} />{uploadingImage ? 'Uploading…' : form.profileImage ? 'Change photo' : 'Upload photo'}
              </button>
              {form.profileImage && <button type="button" className="profile-summary-remove" onClick={() => setForm((current) => ({ ...current, profileImage: '' }))}><Trash2 size={13} /> Remove</button>}
            </div>}
          </div>
          <div className="profile-summary-copy">
            <h2>{form.fullName.trim() || 'Your full name'}</h2>
            <dl className="profile-summary-details">
              <div><dt>Username</dt><dd>{form.username || 'Not provided'}</dd></div>
              <div><dt>Email</dt><dd>{form.email || 'Not provided'}</dd></div>
              <div><dt>Phone number</dt><dd>{form.phone || 'Not provided'}</dd></div>
              <div><dt>Birthdate</dt><dd>{form.birthdate || 'Not provided'}</dd></div>
              {user?.role === 'STUDENT' && <>
                <div><dt>Department</dt><dd>{form.department || 'Not provided'}</dd></div>
                <div><dt>Course</dt><dd>{form.courseProgram || 'Not provided'}</dd></div>
                <div><dt>Year level</dt><dd>{form.yearLevel === 'Other' ? form.yearLevelOther || 'Other' : form.yearLevel || 'Not provided'}</dd></div>
                <div><dt>Section</dt><dd>{form.section || 'Not provided'}</dd></div>
              </>}
              <div><dt>Account type</dt><dd>{user?.role === 'PROFESSOR' ? 'Professor' : 'Student'}</dd></div>
            </dl>
            <button type="button" className="profile-summary-toggle" aria-expanded={isEditing} aria-controls="profile-edit-form" onClick={() => {
              if (isEditing) cancelEditing()
              else { setError(''); setNotice(''); setIsEditing(true) }
            }}>
              {isEditing ? <><X size={14} /> Preview profile</> : <><Pencil size={14} /> Edit profile</>}
            </button>
          </div>
          <input ref={imageInput} className="profile-image-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
        </section>
        {!isEditing && notice && <p className="profile-message profile-success profile-preview-message" role="status">{notice}</p>}
        <dialog
          ref={imagePreviewDialog}
          className="profile-image-dialog"
          aria-label="Profile picture preview"
          onCancel={(event) => { event.preventDefault(); setIsImagePreviewOpen(false) }}
          onClose={() => setIsImagePreviewOpen(false)}
          onClick={(event) => { if (event.target === event.currentTarget) setIsImagePreviewOpen(false) }}
        >
          <button type="button" className="profile-image-dialog-close" aria-label="Close image preview" onClick={() => setIsImagePreviewOpen(false)}><X size={20} /></button>
          {form.profileImage && <img src={form.profileImage} alt={`${form.fullName || 'Profile'} full-size profile`} />}
          <div className="profile-image-dialog-caption"><strong>{form.fullName || 'Profile picture'}</strong><span>Profile photo</span></div>
        </dialog>
        <form id="profile-edit-form" className="profile-form" hidden={!isEditing} onSubmit={handleSubmit}>
          {error && <p className="profile-message profile-error" role="alert">{error}</p>}
          {notice && <p className="profile-message profile-success" role="status">{notice}</p>}
          <div className="profile-fields">
            <label className="profile-field"><span>Username</span><input name="username" autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]{3,30}" title="Use 3–30 letters, numbers, dots, underscores, or hyphens." required value={form.username} onChange={updateField} placeholder="e.g. alex.santos" /></label>
            <label className="profile-field"><span>Full name</span><input name="fullName" autoComplete="name" maxLength={150} required value={form.fullName} onChange={updateField} /></label>
            <label className="profile-field"><span>Email address</span><input name="email" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={updateField} /></label>
            <label className="profile-field"><span>Phone number <small>Optional</small></span><input name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={updateField} placeholder="Add a contact number" /></label>
            <label className="profile-field"><span>Birthdate <small>Optional</small></span><input name="birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={updateField} /></label>
            {user?.role === 'STUDENT' && <>
              <label className="profile-field"><span>Department</span><select name="department" value={form.department} onChange={updateField}><option value="">Select a department</option>{profileOptions.departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
              <label className="profile-field"><span>Course program</span><select name="courseProgram" value={form.courseProgram} onChange={updateField} disabled={!form.department}><option value="">Select a course</option>{profileOptions.courseProgramGroups.map((group) => {
                const programs = group.programs.filter((program) => program.department === form.department)
                return programs.length ? <optgroup key={group.label} label={group.label}>{programs.map((program) => <option key={program.name} value={program.name}>{program.name}</option>)}</optgroup> : null
              })}</select></label>
              <label className="profile-field"><span>Year level</span><select name="yearLevel" value={form.yearLevel} onChange={updateField}><option value="">Select a year level</option>{STANDARD_YEAR_LEVELS.map((yearLevel) => <option key={yearLevel} value={yearLevel}>{yearLevel}</option>)}<option value="Other">Other</option></select></label>
              {form.yearLevel === 'Other' && <label className="profile-field"><span>Specify year level</span><input name="yearLevelOther" maxLength={50} required value={form.yearLevelOther} onChange={updateField} placeholder="Enter your year level" /></label>}
              <label className="profile-field"><span>Section</span><input name="section" maxLength={30} value={form.section} onChange={updateField} placeholder="Enter your section" /></label>
            </>}
          </div>
          {user?.role === 'PROFESSOR' && user.department && <p className="profile-managed-note">Department: <strong>{user.department}</strong> · Managed by your administrator</p>}
          <div className="profile-form-footer"><button type="button" className="profile-cancel-button" onClick={cancelEditing} disabled={saving}>Cancel</button><button type="submit" disabled={saving}><Save size={16} />{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </section>
    </main>
  )
}
