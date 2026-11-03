import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Download, FileSpreadsheet, FileText, Save, Users, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { strToU8, zipSync } from 'fflate'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { api } from '../auth/AuthContext'
import '../quizzes/quiz.css'

function compareAttemptsByLastName(first, second) {
  const firstName = first.student?.fullName?.trim() || 'Student'
  const secondName = second.student?.fullName?.trim() || 'Student'
  const firstLastName = firstName.split(/\s+/).at(-1)
  const secondLastName = secondName.split(/\s+/).at(-1)
  return firstLastName.localeCompare(secondLastName, undefined, { sensitivity: 'base' })
    || firstName.localeCompare(secondName, undefined, { sensitivity: 'base' })
}

function sortAttemptsByLastName(attempts) {
  return [...attempts].sort(compareAttemptsByLastName)
}

function sortAttemptsByScore(attempts) {
  return [...attempts].sort((first, second) => {
    const scoreOrder = Number(second.scorePercent ?? 0) - Number(first.scorePercent ?? 0)
    return scoreOrder || compareAttemptsByLastName(first, second)
  })
}

function sortAttempts(attempts, order) {
  return order === 'score' ? sortAttemptsByScore(attempts) : sortAttemptsByLastName(attempts)
}

function compareStudentsByLastName(first, second) {
  const firstName = first.fullName?.trim() || 'Student'
  const secondName = second.fullName?.trim() || 'Student'
  const firstLastName = firstName.split(/\s+/).at(-1)
  const secondLastName = secondName.split(/\s+/).at(-1)
  return firstLastName.localeCompare(secondLastName, undefined, { sensitivity: 'base' })
    || firstName.localeCompare(secondName, undefined, { sensitivity: 'base' })
}

function getScoreSummary(students, quizzes) {
  return [...students].sort(compareStudentsByLastName).map((student) => {
    const scores = Object.fromEntries(quizzes.map((quiz) => {
      const attempt = quiz.scoreAttempts?.find((item) => String(item.student?._id || item.student) === String(student.id))
      return [quiz.id, attempt || null]
    }))
    return { ...student, scores }
  })
}

function formatScoreCell(attempt) {
  if (!attempt) return 'Not taken'
  if (attempt.status === 'in_progress') return 'In progress'
  return `Attempt ${attempt.attemptNumber || '—'} · ${attempt.scorePercent}% (${attempt.correctCount}/${attempt.totalQuestions}) · ${attempt.passed ? 'Passed' : 'Not passed'}`
}

function safeReportFileName(value) {
  return value.trim().replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'class'
}

function downloadScoreSpreadsheet(rows, quizzes, className) {
  const worksheetRows = [
    ['Student', 'Email', ...quizzes.map((quiz) => quiz.title)],
    ...rows.map((student) => [
      student.fullName,
      student.email,
      ...quizzes.map((quiz) => formatScoreCell(student.scores[quiz.id])),
    ]),
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows)
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 32 },
    ...quizzes.map(() => ({ wch: 30 })),
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quiz score summary')
  XLSX.writeFile(workbook, `${safeReportFileName(className)}-all-quiz-scores.xlsx`)
}

