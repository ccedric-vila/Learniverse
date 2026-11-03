import { useEffect, useRef, useState } from 'react'
import { LogOut, X } from 'lucide-react'

export default function ProfessorSignOutConfirmation({ onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    dialogRef.current?.querySelector('.professor-signout-cancel')?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSubmitting) onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, onCancel])

  function confirmSignOut() {
    if (isSubmitting) return
    setIsSubmitting(true)
    onConfirm()
  }

  return (
    <div
      className="professor-signout-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        className="professor-signout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="professor-signout-title"
        aria-describedby="professor-signout-description"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const focusable = event.currentTarget.querySelectorAll('button:not(:disabled)')
          if (!focusable.length) return
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        <button
          className="professor-signout-close"
          type="button"
          onClick={onCancel}
          aria-label="Close sign out confirmation"
          disabled={isSubmitting}
        >
          <X size={17} />
        </button>
        <span className="professor-signout-icon" aria-hidden="true"><LogOut size={21} /></span>
        <h2 id="professor-signout-title">Sign out?</h2>
        <p id="professor-signout-description">Are you sure you want to sign out of your Learniverse account?</p>
        <div className="professor-signout-actions">
          <button
            className="professor-signout-cancel"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="professor-signout-confirm"
            type="button"
            onClick={confirmSignOut}
            disabled={isSubmitting}
          >
            <LogOut size={15} />
            {isSubmitting ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </section>
    </div>
  )
}
