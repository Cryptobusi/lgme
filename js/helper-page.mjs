import { setOn } from './local-ai.mjs';
import { saveAgent } from './local-agents.mjs';
import { ALLOWED, defaultTerms, engineChoices, extractFields, FREQUENCIES, HELPERS, LOCKED, STEPS, summaryCard } from './helper-wizard.mjs';
import { helperFile, saveHelper } from './helper-store.mjs';

const state = {
  step: 0,
  engine: 'rules',
  engineLabel: 'Offline helper',
  helperId: 'gym',
  goal: HELPERS[0].goal,
  words: '',
  fields: extractFields(''),
  terms: defaultTerms()
};

const root = document.getElementById('wizard');
const Speech = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function nav(extra) {
  const bar = el('p', {});
  if (state.step > 0) bar.append(el('button', { type: 'button', id: 'helper-back' }, ['Back']));
  bar.append(el('button', { type: 'button', id: 'helper-skip' }, ['Skip']));
  if (extra) bar.append(extra);
  bar.querySelector('#helper-back')?.addEventListener('click', () => { state.step -= 1; draw(); });
  bar.querySelector('#helper-skip')?.addEventListener('click', () => { state.step = Math.min(STEPS.length - 1, state.step + 1); draw(); });
  return bar;
}

function draw() {
  const step = STEPS[state.step];
  const view = el('section', { id: `helper-step-${state.step + 1}` }, [
    el('p', { class: 'kicker' }, [`Step ${state.step + 1} of ${STEPS.length}`]),
    el('h1', {}, [step.title]),
    el('p', {}, [step.line])
  ]);
  if (state.step === 0) view.append(engineStep());
  if (state.step === 1) view.append(startStep());
  if (state.step === 2) view.append(youStep());
  if (state.step === 3) view.append(termsStep());
  if (state.step === 4) view.append(reviewStep());
  view.append(el('p', {}, [el('a', { href: '/?picker=1' }, ['All categories'])]));
  root.replaceChildren(view);
}

function engineStep() {
  const box = el('div', {});
  for (const choice of engineChoices()) {
    const input = el('input', { type: 'radio', name: 'engine', value: choice.id });
    if (choice.id === state.engine || (choice.picked && !state.engineChosen)) input.checked = true;
    if (input.checked) { state.engine = choice.id; state.engineLabel = choice.label; }
    input.addEventListener('change', () => { state.engine = choice.id; state.engineLabel = choice.label; state.engineChosen = true; });
    box.append(el('label', { class: 'choice check' }, [input, `${choice.label}. ${choice.detail}`]));
  }
  box.append(nav(el('button', { type: 'button', class: 'primary', id: 'helper-next' }, ['Next'])));
  box.querySelector('#helper-next').addEventListener('click', () => { state.step = 1; draw(); });
  return box;
}

function startStep() {
  const box = el('div', {});
  const custom = el('textarea', { id: 'helper-custom', maxlength: '400' });
  custom.value = state.goal;
  for (const helper of HELPERS) {
    const button = el('button', { type: 'button' }, [helper.name]);
    button.addEventListener('click', () => {
      state.helperId = helper.id;
      state.goal = helper.goal;
      custom.value = helper.goal;
    });
    box.append(el('article', { class: 'card' }, [el('h2', {}, [helper.name]), el('p', {}, [helper.blurb]), button]));
  }
  box.append(el('label', {}, ['Your words for this helper', custom]));
  const next = el('button', { type: 'button', class: 'primary', id: 'helper-next' }, ['Next']);
  box.append(nav(next));
  next.addEventListener('click', () => { state.goal = custom.value.trim(); state.step = 2; draw(); });
  return box;
}

