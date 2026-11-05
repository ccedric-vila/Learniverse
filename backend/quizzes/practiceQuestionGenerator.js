const { normalizeQuizQuestions } = require('./quizLogic');

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'all', 'also', 'although', 'among', 'and',
  'any', 'are', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'can', 'could', 'does', 'during', 'each', 'either', 'from', 'have', 'having', 'here',
  'into', 'its', 'more', 'most', 'other', 'over', 'same', 'should', 'some', 'such',
  'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'under', 'until', 'very', 'were', 'what', 'when', 'where', 'which', 'while',
  'with', 'would', 'your', 'slide',
]);

function generationError(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getFacts(sourceText) {
  const sentences = sourceText
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((sentence) => sentence.replace(/^[\s•*\-–—\d.)]+/, '').trim())
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 500
      && sentence.split(/\s+/).length >= 5);
  const seenSentences = new Set();
  const uniqueSentences = sentences.filter((sentence) => {
    const normalized = sentence.toLowerCase();
    if (seenSentences.has(normalized)) return false;
    seenSentences.add(normalized);
    return true;
  });
  const frequency = new Map();
  for (const match of sourceText.matchAll(/\b[A-Za-z][A-Za-z'-]{3,}\b/g)) {
    const word = match[0].toLowerCase();
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  const usedTerms = new Set();
  const facts = [];
  for (const sentence of uniqueSentences) {
    const words = [...sentence.matchAll(/\b[A-Za-z][A-Za-z'-]{3,}\b/g)]
      .filter((match) => !STOP_WORDS.has(match[0].toLowerCase()) && !usedTerms.has(match[0].toLowerCase()));
    words.sort((first, second) => {
      const firstFrequency = frequency.get(first[0].toLowerCase()) || 1;
      const secondFrequency = frequency.get(second[0].toLowerCase()) || 1;
      const firstScore = first[0].length - Math.log2(firstFrequency) * 2;
      const secondScore = second[0].length - Math.log2(secondFrequency) * 2;
      return secondScore - firstScore;
    });
    const keyword = words[0];
    if (!keyword) continue;
    usedTerms.add(keyword[0].toLowerCase());
    facts.push({ sentence, keyword: keyword[0], start: keyword.index });
  }
  return facts;
}

function createQuestionsFromLesson(sourceText, multipleChoiceCount, trueFalseCount, shareSelectedFacts = false) {
  const facts = getFacts(sourceText);
  const requiredFacts = Math.max(multipleChoiceCount, trueFalseCount);
  if (facts.length < requiredFacts) {
    throw generationError(`This lesson does not contain enough distinct readable statements to create ${requiredFacts} questions. Try a lesson with more text.`);
  }

  const selectedFacts = shareSelectedFacts ? shuffle(facts).slice(0, requiredFacts) : null;
  const termPool = [...new Map([...sourceText.matchAll(/\b[A-Za-z][A-Za-z'-]{3,}\b/g)]
    .map((match) => match[0])
    .filter((word) => !STOP_WORDS.has(word.toLowerCase()) && word.length <= 40)
    .map((word) => [word.toLowerCase(), word])).values()];
  const multipleChoiceFacts = selectedFacts
    ? selectedFacts.slice(0, multipleChoiceCount)
    : shuffle(facts).slice(0, multipleChoiceCount);
  const multipleChoice = multipleChoiceFacts.map(({ sentence, keyword, start }) => {
    const sentenceWords = new Set([...sentence.matchAll(/\b[A-Za-z][A-Za-z'-]{3,}\b/g)]
      .map((match) => match[0].toLowerCase()));
    const distractors = shuffle(termPool.filter((term) => (
      term.toLowerCase() !== keyword.toLowerCase() && !sentenceWords.has(term.toLowerCase())
    ))).slice(0, 3);
    if (distractors.length < 3) {
      throw generationError('This lesson does not contain enough distinct terms to create multiple-choice practice questions.');
    }

    const statementWithBlank = `${sentence.slice(0, start)}_____ ${sentence.slice(start + keyword.length)}`.trim();
    return {
      prompt: `Which term completes this lesson statement?\n\n${statementWithBlank}`,
      type: 'multiple_choice',
      options: shuffle([keyword, ...distractors]),
      correctAnswer: keyword,
    };
  });

  const trueFalseFacts = selectedFacts
    ? selectedFacts.slice(0, trueFalseCount)
    : shuffle(facts).slice(0, trueFalseCount);
  const trueFalse = trueFalseFacts.map(({ sentence, keyword, start }, index) => {
    let statement = sentence;
    let correctAnswer = 'True';
    if (index % 2 === 1) {
      const sentenceWords = new Set([...sentence.matchAll(/\b[A-Za-z][A-Za-z'-]{3,}\b/g)]
        .map((match) => match[0].toLowerCase()));
      const replacement = shuffle(termPool.filter((term) => (
        term.toLowerCase() !== keyword.toLowerCase() && !sentenceWords.has(term.toLowerCase())
      )))[0];
      if (!replacement) {
        throw generationError('This lesson does not contain enough distinct terms to create true/false practice questions.');
      }
      statement = `${sentence.slice(0, start)}${replacement}${sentence.slice(start + keyword.length)}`;
      correctAnswer = 'False';
    }
    return {
      prompt: `True or False: ${statement}`,
      type: 'true_false',
      options: ['True', 'False'],
      correctAnswer,
    };
  });

  return normalizeQuizQuestions([...multipleChoice, ...trueFalse]);
}

function createPracticeQuestions(sourceText) {
  return createQuestionsFromLesson(sourceText, 10, 10, true);
}

function generateQuizQuestions(sourceText, multipleChoiceCount, trueFalseCount) {
  if (!Number.isInteger(multipleChoiceCount) || multipleChoiceCount < 0 || multipleChoiceCount > 20
    || !Number.isInteger(trueFalseCount) || trueFalseCount < 0 || trueFalseCount > 20
    || multipleChoiceCount + trueFalseCount !== 20) {
    throw generationError('Choose question counts that add up to exactly 20.');
  }
  return createQuestionsFromLesson(sourceText, multipleChoiceCount, trueFalseCount);
}

async function generatePracticeQuestions(sourceText) {
  return createPracticeQuestions(sourceText);
}

module.exports = { createPracticeQuestions, generatePracticeQuestions, generateQuizQuestions };
