import { useEffect, useRef, useState } from 'react'
import { ArrowRight, KeyRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../auth/AuthContext'
import './student.css'

export default function JoinClass({ onClose }) {
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const [classCode, setClassCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/student/classes/join', { classCode })
      navigate(`/student/classes/${data.offering._id}`, { replace: true, state: { notice: data.message } })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not join that class. Check the code and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCodeChange(event) {
    const normalized = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    setClassCode(normalized.length > 4 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized)
  }

  return (
    <dialog
      ref={dialogRef}
      className="student-join-dialog"
      aria-labelledby="student-join-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section className="student-join-card">
        <button className="student-join-close" type="button" onClick={onClose} aria-label="Close join class form"><X size={19} /></button>
        <span className="student-join-icon"><KeyRound size={22} /></span>
        <span className="student-eyebrow">CLASS ENROLLMENT</span>
        <h1 id="student-join-title">Join a class</h1>
        <p>Enter the class code shared by your professor to see the class and its schedule.</p>
        {error && <p className="student-alert" role="alert">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="class-code">Class code</label>
          <input id="class-code" autoFocus autoComplete="off" autoCapitalize="characters" maxLength="9" placeholder="ABCD-EFGH" value={classCode} onChange={handleCodeChange} required />
          <small>Class codes contain 8 letters or numbers, excluding confusing characters.</small>
          <button className="student-primary-button" type="submit" disabled={submitting || classCode.replace('-', '').length !== 8}>{submitting ? 'Joining…' : 'Join class'} <ArrowRight size={16} /></button>
        </form>
      </section>
    </dialog>
  )
}
