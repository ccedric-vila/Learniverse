import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, ImagePlus, UserPlus, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import './admin.css'

const DEPARTMENTS = [
  'Department of Engineering',
  'Department of Engineering Technology',
  'Department of Information Technology and Computer Studies',
  'Department of Industrial Education (Technical Teacher Education)',
  'Department of Mathematics and Sciences',
  'Department of Liberal Arts and Humanities',
  'Department of Physical Education and NSTP',
]

const initialForm = { fullName: '', username: '', email: '', password: '', department: '', phone: '', birthdate: '', profileImage: '' }

export default function CreateProfessor() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [createdEmail, setCreatedEmail] = useState('')
  const [createdUsername, setCreatedUsername] = useState('')
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function uploadProfileImage(event) {
    const imageFile = event.target.files?.[0]
    event.target.value = ''
    if (!imageFile) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (imageFile.size > 5 * 1024 * 1024) {
      setError('Profile image must be 5 MB or smaller.')
      return
    }

    setError('')
    setImagePreview(URL.createObjectURL(imageFile))
    setUploadingImage(true)
    try {
      const payload = new FormData()
      payload.append('image', imageFile)
      const { data } = await api.post('/admin/professors/profile-image', payload)
      setForm((current) => ({ ...current, profileImage: data.image.url }))
      setImagePreview(data.image.url)
    } catch (requestError) {
      setImagePreview('')
      setError(requestError.response?.data?.message || 'Could not upload the profile image.')
    } finally {
      setUploadingImage(false)
    }
  }

  function removeProfileImage() {
    setImagePreview('')
    setForm((current) => ({ ...current, profileImage: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/admin/professors', {
        ...form,
        birthdate: form.birthdate || undefined,
        profileImage: form.profileImage.trim(),
      })
      setCreatedEmail(data.professor.email)
      setCreatedUsername(data.professor.username)
      setForm(initialForm)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create professor account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-page professor-form-page">
      <Link className="admin-back-link" to="/admin"><ArrowLeft size={16} /> Back to dashboard</Link>
      <section className="professor-form-heading"><span className="admin-eyebrow">ADMINISTRATION · TEACHING TEAM</span><h1>Create professor account</h1><p>Add a professor to STS LMS. Their role will be set to Professor automatically.</p></section>

      {createdEmail && <div className="admin-success" role="status"><CheckCircle2 size={20} /><span><strong>Professor account created.</strong> The account for {createdEmail} (@{createdUsername}) is ready. Share its temporary password privately.</span><button type="button" onClick={() => { setCreatedEmail(''); setCreatedUsername('') }}>Dismiss</button></div>}
      {error && <p className="admin-alert" role="alert">{error}</p>}

      <form className="professor-form" onSubmit={handleSubmit}>
        <div className="form-section-title"><span className="form-section-icon"><UserPlus size={18} /></span><div><h2>Account information</h2><p>Required details for the professor’s account.</p></div></div>
        <div className="form-grid">
          <label className="admin-field"><span>Full name <b>*</b></span><input name="fullName" autoComplete="name" maxLength={150} required value={form.fullName} onChange={update} placeholder="e.g. Dr. Maria Santos" /></label>
          <label className="admin-field"><span>Username <b>*</b></span><input name="username" autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]{3,30}" title="Use 3–30 letters, numbers, dots, underscores, or hyphens." required value={form.username} onChange={update} placeholder="e.g. maria.santos" /><small>Must be unique · used to sign in</small></label>
          <label className="admin-field"><span>Email address <b>*</b></span><input name="email" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={update} placeholder="professor@school.edu" /></label>
          <label className="admin-field"><span>Temporary password <b>*</b></span><span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={form.password} onChange={update} placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small>Share this password with the professor through a private channel.</small></label>
          <label className="admin-field"><span>Department <b>*</b></span><select name="department" required value={form.department} onChange={update}><option value="">Select a department</option>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
          <label className="admin-field"><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={update} placeholder="e.g. +63 912 345 6789" /></label>
          <label className="admin-field"><span>Birthdate</span><input name="birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={update} /></label>
          <div className="admin-field full-width"><span>Profile image <small>Optional · securely uploaded to Cloudinary</small></span><div className="image-upload-row"><label className="image-upload-control"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProfileImage} disabled={uploadingImage || submitting} /><span className="image-upload-button"><ImagePlus size={17} /> {uploadingImage ? 'Uploading image…' : imagePreview ? 'Choose a different image' : 'Upload image'}</span></label><span className="image-upload-hint">JPG, PNG, or WebP · up to 5 MB</span></div>{imagePreview && <div className="image-preview"><img src={imagePreview} alt="Professor profile preview" /><span>{uploadingImage ? 'Uploading to Cloudinary…' : 'Image uploaded to Cloudinary'}</span><button type="button" onClick={removeProfileImage} disabled={uploadingImage} aria-label="Remove profile image"><X size={16} /></button></div>}</div>
        </div>
        <div className="professor-form-actions"><button className="admin-cancel-button" type="button" onClick={() => navigate('/admin')}>Cancel</button><button className="admin-primary-button" type="submit" disabled={submitting || uploadingImage}>{submitting ? 'Creating account…' : <><UserPlus size={17} /> Create professor account</>}</button></div>
      </form>
      <p className="admin-security-note">The password is securely hashed before storage. It is never returned by the API.</p>
    </main>
  )
}