function youStep() {
  const box = el('div', {});
  const words = el('textarea', { id: 'helper-words', maxlength: '800' });
  words.value = state.words;
  words.addEventListener('input', () => { state.words = words.value; state.fields = extractFields(words.value); fill(); });
  box.append(words);
  if (Speech) {
    const speak = el('button', { type: 'button', id: 'helper-speak' }, ['Speak']);
    speak.addEventListener('click', () => {
      const heard = new Speech();
      heard.onresult = (event) => {
        words.value = `${words.value} ${event.results[0][0].transcript}`.trim();
        state.words = words.value;
        state.fields = extractFields(words.value);
        fill();
      };
      heard.start();
    });
    box.append(speak);
  } else box.append(el('p', { class: 'muted' }, ['Voice input is not on this browser. Type instead.']));
  const fields = el('div', { id: 'helper-fields', class: 'pair' });
  box.append(el('p', { class: 'muted' }, ['Your words stay beside the draft. Your signature and the two sponsors are still your own steps.']));
  box.append(fields);
  const inputs = {};
  function fill() {
    fields.replaceChildren(el('p', {}, ['Your words']), el('p', { id: 'helper-original' }, [state.words || 'Nothing typed yet.']));
    for (const [key, label] of [['profile', 'Profile'], ['primary', 'Primary offering'], ['secondary', 'Secondary offering'], ['unit', 'Unit'], ['hours', 'Hours'], ['monthly', 'Monthly capacity'], ['goals', 'Goals'], ['categories', 'Progress categories']]) {
      const input = el('input', { id: `field-${key}` });
      const value = state.fields[key];
      input.value = Array.isArray(value) ? value.join(', ') : value;
      input.addEventListener('input', () => { state.fields[key] = input.value; });
      inputs[key] = input;
      fields.append(el('label', {}, [label, input]));
    }
  }
  fill();
  const next = el('button', { type: 'button', class: 'primary', id: 'helper-next' }, ['Next']);
  box.append(nav(next));
  next.addEventListener('click', () => { state.step = 3; draw(); });
  return box;
}

function termsStep() {
  const box = el('div', {});
  for (const [key, label] of ALLOWED) {
    const input = el('input', { type: 'checkbox', id: `term-${key}` });
    input.checked = state.terms[key] === true;
    input.addEventListener('change', () => { state.terms[key] = input.checked; });
    box.append(el('label', { class: 'check' }, [input, label]));
  }
  const locked = el('div', { class: 'card locked' }, [el('p', {}, ['Locked'])]);
  for (const line of LOCKED) locked.append(el('p', {}, [line]));
  locked.append(el('p', {}, ['You tap to confirm every action.']));
  box.append(locked);
  const start = el('input', { id: 'quiet-start', type: 'time' });
  const end = el('input', { id: 'quiet-end', type: 'time' });
  start.value = state.terms.quietStart;
  end.value = state.terms.quietEnd;
  start.addEventListener('change', () => { state.terms.quietStart = start.value; });
  end.addEventListener('change', () => { state.terms.quietEnd = end.value; });
  const often = el('select', { id: 'helper-often' });
  for (const item of FREQUENCIES) often.append(el('option', { value: item }, [item]));
  often.value = state.terms.frequency;
  often.addEventListener('change', () => { state.terms.frequency = often.value; });
  box.append(el('label', {}, ['Quiet from', start]));
  box.append(el('label', {}, ['Quiet until', end]));
  box.append(el('label', {}, ['How often it may notify', often]));
  const next = el('button', { type: 'button', class: 'primary', id: 'helper-next' }, ['Next']);
  box.append(nav(next));
  next.addEventListener('click', () => { state.step = 4; draw(); });
  return box;
}

function reviewStep() {
  const card = summaryCard({ name: HELPERS.find((item) => item.id === state.helperId)?.name || 'Helper', engineLabel: state.engineLabel, terms: state.terms });
  const box = el('article', { id: 'helper-summary', class: 'card' }, [
    el('h2', {}, [card.name]),
    el('p', {}, [`Engine: ${card.engine}.`]),
    el('p', {}, [`It may ${card.does}.`]),
    el('p', {}, [card.schedule]),
    el('p', { class: 'muted' }, ['It never sends, posts, accepts, signs, spends, or mints credit.'])
  ]);
  const turn = el('button', { type: 'button', class: 'primary', id: 'turn-on-helper' }, ['Turn on']);
  turn.addEventListener('click', async () => {
    const config = {
      name: card.name,
      engine: state.engine,
      engineLabel: state.engineLabel,
      goal: state.goal,
      words: state.words,
      fields: state.fields,
      terms: state.terms,
      paused: false
    };
    setOn(localStorage, true);
    if (state.goal) saveAgent(localStorage, state.goal);
    await saveHelper(config);
    location.assign('/gym#/helper');
  });
  box.append(nav(turn));
  return box;
}

const detected = engineChoices().find((choice) => choice.picked) || engineChoices()[2];
state.engine = detected.id;
state.engineLabel = detected.label;
draw();