function downloadScorePdf(rows, quizzes, className) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const studentColumnWidth = 48
  const quizGroups = []
  for (let index = 0; index < quizzes.length; index += 5) {
    quizGroups.push(quizzes.slice(index, index + 5))
  }
  if (!quizGroups.length) quizGroups.push([])

  quizGroups.forEach((quizGroup, groupIndex) => {
    if (groupIndex > 0) pdf.addPage()
    const quizColumnWidth = (pageWidth - margin * 2 - studentColumnWidth) / Math.max(quizGroup.length, 1)
    const drawHeader = (top) => {
      pdf.setFillColor(232, 243, 238)
      pdf.rect(margin, top, pageWidth - margin * 2, 13, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.text('Student', margin + 2, top + 8)
      quizGroup.forEach((quiz, index) => {
        const titleLines = pdf.splitTextToSize(quiz.title, quizColumnWidth - 4).slice(0, 2)
        pdf.text(titleLines, margin + studentColumnWidth + index * quizColumnWidth + 2, top + 5)
      })
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.text(`${className} - All Quiz Scores`, margin, 16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    const pageDescription = quizzes.length > 5 ? `Quizzes ${groupIndex * 5 + 1}-${Math.min((groupIndex + 1) * 5, quizzes.length)} of ${quizzes.length}` : `${quizzes.length} quizzes`
    pdf.text(`${rows.length} students | Sorted alphabetically by surname | ${pageDescription}`, margin, 22)
    let y = 27
    drawHeader(y)
    y += 16
    pdf.setFontSize(6)

    rows.forEach((student) => {
      const studentLines = pdf.splitTextToSize(student.fullName, studentColumnWidth - 4)
      const scoreLines = quizGroup.map((quiz) => pdf.splitTextToSize(formatScoreCell(student.scores[quiz.id]), quizColumnWidth - 4).slice(0, 3))
      const rowHeight = Math.max(8, ...studentLines.map(() => 4), ...scoreLines.map((lines) => lines.length * 3)) + 2
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage()
        y = margin
        drawHeader(y)
        y += 16
        pdf.setFontSize(6)
      }
      pdf.text(studentLines, margin + 2, y + 3)
      scoreLines.forEach((lines, index) => {
        pdf.text(lines, margin + studentColumnWidth + index * quizColumnWidth + 2, y + 3)
      })
      pdf.setDrawColor(225, 233, 229)
      pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
      y += rowHeight
    })
  })

  pdf.save(`${safeReportFileName(className)}-all-quiz-scores.pdf`)
}

function escapeXml(value) {
  return String(value ?? '')
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || code >= 32
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function safeFileName(value) {
  return value.trim().replace(/[<>:"/\\|?*]/g, '-').split('').filter((character) => character.charCodeAt(0) >= 32).join('').replace(/\s+/g, '-').slice(0, 80) || 'quiz'
}

function formatSubmittedAt(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function downloadDocx(quiz, attempts, order) {
  const rows = [
    ['Student', 'Correct answers', 'Score', 'Result', 'Submitted'],
    ...attempts.map((attempt) => [
      attempt.student?.fullName || 'Student',
      `${attempt.correctCount}/${attempt.totalQuestions}`,
      `${attempt.scorePercent}%`,
      attempt.passed ? 'Passed' : 'Not passed',
      formatSubmittedAt(attempt.submittedAt),
    ]),
  ]
  const tableRows = rows.map((row, rowIndex) => {
    const cells = row.map((text) => `<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr><w:p><w:r>${rowIndex === 0 ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`).join('')
    return `<w:tr>${cells}</w:tr>`
  }).join('')
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(quiz.title)} — Score Summary</w:t></w:r></w:p>
<w:p><w:r><w:t>${escapeXml(quiz.questionCount)} questions · 75% to pass · Deadline: ${escapeXml(quiz.deadline ? formatSubmittedAt(quiz.deadline) : 'None')}</w:t></w:r></w:p>
<w:p><w:r><w:t>Students are sorted ${escapeXml(order === 'score' ? 'by score, highest to lowest' : 'alphabetically by last name')}. Exported ${escapeXml(new Date().toLocaleString())}.</w:t></w:r></w:p>
<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B7C9C2"/><w:left w:val="single" w:sz="4" w:color="B7C9C2"/><w:bottom w:val="single" w:sz="4" w:color="B7C9C2"/><w:right w:val="single" w:sz="4" w:color="B7C9C2"/><w:insideH w:val="single" w:sz="4" w:color="DCE6E1"/><w:insideV w:val="single" w:sz="4" w:color="DCE6E1"/></w:tblBorders></w:tblPr>${tableRows}</w:tbl>
<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
</w:body></w:document>`
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(documentXml),
  }
  const docx = zipSync(files, { level: 6 })
  const url = URL.createObjectURL(new Blob([docx], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName(quiz.title)}-score-summary-${order === 'score' ? 'by-score' : 'by-name'}.docx`
  link.click()
  URL.revokeObjectURL(url)
}

function downloadPdf(quiz, attempts, order) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 14
  const columns = [
    { title: 'Student', width: 90 },
    { title: 'Correct', width: 30 },
    { title: 'Score', width: 25 },
    { title: 'Result', width: 35 },
    { title: 'Submitted', width: pageWidth - margin * 2 - 180 },
  ]
  const drawHeader = (top) => {
    pdf.setFillColor(232, 243, 238)
    pdf.rect(margin, top, pageWidth - margin * 2, 9, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    let x = margin + 2
    columns.forEach((column) => {
      pdf.text(column.title, x, top + 6)
      x += column.width
    })
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(`${quiz.title} - Score Summary`, margin, 19)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`${quiz.questionCount} questions | 75% to pass | Deadline: ${quiz.deadline ? formatSubmittedAt(quiz.deadline) : 'None'}`, margin, 26)
  pdf.text(`${order === 'score' ? 'Sorted by score, highest to lowest' : 'Alphabetical by last name'} | Exported ${new Date().toLocaleString()}`, margin, 32)
  let y = 39
  drawHeader(y)
  y += 12
  pdf.setFontSize(8)
  attempts.forEach((attempt) => {
    const values = [
      attempt.student?.fullName || 'Student',
      `${attempt.correctCount}/${attempt.totalQuestions}`,
      `${attempt.scorePercent}%`,
      attempt.passed ? 'Passed' : 'Not passed',
      formatSubmittedAt(attempt.submittedAt),
    ]
    const wrapped = values.map((value, index) => pdf.splitTextToSize(value, columns[index].width - 4))
    const rowHeight = Math.max(8, ...wrapped.map((lines) => lines.length * 4)) + 2
    if (y + rowHeight > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage()
      y = margin
      drawHeader(y)
      y += 12
    }
    let x = margin + 2
    wrapped.forEach((lines, index) => {
      pdf.text(lines, x, y + 3)
      x += columns[index].width
    })
    pdf.setDrawColor(225, 233, 229)
    pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
    y += rowHeight
  })
  if (!attempts.length) {
    pdf.setFontSize(10)
    pdf.text('No students have submitted this quiz yet.', margin, y + 3)
  }
  pdf.save(`${safeFileName(quiz.title)}-score-summary-${order === 'score' ? 'by-score' : 'by-name'}.pdf`)
}

function blankMultipleChoice() {
  return { prompt: '', options: ['', '', '', ''], correctAnswer: '' }
}

function blankTrueFalse() {
  return { prompt: '', correctAnswer: 'True' }
}

export default function ProfessorQuizManager({ classId, className = 'Class', onDraftStateChange, onDraftDiscardRef }) {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState([])
  const [students, setStudents] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [minimumDeadline] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [multipleChoiceCount, setMultipleChoiceCount] = useState(10)
  const [trueFalseCount, setTrueFalseCount] = useState(10)
  const [multipleChoiceQuestions, setMultipleChoiceQuestions] = useState(() => Array.from({ length: 10 }, blankMultipleChoice))
  const [trueFalseQuestions, setTrueFalseQuestions] = useState(() => Array.from({ length: 10 }, blankTrueFalse))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('create')
  const [draftDirty, setDraftDirty] = useState(false)
  const [pendingTab, setPendingTab] = useState(null)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [expandedQuizIds, setExpandedQuizIds] = useState(() => new Set())
  const [previewQuizId, setPreviewQuizId] = useState(null)
  const [floatingQuizzesOpen, setFloatingQuizzesOpen] = useState(false)
  const [exportSortByQuiz, setExportSortByQuiz] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const draftDirtyRef = useRef(false)
  const allowHistoryLeaveRef = useRef(false)
  const historyGuardRef = useRef(false)
  const previousHistoryStateRef = useRef(null)
  const protectedHistoryStateRef = useRef(null)
  const protectedHistoryUrlRef = useRef('')
  const scoreSummary = useMemo(() => getScoreSummary(students, quizzes), [students, quizzes])

  useEffect(() => {
    onDraftStateChange(draftDirty)
  }, [draftDirty, onDraftStateChange])

  useEffect(() => () => onDraftStateChange(false), [onDraftStateChange])

  function markDraftDirty() {
    draftDirtyRef.current = true
    setDraftDirty(true)
  }

  function markDraftClean() {
    draftDirtyRef.current = false
    setDraftDirty(false)
  }

  useEffect(() => {
    onDraftDiscardRef.current = markDraftClean
    return () => { onDraftDiscardRef.current = null }
  }, [onDraftDiscardRef])

  useEffect(() => {
    if (!draftDirty) return undefined
    function warnBeforeLeaving(event) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [draftDirty])

  useEffect(() => {
    if (!draftDirty) return undefined
    const marker = '__quizDraftGuard'
    if (!historyGuardRef.current) {
      previousHistoryStateRef.current = window.history.state
      protectedHistoryStateRef.current = { ...(window.history.state || {}), [marker]: true }
      protectedHistoryUrlRef.current = window.location.href
      window.history.pushState(protectedHistoryStateRef.current, '', protectedHistoryUrlRef.current)
      historyGuardRef.current = true
    }
    function guardBrowserBack() {
      if (allowHistoryLeaveRef.current) {
        allowHistoryLeaveRef.current = false
        return
      }
      if (!draftDirtyRef.current) return
      window.history.pushState(protectedHistoryStateRef.current, '', protectedHistoryUrlRef.current)
      setPendingNavigation({ type: 'history' })
    }
    window.addEventListener('popstate', guardBrowserBack)
    return () => {
      window.removeEventListener('popstate', guardBrowserBack)
      if (!draftDirtyRef.current && historyGuardRef.current) {
        if (window.history.state?.[marker]) window.history.replaceState(previousHistoryStateRef.current, '', window.location.href)
        historyGuardRef.current = false
      }
    }
  }, [draftDirty])

  useEffect(() => {
    if (!draftDirty) return undefined
    function guardInternalNavigation(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest('a[href]')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      event.preventDefault()
      event.stopPropagation()
      setPendingNavigation({ type: 'route', to: `${destination.pathname}${destination.search}${destination.hash}` })
    }
    document.addEventListener('click', guardInternalNavigation, true)
    return () => document.removeEventListener('click', guardInternalNavigation, true)
  }, [draftDirty])

  function requestQuizTabChange(nextTab) {
    if (nextTab === activeTab) return
    if (draftDirty) {
      setPendingTab(nextTab)
      return
    }
    setActiveTab(nextTab)
  }

  function confirmDiscardDraft() {
    const nextTab = pendingTab
    const nextNavigation = pendingNavigation
    setTitle('')
    setDescription('')
    setDeadline('')
    setMultipleChoiceCount(10)
    setTrueFalseCount(10)
    setMultipleChoiceQuestions(Array.from({ length: 10 }, blankMultipleChoice))
    setTrueFalseQuestions(Array.from({ length: 10 }, blankTrueFalse))
    markDraftClean()
    if (nextTab) setActiveTab(nextTab)
    setPendingTab(null)
    setPendingNavigation(null)
    if (nextNavigation?.type === 'route') navigate(nextNavigation.to, { replace: true })
    if (nextNavigation?.type === 'history') {
      allowHistoryLeaveRef.current = true
      window.history.go(-2)
    }
  }

  async function loadQuizzes() {
    try {
      const { data } = await api.get(`/professor/classes/${classId}/quizzes`)
      setQuizzes(data.quizzes)
      setStudents(data.students || [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load class quizzes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.get(`/professor/classes/${classId}/quizzes`)
      .then(({ data }) => {
        if (active) {
          setQuizzes(data.quizzes)
          setStudents(data.students || [])
        }
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load class quizzes.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [classId])

  function openQuizPreview(quizId) {
    setPreviewQuizId(quizId)
    setActiveTab('published')
    setFloatingQuizzesOpen(false)
  }

  useEffect(() => {
    if (!previewQuizId) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') setPreviewQuizId(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [previewQuizId])

  useEffect(() => {
    if (!pendingTab && !pendingNavigation) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setPendingTab(null)
        setPendingNavigation(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [pendingTab, pendingNavigation])

  const previewQuiz = quizzes.find((quiz) => quiz.id === previewQuizId)

  function resizeQuestions(type, count) {
    const nextCount = Math.max(0, Math.min(20, Number(count) || 0))
    markDraftDirty()
    if (type === 'multiple_choice') {
      const trueFalseTotal = 20 - nextCount
      setMultipleChoiceCount(nextCount)
      setTrueFalseCount(trueFalseTotal)
      setMultipleChoiceQuestions((current) => Array.from({ length: nextCount }, (_, index) => current[index] || blankMultipleChoice()))
      setTrueFalseQuestions((current) => Array.from({ length: trueFalseTotal }, (_, index) => current[index] || blankTrueFalse()))
      return
    }
    const multipleChoiceTotal = 20 - nextCount
    setTrueFalseCount(nextCount)
    setMultipleChoiceCount(multipleChoiceTotal)
    setTrueFalseQuestions((current) => Array.from({ length: nextCount }, (_, index) => current[index] || blankTrueFalse()))
    setMultipleChoiceQuestions((current) => Array.from({ length: multipleChoiceTotal }, (_, index) => current[index] || blankMultipleChoice()))
  }

  function updateMultipleChoice(index, field, value, optionIndex) {
    markDraftDirty()
    setMultipleChoiceQuestions((current) => current.map((question, questionIndex) => {
      if (questionIndex !== index) return question
      if (field === 'option') {
        const options = question.options.map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? value : option)
        const correctAnswer = options.includes(question.correctAnswer) ? question.correctAnswer : ''
        return { ...question, options, correctAnswer }
      }
      return { ...question, [field]: value }
    }))
  }

  function toggleQuizResults(quizId) {
    setExpandedQuizIds((current) => {
      const next = new Set(current)
      if (next.has(quizId)) next.delete(quizId)
      else next.add(quizId)
      return next
    })
  }

  function exportQuizSummary(quiz, format, order = exportSortByQuiz[quiz.id] || 'name') {
    setError('')
    try {
      const attempts = sortAttempts(quiz.attempts, order)
      if (format === 'pdf') downloadPdf(quiz, attempts, order)
      else downloadDocx(quiz, attempts, order)
    } catch {
      setError(`Could not export the ${format.toUpperCase()} summary. Please try again.`)
    }
  }

  function exportAllScores(format) {
    setError('')
    try {
      if (format === 'pdf') downloadScorePdf(scoreSummary, quizzes, className)
      else downloadScoreSpreadsheet(scoreSummary, quizzes, className)
    } catch (exportError) {
      console.error(`Could not export the all-quiz score summary as ${format.toUpperCase()}:`, exportError)
      setError(`Could not export the ${format.toUpperCase()} score summary. Please try again.`)
    }
  }

  async function submitQuiz(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    const questions = [
      ...multipleChoiceQuestions.slice(0, multipleChoiceCount).map((question) => ({
        ...question,
        type: 'multiple_choice',
      })),
      ...trueFalseQuestions.slice(0, trueFalseCount).map((question) => ({
        ...question,
        options: ['True', 'False'],
        type: 'true_false',
      })),
    ]
    if (questions.length !== 20) {
      setError('A quiz must contain exactly 20 questions.')
      return
    }
    if (!deadline || !Number.isFinite(new Date(deadline).getTime()) || new Date(deadline).getTime() <= Date.now()) {
      setError('Choose a quiz deadline in the future.')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post(`/professor/classes/${classId}/quizzes`, { title, description, deadline: new Date(deadline).toISOString(), questions })
      setTitle('')
      setDescription('')
      setDeadline('')
      setMultipleChoiceCount(10)
      setTrueFalseCount(10)
      setMultipleChoiceQuestions(Array.from({ length: 10 }, blankMultipleChoice))
      setTrueFalseQuestions(Array.from({ length: 10 }, blankTrueFalse))
      markDraftClean()
      setNotice(data.notificationWarning || 'Quiz published. Students in this class can now take it.')
      await loadQuizzes()
      setActiveTab('published')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create this quiz.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="quiz-panel professor-quiz-panel">
      <header className="quiz-panel-heading">
        <div><span className="professor-eyebrow">ASSESSMENTS</span><h2>Class quizzes</h2><p>Each quiz has 20 questions. Students need at least 15 correct answers to pass and unlock the next quiz.</p></div>
        <span className="quiz-panel-icon"><ClipboardList size={20} /></span>
      </header>
      {error && <p className="quiz-message error" role="alert">{error}</p>}
      {notice && <p className="quiz-message success" role="status">{notice}</p>}

      {quizzes.length > 0 && (
        <aside className="quiz-floating-library">
          {floatingQuizzesOpen && (
            <div id="quiz-floating-library-list" className="quiz-floating-library-popover" role="region" aria-label="Created quizzes">
              <div className="quiz-floating-library-heading">
                <div><strong>Your quizzes</strong><span>Select one to view its questions and answers.</span></div>
                <button type="button" aria-label="Close created quizzes" onClick={() => setFloatingQuizzesOpen(false)}><X size={16} /></button>
              </div>
              <div className="quiz-floating-library-list">
                {quizzes.map((quiz, index) => (
                  <button className="quiz-floating-library-item" type="button" key={quiz.id} onClick={() => openQuizPreview(quiz.id)}>
                    <span className="quiz-floating-library-index">{index + 1}</span>
                    <span className="quiz-floating-library-item-copy"><strong>{quiz.title}</strong><small>{quiz.questionCount} questions{quiz.deadline ? ` · Due ${new Date(quiz.deadline).toLocaleDateString()}` : ''}</small></span>
                    <ChevronDown size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            className="quiz-floating-library-trigger"
            type="button"
            aria-expanded={floatingQuizzesOpen}
            aria-controls="quiz-floating-library-list"
            onClick={() => setFloatingQuizzesOpen((open) => !open)}
          >
            {floatingQuizzesOpen ? <X size={17} /> : <BookOpen size={17} />}
            <span>My quizzes</span>
            <span className="quiz-floating-library-count">{quizzes.length}</span>
          </button>
        </aside>
      )}

      <div className="quiz-tabs" role="tablist" aria-label="Quiz management">
        <button id="quiz-create-tab" className={`quiz-tab${activeTab === 'create' ? ' active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'create'} aria-controls="quiz-create-panel" onClick={() => requestQuizTabChange('create')}>Create quiz</button>
        <button id="quiz-published-tab" className={`quiz-tab${activeTab === 'published' ? ' active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'published'} aria-controls="quiz-published-panel" onClick={() => requestQuizTabChange('published')}>Published quizzes <span>{quizzes.length}</span></button>
        <button id="quiz-score-summary-tab" className={`quiz-tab${activeTab === 'summary' ? ' active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'summary'} aria-controls="quiz-score-summary-panel" onClick={() => requestQuizTabChange('summary')}>Score summary</button>
      </div>

      {activeTab === 'create' ? (
      <div id="quiz-create-panel" role="tabpanel" aria-labelledby="quiz-create-tab">
      <form className="quiz-builder" onSubmit={submitQuiz}>
        <label className="quiz-field"><span>Quiz title <b>*</b></span><input required maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); markDraftDirty() }} placeholder="e.g. Introduction quiz" /></label>
        <label className="quiz-field"><span>Instructions <small>Optional</small></span><textarea rows={2} maxLength={2000} value={description} onChange={(event) => { setDescription(event.target.value); markDraftDirty() }} placeholder="Instructions for students" /></label>
        <label className="quiz-field"><span>Deadline <b>*</b></span><input type="datetime-local" required min={minimumDeadline} value={deadline} onChange={(event) => { setDeadline(event.target.value); markDraftDirty() }} /><small>Students may retake quizzes after the deadline, but their recorded score is halved.</small></label>
        <div className="quiz-count-grid">
          <label className="quiz-field"><span>Multiple-choice questions</span><input type="number" min="0" max="20" value={multipleChoiceCount} onChange={(event) => resizeQuestions('multiple_choice', event.target.value)} /></label>
          <label className="quiz-field"><span>True/false questions</span><input type="number" min="0" max="20" value={trueFalseCount} onChange={(event) => resizeQuestions('true_false', event.target.value)} /></label>
        </div>
        <p className="quiz-rule-note">{multipleChoiceCount + trueFalseCount} of 20 required questions · 10 minutes · at least 15 correct to pass</p>

        {multipleChoiceQuestions.slice(0, multipleChoiceCount).map((question, index) => (
          <fieldset className="quiz-question-editor" key={`mc-${index}`}>
            <legend>Multiple choice · Question {index + 1}</legend>
            <label className="quiz-field"><span>Question <b>*</b></span><textarea required maxLength={1000} rows={2} value={question.prompt} onChange={(event) => updateMultipleChoice(index, 'prompt', event.target.value)} /></label>
            <div className="quiz-options-grid">{question.options.map((option, optionIndex) => <label className="quiz-field" key={optionIndex}><span>Option {optionIndex + 1} <b>*</b></span><input required maxLength={300} value={option} onChange={(event) => updateMultipleChoice(index, 'option', event.target.value, optionIndex)} /></label>)}</div>
            <label className="quiz-field"><span>Correct answer <b>*</b></span><select required value={question.correctAnswer} onChange={(event) => updateMultipleChoice(index, 'correctAnswer', event.target.value)}><option value="">Select the correct option</option>{question.options.filter(Boolean).map((option, optionIndex) => <option key={`${optionIndex}-${option}`} value={option}>{option}</option>)}</select></label>
          </fieldset>
        ))}

        {trueFalseQuestions.slice(0, trueFalseCount).map((question, index) => (
          <fieldset className="quiz-question-editor" key={`tf-${index}`}>
            <legend>True or false · Question {index + 1}</legend>
            <label className="quiz-field"><span>Statement <b>*</b></span><textarea required maxLength={1000} rows={2} value={question.prompt} onChange={(event) => { setTrueFalseQuestions((current) => current.map((item, questionIndex) => questionIndex === index ? { ...item, prompt: event.target.value } : item)); markDraftDirty() }} /></label>
            <label className="quiz-field"><span>Correct answer <b>*</b></span><select value={question.correctAnswer} onChange={(event) => { setTrueFalseQuestions((current) => current.map((item, questionIndex) => questionIndex === index ? { ...item, correctAnswer: event.target.value } : item)); markDraftDirty() }}><option>True</option><option>False</option></select></label>
          </fieldset>
        ))}

        <button className="quiz-primary-button" type="submit" disabled={saving || multipleChoiceCount + trueFalseCount !== 20}>
          <Save size={15} />{saving ? 'Publishing quiz…' : 'Publish quiz'}
        </button>
      </form>
      </div>
      ) : activeTab === 'summary' ? (
      <section id="quiz-score-summary-panel" className="quiz-score-summary-panel" role="tabpanel" aria-labelledby="quiz-score-summary-tab">
        <div className="quiz-score-summary-heading">
          <div><span className="quiz-summary-eyebrow">CLASS PERFORMANCE</span><h3>All quiz scores</h3><p>Every enrolled student and their score for each published quiz. Students are sorted alphabetically by surname.</p></div>
          <div className="quiz-summary-export-actions">
            <button className="quiz-export-button" type="button" disabled={loading || students.length === 0 || quizzes.length === 0} onClick={() => exportAllScores('pdf')}><Download size={14} />Export PDF</button>
            <button className="quiz-export-button" type="button" disabled={loading || students.length === 0 || quizzes.length === 0} onClick={() => exportAllScores('xlsx')}><FileSpreadsheet size={14} />Export spreadsheet</button>
          </div>
        </div>
        {loading ? <p className="quiz-empty">Loading score summary…</p> : students.length === 0 ? (
          <p className="quiz-empty">No students are enrolled in this class yet.</p>
        ) : quizzes.length === 0 ? (
          <p className="quiz-empty">Publish a quiz to start building this class score summary.</p>
        ) : (
          <div className="quiz-score-table-wrap">
            <table className="quiz-score-table">
              <thead><tr><th scope="col">Student</th><th scope="col">Email</th>{quizzes.map((quiz) => <th scope="col" key={quiz.id}>{quiz.title}</th>)}</tr></thead>
              <tbody>{scoreSummary.map((student) => (
                <tr key={student.id}>
                  <th scope="row">{student.fullName}</th>
                  <td>{student.email}</td>
                  {quizzes.map((quiz) => {
                    const attempt = student.scores[quiz.id]
                    return <td key={quiz.id}><span className={`quiz-score-cell${!attempt ? ' not-taken' : attempt.status === 'in_progress' ? ' in-progress' : attempt.passed ? ' passed' : ' not-passed'}`}>{formatScoreCell(attempt)}</span></td>
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      ) : (
      <div id="quiz-published-panel" className="quiz-existing-list" role="tabpanel" aria-labelledby="quiz-published-tab">
        <div className="quiz-published-heading"><h3>Published quizzes</h3><p>Review submissions, compare scores, or export a class summary.</p></div>
        {loading ? <p className="quiz-empty">Loading quizzes…</p> : quizzes.length === 0 ? <p className="quiz-empty">No quizzes have been created for this class.</p> : quizzes.map((quiz) => (
          <article id={`quiz-card-${quiz.id}`} className={`quiz-existing-card${expandedQuizIds.has(quiz.id) ? ' expanded' : ''}`} key={quiz.id}>
            <div className="quiz-existing-card-header">
              <div className="quiz-existing-summary">
                <button className="quiz-preview-open" type="button" onClick={() => openQuizPreview(quiz.id)} aria-haspopup="dialog">
                  <strong>{quiz.title}</strong>
                </button>
                <div className="quiz-card-details">
                  <span>{quiz.questionCount} questions</span>
                  <span>{quiz.multipleChoiceCount} multiple choice</span>
                  <span>{quiz.trueFalseCount} true/false</span>
                </div>
                <div className="quiz-card-details quiz-card-rules">
                  {quiz.deadline && <span>Due {new Date(quiz.deadline).toLocaleString()}</span>}
                  <span>10 min</span>
                  <span>75% to pass</span>
                </div>
              </div>
              <button
                className={`quiz-view-students${expandedQuizIds.has(quiz.id) ? ' expanded' : ''}`}
                type="button"
                aria-expanded={expandedQuizIds.has(quiz.id)}
                aria-controls={`quiz-results-${quiz.id}`}
                onClick={() => toggleQuizResults(quiz.id)}
              >
                <Users size={15} />
                <span>{expandedQuizIds.has(quiz.id) ? 'Hide students' : 'View students'}</span>
                <span className="quiz-student-count">{quiz.attempts.length}</span>
                {expandedQuizIds.has(quiz.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            {expandedQuizIds.has(quiz.id) && (
              <div id={`quiz-results-${quiz.id}`} className="quiz-results-list">
                {quiz.attempts.length > 0 ? (
                <>
                <div className="quiz-results-toolbar">
                  <div><strong>Student results</strong><small>Export order: {exportSortByQuiz[quiz.id] === 'score' ? 'highest score first' : 'surname A–Z'}</small></div>
                  <div className="quiz-export-actions" aria-label={`Export ${quiz.title} score summary`}>
                    <label className="quiz-export-sort"><span>Sort by</span><select
                      aria-label={`Sort ${quiz.title} export`}
                      value={exportSortByQuiz[quiz.id] || 'name'}
                      onChange={(event) => setExportSortByQuiz((current) => ({ ...current, [quiz.id]: event.target.value }))}
                    >
                      <option value="name">Name (surname)</option>
                      <option value="score">Score (highest first)</option>
                    </select></label>
                    <button className="quiz-export-button" type="button" onClick={() => exportQuizSummary(quiz, 'pdf')}><Download size={14} />PDF</button>
                    <button className="quiz-export-button" type="button" onClick={() => exportQuizSummary(quiz, 'docx')}><FileText size={14} />DOCX</button>
                  </div>
                </div>
                <div className="quiz-result-row quiz-result-heading" aria-hidden="true"><span>Student</span><span>Score</span><span>Submitted</span></div>
                {sortAttempts(quiz.attempts, exportSortByQuiz[quiz.id] || 'name').map((attempt) => (
                  <div className="quiz-result-row" key={attempt.id}>
                    <span>{attempt.student?.fullName || 'Student'}<small>Attempt {attempt.attemptNumber || '—'}{attempt.latePenaltyApplied ? ' · 50% late penalty' : ''}</small></span>
                    <span className="quiz-result-score">{attempt.correctCount}/{attempt.totalQuestions} · {attempt.scorePercent}% <span className={attempt.passed ? 'quiz-pass' : 'quiz-fail'}><CheckCircle2 size={13} />{attempt.passed ? 'Passed' : 'Not passed'}</span></span>
                    <time dateTime={attempt.submittedAt}>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '—'}</time>
                  </div>
                ))}
                </>
                ) : <p className="quiz-no-results"><Users size={17} />No students have submitted this quiz yet.</p>}
              </div>
            )}
          </article>
        ))}
      </div>
      )}
      {previewQuiz && (
        <div
          className="quiz-preview-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewQuizId(null)
          }}
        >
          <section className="quiz-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-preview-title">
            <header className="quiz-preview-dialog-header">
              <div>
                <span>QUIZ CONTENT</span>
                <h3 id="quiz-preview-title">{previewQuiz.title}</h3>
                <p>{previewQuiz.description || 'Questions and correct answers'} · {previewQuiz.questionCount} questions</p>
              </div>
              <button type="button" aria-label="Close quiz preview" onClick={() => setPreviewQuizId(null)}><X size={19} /></button>
            </header>
            <div className="quiz-preview-dialog-content">
              {previewQuiz.questions?.map((question, index) => (
                <article className="quiz-preview-question" key={`${previewQuiz.id}-question-${index}`}>
                  <div className="quiz-preview-question-prompt"><span>{index + 1}</span><strong>{question.prompt}</strong></div>
                  <div className="quiz-preview-question-options">
                    {question.options.map((option) => (
                      <span className={option === question.correctAnswer ? 'correct' : ''} key={option}>
                        {option}{option === question.correctAnswer && <CheckCircle2 size={14} />}
                      </span>
                    ))}
                  </div>
                  <div className="quiz-preview-correct-answer"><CheckCircle2 size={15} /><span>Correct answer</span><strong>{question.correctAnswer}</strong></div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
      {(pendingTab || pendingNavigation) && (
        <div
          className="quiz-draft-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingTab(null)
              setPendingNavigation(null)
            }
          }}
        >
          <section className="quiz-draft-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-draft-confirmation-title" aria-describedby="quiz-draft-confirmation-description">
            <span className="quiz-draft-confirmation-icon"><AlertTriangle size={21} /></span>
            <h3 id="quiz-draft-confirmation-title">Leave quiz creation?</h3>
            <p id="quiz-draft-confirmation-description">Your quiz draft has not been published. If you leave now, the information and questions you entered will be lost and cannot be recovered.</p>
            <div className="quiz-draft-confirmation-actions">
              <button type="button" className="quiz-draft-stay-button" autoFocus onClick={() => { setPendingTab(null); setPendingNavigation(null) }}>Stay and keep editing</button>
              <button type="button" className="quiz-draft-leave-button" onClick={confirmDiscardDraft}>Leave and discard draft</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
