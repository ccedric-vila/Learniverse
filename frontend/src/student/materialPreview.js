import { strFromU8, unzipSync } from 'fflate'

function xmlParagraphs(xmlText) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (document.querySelector('parsererror')) return []
  return Array.from(document.getElementsByTagName('*'))
    .filter((element) => element.localName === 'p')
    .map((paragraph) => Array.from(paragraph.getElementsByTagName('*'))
      .filter((element) => element.localName === 't')
      .map((element) => element.textContent || '')
      .join(''))
    .filter((paragraph) => paragraph.trim())
}

export function extractOfficeText(buffer, extension) {
  const wanted = extension === '.docx' ? 'word/document.xml' : /^ppt\/slides\/slide\d+\.xml$/
  let extractedBytes = 0
  let extractedFiles = 0
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (file) => {
      const matchesDocument = typeof wanted === 'string' ? file.name === wanted : wanted.test(file.name)
      if (!matchesDocument || file.originalSize > 5_000_000 || extractedFiles >= 100 || extractedBytes + file.originalSize > 20_000_000) return false
      extractedFiles += 1
      extractedBytes += file.originalSize
      return true
    },
  })
  if (extension === '.docx') {
    const documentXml = files['word/document.xml']
    return { kind: 'text', paragraphs: documentXml ? xmlParagraphs(strFromU8(documentXml)) : [] }
  }
  const slideNames = Object.keys(files).sort((first, second) => {
    const firstNumber = Number(first.match(/slide(\d+)\.xml$/)?.[1] || 0)
    const secondNumber = Number(second.match(/slide(\d+)\.xml$/)?.[1] || 0)
    return firstNumber - secondNumber
  })
  return { kind: 'slides', slides: slideNames.map((name) => xmlParagraphs(strFromU8(files[name]))).filter((paragraphs) => paragraphs.length) }
}
