import { useEffect, useRef, useState } from 'react'
import { BookOpenCheck, CheckCircle2, Clock3, LockKeyhole, Play, RotateCcw } from 'lucide-react'
import { api } from '../auth/AuthContext'
import '../quizzes/quiz.css'

function getSecondsRemaining(expiresAt) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function formatRemaining(seconds) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function answerList(attempt) {
  return attempt.answers.reduce((result, item) => ({ ...result, [item.questionIndex]: item.answer }), {})
}

export default function StudentQuizSection({ classId, practice = false }) {
  const [items, setItems] = useState([])
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const answerQueues = useRef(new Map())
  const submitRef = useRef(null)
  const submittingRef = useRef(false)

  async function loadItems() {
    const path = practice
      ? `/student/classes/${classId}/practice-materials`
      : `/student/classes/${classId}/quizzes`
    try {
      const { data } = await api.get(path)
      setItems(practice ? data.materials : data.quizzes)
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not load ${practice ? 'practice topics' : 'quizzes'}.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const path = practice
      ? `/student/classes/${classId}/practice-materials`
      : `/student/classes/${classId}/quizzes`
    api.get(path)
      .then(({ data }) => { if (active) setItems(practice ? data.materials : data.quizzes) })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || `Could not load ${practice ? 'practice topics' : 'quizzes'}.`) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [classId, practice])

  function acceptAttempt(nextAttempt) {
    setAttempt(nextAttempt)
    setAnswers(answerList(nextAttempt))
    setSecondsRemaining(getSecondsRemaining(nextAttempt.expiresAt))
  }

  async function startItem(item) {
    setError('')
    setNotice('')
    setStartingId(item.id || item._id)
    try {
      const endpoint = practice
        ? `/student/materials/${item._id}/practice-attempts`
        : `/student/quizzes/${item.id}/attempts`
      const { data } = await api.post(endpoint)
      acceptAttempt(data.attempt)
      await loadItems()
    } catch (requestError) {
      const existingAttempt = requestError.response?.data?.attempt
      if (existingAttempt) {
        acceptAttempt(existingAttempt)
        return
      }
      setError(requestError.response?.data?.message || 'Could not start this attempt.')
      await loadItems()
    } finally {
      setStartingId('')
    }
  }

  async function submitAttempt() {
    if (!attempt || attempt.status !== 'in_progress' || submittingRef.current) return
    submittingRef.current = true
    setNotice('')
    try {
      await Promise.all([...answerQueues.current.values()])
      const { data } = await api.post(`/student/attempts/${attempt.id}/submit`)
      acceptAttempt(data.attempt)
      setNotice(data.attempt.status === 'expired' ? 'Time expired. Your saved answers were submitted.' : 'Your attempt was submitted.')
      await loadItems()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit this attempt. Your saved answers are still available.')
    } finally {
      submittingRef.current = false
    }
  }

  useEffect(() => {
    submitRef.current = submitAttempt
  })

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return undefined
    const interval = window.setInterval(() => {
      const remaining = getSecondsRemaining(attempt.expiresAt)
      setSecondsRemaining(remaining)
      if (remaining === 0) submitRef.current?.()
    }, 500)
    return () => window.clearInterval(interval)
  }, [attempt])

  function chooseAnswer(questionIndex, answer) {
    setAnswers((current) => ({ ...current, [questionIndex]: answer }))
    const prior = answerQueues.current.get(questionIndex) || Promise.resolve()
    const next = prior.catch(() => undefined).then(() => api.put(
      `/student/attempts/${attempt.id}/answers/${questionIndex}`,
      { answer },
    ))
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Could not save your answer.')
      })
    answerQueues.current.set(questionIndex, next)
  }

  const activeAttempt = attempt?.status === 'in_progress'

  return (
    <section className="quiz-panel student-quiz-panel">
      <header className="quiz-panel-heading">
        <div><span className="student-eyebrow">{practice ? 'PRACTICE FROM CLASS LESSONS' : 'ASSESSMENTS'}</span><h2>{practice ? 'Choose a practice topic' : 'Class quizzes'}</h2><p>{practice ? 'Practice questions are created from extracted text in a lesson your professor uploaded.' : 'Take quizzes published by your professor for this class.'}</p></div>
        <span className="quiz-panel-icon"><BookOpenCheck size={20} /></span>
      </header>
      {error && <p className="quiz-message error" role="alert">{error}</p>}
      {notice && <p className="quiz-message success" role="status">{notice}</p>}

      {activeAttempt ? (
        <div className="quiz-taking">
          <div className="quiz-taker-heading"><div><span className="student-eyebrow">{practice ? `PRACTICE ATTEMPT ${attempt.practiceAttemptNumber} OF 3` : 'ONE QUIZ ATTEMPT'}</span><h3>{attempt.title}</h3><span>{attempt.totalQuestions} questions · 75% to pass</span></div><div className={`quiz-timer ${secondsRemaining <= 60 ? 'urgent' : ''}`} role="timer"><Clock3 size={17} />{formatRemaining(secondsRemaining)}</div></div>
          <p className="quiz-rule-note">Your answers save as you go. The attempt submits automatically when the 10-minute timer or quiz deadline is reached.</p>
          {attempt.questions.map((question, index) => (
            <fieldset className="quiz-answer-card" key={`${attempt.id}-${index}`}>
              <legend>Question {index + 1} of {attempt.questions.length}</legend>
              <p>{question.prompt}</p>
              <div className="quiz-answer-options">{question.options.map((option) => <label key={option} className={answers[index] === option ? 'selected' : ''}><input type="radio" name={`question-${index}`} value={option} checked={answers[index] === option} onChange={() => chooseAnswer(index, option)} /><span>{option}</span></label>)}</div>
            </fieldset>
          ))}
          <button className="quiz-primary-button" type="button" onClick={submitAttempt} disabled={secondsRemaining <= 0}><CheckCircle2 size={15} />Submit attempt</button>
        </div>
      ) : attempt && attempt.status !== 'in_progress' ? (
        <div className="quiz-result-card">
          <div className={`quiz-result-icon ${attempt.passed ? 'pass' : 'fail'}`}><CheckCircle2 size={22} /></div>
          <span className="student-eyebrow">{attempt.status === 'expired' ? 'TIME EXPIRED' : 'RESULT'}</span>
          <h3>{attempt.passed ? 'You passed!' : 'Keep practicing'}</h3>
          <strong>{attempt.correctCount} of {attempt.totalQuestions} correct · {attempt.scorePercent}%</strong>
          <p>{attempt.passed ? 'You met the 75% passing score.' : 'You needed at least 75% to pass.'}</p>
          <div className="quiz-review-list">{attempt.questions.map((question, index) => <article className="quiz-review-item" key={`${attempt.id}-review-${index}`}><strong>{index + 1}. {question.prompt}</strong><span className={question.isCorrect ? 'quiz-pass' : 'quiz-fail'}>{question.isCorrect ? 'Correct' : `Your answer: ${question.answer || 'No answer'}`}</span>{!question.isCorrect && <small>Correct answer: {question.correctAnswer}</small>}</article>)}</div>
          <button className="quiz-secondary-button" type="button" onClick={() => { setAttempt(null); setError(''); setNotice(''); loadItems() }}><RotateCcw size={14} />Back to {practice ? 'practice topics' : 'quizzes'}</button>
        </div>
      ) : (
        <div className="quiz-item-list">
          {loading ? <p className="quiz-empty">Loading {practice ? 'practice topics' : 'quizzes'}…</p> : items.length === 0 ? (
            <p className="quiz-empty">{practice ? 'No published lesson files are available for practice yet.' : 'Your professor has not published a quiz for this class yet.'}</p>
          ) : items.map((item) => {
            const completedAttempt = !practice ? item.attempt : null
            const attemptsRemaining = practice ? item.attemptsRemaining : 1
            const itemId = item.id || item._id
            return <article className={`quiz-list-card${!practice && !item.unlocked ? ' quiz-list-card-locked' : ''}`} key={itemId}>
              <div><strong>{practice ? item.title : `Quiz ${item.sequence}: ${item.title}`}</strong><p>{practice ? item.description || item.originalFileName : item.description || `${item.questionCount} questions`}</p><small>{practice ? `${attemptsRemaining} of 3 practice attempts remaining · 20 questions · 10 minutes · 75% to pass` : `${item.questionCount} questions · 10 minutes · 75% to pass`}</small>
                {!practice && item.deadline && <span className={`quiz-attempt-summary${item.deadlinePassed ? ' quiz-fail' : ''}`}>Deadline: {new Date(item.deadline).toLocaleString()}{item.deadlinePassed ? ' · Passed' : ''}</span>}
                {!practice && !item.unlocked && <span className="quiz-attempt-summary quiz-locked-note"><LockKeyhole size={12} />Locked · Complete {item.lockedBy} first</span>}
                {completedAttempt?.status !== 'in_progress' && completedAttempt && <span className={`quiz-attempt-summary ${completedAttempt.passed ? 'quiz-pass' : 'quiz-fail'}`}>Previous result: {completedAttempt.scorePercent}% · {completedAttempt.passed ? 'Passed' : 'Not passed'}</span>}
                {completedAttempt?.status === 'in_progress' && <span className="quiz-attempt-summary">Attempt in progress · resumes with remaining time</span>}
              </div>
              <button className="quiz-secondary-button" type="button" disabled={startingId === itemId || (practice && attemptsRemaining === 0) || (!practice && (item.deadlinePassed || !item.unlocked || (completedAttempt && completedAttempt.status !== 'in_progress')))} onClick={() => startItem(item)}>
                <Play size={14} />{startingId === itemId ? (practice ? 'Generating…' : 'Opening…') : practice ? attemptsRemaining ? 'Start practice' : 'No attempts left' : item.deadlinePassed ? 'Deadline passed' : !item.unlocked ? 'Locked' : completedAttempt?.status === 'in_progress' ? 'Resume quiz' : completedAttempt ? 'Attempt used' : 'Start quiz'}
              </button>
            </article>
          })}
        </div>
      )}
    </section>
  )
}
