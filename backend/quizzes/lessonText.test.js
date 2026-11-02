const test = require('node:test');
const assert = require('node:assert/strict');
const { strToU8, zipSync } = require('fflate');
const { extractLessonText } = require('./lessonText');
const { createPracticeQuestions } = require('./practiceQuestionGenerator');

test('PPTX paragraph extraction creates usable local practice questions', async () => {
  const paragraphs = [
    'Hydrology studies the movement and distribution of water across the Earth.',
    'Thermodynamics explains relationships between heat, work, temperature, and energy.',
    'Concrete combines cement, water, sand, and aggregates into a durable construction material.',
    'Surveying measures distances and angles to determine positions on land.',
    'Microcontrollers combine processors, memory, and input output peripherals in embedded systems.',
    'Ecology examines relationships between organisms and their surrounding environments.',
    'Electromagnetism describes interactions between electric charges and magnetic fields.',
    'Algorithms provide ordered steps for solving computational problems efficiently.',
    'Biodiversity represents the variety of living species within a particular ecosystem.',
    'Pneumatics uses compressed air to transmit power and control industrial equipment.',
    'Geology investigates materials, structures, and processes that shape the Earth.',
    'Insulation reduces unwanted transfer of heat through building materials.',
  ];
  const slideXml = `<p:sld xmlns:p="p" xmlns:a="a">${paragraphs.map((text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`).join('')}</p:sld>`;
  const presentation = zipSync({ 'ppt/slides/slide1.xml': strToU8(slideXml) });

  const text = await extractLessonText(Buffer.from(presentation), 'lesson.pptx');
  const questions = createPracticeQuestions(text);

  assert.equal(text.split('\n').length, paragraphs.length);
  assert.equal(questions.length, 20);
});
