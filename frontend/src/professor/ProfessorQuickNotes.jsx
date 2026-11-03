import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Plus, Search, Trash2, X } from 'lucide-react'

function readNotes(storageKey) {
  try {
    const storedValue = localStorage.getItem(storageKey)
    if (!storedValue) return { notes: [], error: '' }

    const value = JSON.parse(storedValue)
    if (!Array.isArray(value)) return { notes: [], error: 'Saved notes could not be read. New changes will be saved locally.' }

    return {
      notes: value.filter((note) => (
        note
        && typeof note.id === 'string'
        && typeof note.title === 'string'
        && typeof note.content === 'string'
      )),
      error: '',
    }
  } catch {
    return { notes: [], error: 'Saved notes could not be read. New changes will be saved locally.' }
  }
}

function createNote() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: 'Untitled note',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function formatUpdatedDate(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Saved note'
  return `Edited ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)}`
}

export default function ProfessorQuickNotes({ storageKey, onClose }) {
  const dialogRef = useRef(null)
  const [initialNotes] = useState(() => readNotes(storageKey))
  const [notes, setNotes] = useState(initialNotes.notes)
  const [selectedId, setSelectedId] = useState(initialNotes.notes[0]?.id || null)
  const [search, setSearch] = useState('')
  const [storageError, setStorageError] = useState(initialNotes.error)
  const selectedNote = notes.find((note) => note.id === selectedId)
  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return notes
    return notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(query))
  }, [notes, search])

  useEffect(() => {
    dialogRef.current?.querySelector('.professor-quick-notes-close')?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function saveNotes(updatedNotes) {
    setNotes(updatedNotes)
    setStorageError('')
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes))
    } catch {
      setStorageError('Notes could not be saved in this browser. Check available storage and try again.')
    }
  }

  function addNote() {
    const note = createNote()
    saveNotes([note, ...notes])
    setSelectedId(note.id)
    setSearch('')
  }

  function updateSelectedNote(field, value) {
    if (!selectedNote) return
    const updatedAt = new Date().toISOString()
    saveNotes(notes.map((note) => (
      note.id === selectedNote.id ? { ...note, [field]: value, updatedAt } : note
    )))
  }

  function deleteNote(noteId) {
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    const remainingNotes = notes.filter((note) => note.id !== noteId)
    saveNotes(remainingNotes)
    if (selectedId === noteId) setSelectedId(remainingNotes[0]?.id || null)
  }

  return (
    <div
      className="professor-quick-notes-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        ref={dialogRef}
        className="professor-quick-notes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="professor-quick-notes-title"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const focusable = event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')
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
        <header className="professor-quick-notes-header">
          <div className="professor-quick-notes-heading">
            <span className="professor-quick-notes-icon"><FileText size={19} /></span>
            <div>
              <span className="professor-eyebrow">PERSONAL WORKSPACE</span>
              <h2 id="professor-quick-notes-title">My Quick Notes</h2>
            </div>
          </div>
          <button className="professor-quick-notes-close" type="button" onClick={onClose} aria-label="Close quick notes">
            <X size={18} />
          </button>
        </header>

        <div className="professor-quick-notes-content">
          <aside className="professor-quick-notes-list" aria-label="Saved notes">
            <button className="professor-quick-notes-create" type="button" onClick={addNote}>
              <Plus size={16} /> New note
            </button>
            <label className="professor-quick-notes-search">
              <Search size={15} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a note"
                aria-label="Search notes"
              />
            </label>
            <div className="professor-quick-notes-items">
              {visibleNotes.length ? visibleNotes.map((note) => (
                <div className={`professor-quick-notes-item${selectedId === note.id ? ' active' : ''}`} key={note.id}>
                  <button type="button" className="professor-quick-notes-select" onClick={() => setSelectedId(note.id)}>
                    <strong>{note.title.trim() || 'Untitled note'}</strong>
                    <span>{note.content.trim() || 'No additional text'}</span>
                    <small>{formatUpdatedDate(note.updatedAt)}</small>
                  </button>
                  <button
                    className="professor-quick-notes-delete"
                    type="button"
                    aria-label={`Delete ${note.title.trim() || 'untitled note'}`}
                    title="Delete note"
                    onClick={() => deleteNote(note.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )) : (
                <p className="professor-quick-notes-empty">
                  {notes.length ? 'No notes match your search.' : 'No notes yet. Create one to capture a thought.'}
                </p>
              )}
            </div>
          </aside>

          <div className="professor-quick-notes-editor">
            {selectedNote ? (
              <>
                <label className="professor-quick-notes-title-field">
                  <span className="professor-sr-only">Note title</span>
                  <input
                    autoFocus
                    maxLength={120}
                    value={selectedNote.title}
                    onChange={(event) => updateSelectedNote('title', event.target.value)}
                    placeholder="Note title"
                  />
                </label>
                <textarea
                  className="professor-quick-notes-textarea"
                  value={selectedNote.content}
                  onChange={(event) => updateSelectedNote('content', event.target.value)}
                  placeholder="Write something down…"
                  aria-label="Note content"
                />
                <div className="professor-quick-notes-footer">
                  <span>{storageError ? 'Could not save' : 'Saved locally in this browser'}</span>
                  <small>{formatUpdatedDate(selectedNote.updatedAt)}</small>
                </div>
              </>
            ) : (
              <div className="professor-quick-notes-first-note">
                <FileText size={25} />
                <strong>{notes.length ? 'No notes found' : 'Your notes, all in one place'}</strong>
                <span>{notes.length ? 'Try another search or clear the search field.' : 'Create a note for reminders, lesson ideas, or anything you want to remember.'}</span>
                {!notes.length && <button className="professor-quick-notes-create" type="button" onClick={addNote}><Plus size={16} /> Create a note</button>}
              </div>
            )}
            {storageError && <span className="professor-quick-notes-storage-error" role="alert">{storageError}</span>}
          </div>
        </div>
        <p className="professor-quick-notes-local-hint">Notes are stored only in this browser and are not synced across devices.</p>
      </section>
    </div>
  )
}
