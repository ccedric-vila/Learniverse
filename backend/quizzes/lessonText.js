const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { strFromU8, unzipSync } = require('fflate');

const MAX_SOURCE_CHARS = 50000;
const MAX_OCR_PAGES = 20;

function cleanText(text) {
  return text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeXml(text) {
  return text
    .replace(/<\/a:p\s*>/gi, '\n')
    .replace(/<a:br\b[^>]*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

async function extractPdfText(buffer) {
  const parsed = await pdfParse(buffer, { max: MAX_OCR_PAGES });
  const extracted = cleanText(parsed.text || '');
  if (extracted.length >= 100) return extracted.slice(0, MAX_SOURCE_CHARS);

  const canvasLibrary = require('@napi-rs/canvas');
  global.DOMMatrix = global.DOMMatrix || canvasLibrary.DOMMatrix;
  global.Path2D = global.Path2D || canvasLibrary.Path2D;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  if (pdf.numPages > MAX_OCR_PAGES) {
    throw new Error(`Scanned PDFs are limited to ${MAX_OCR_PAGES} pages for practice generation.`);
  }

  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  const ocrPages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = canvasLibrary.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const { data } = await worker.recognize(canvas.toBuffer('image/png'));
      if (data.text) ocrPages.push(data.text);
      if (ocrPages.join('\n').length >= MAX_SOURCE_CHARS) break;
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }
  return cleanText(ocrPages.join('\n')).slice(0, MAX_SOURCE_CHARS);
}

async function extractLessonText(buffer, fileName) {
  const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  let text = '';
  if (extension === '.pdf') {
    text = await extractPdfText(buffer);
  } else if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
  } else if (extension === '.pptx') {
    const files = unzipSync(new Uint8Array(buffer), {
      filter: (file) => /^ppt\/slides\/slide\d+\.xml$/.test(file.name) && file.originalSize <= 2_000_000,
    });
    const slides = Object.keys(files).sort((first, second) => {
      const firstNumber = Number(first.match(/slide(\d+)\.xml$/)?.[1] || 0);
      const secondNumber = Number(second.match(/slide(\d+)\.xml$/)?.[1] || 0);
      return firstNumber - secondNumber;
    });
    text = slides.map((slide, index) => `Slide ${index + 1}: ${decodeXml(strFromU8(files[slide]))}`).join('\n');
  } else {
    throw new Error('Practice generation supports PDF, DOCX, and PPTX lesson files. Legacy DOC/PPT files are not supported yet.');
  }

  const normalized = cleanText(text).slice(0, MAX_SOURCE_CHARS);
  if (normalized.length < 100) {
    throw new Error('Not enough readable text was found in this lesson to generate practice questions.');
  }
  return normalized;
}

module.exports = { extractLessonText, MAX_SOURCE_CHARS };
