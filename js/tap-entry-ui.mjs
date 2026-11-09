import {
  ACTIONS,
  CATEGORIES,
  METHODS,
  REVIEW_INTRO,
  SAMPLE_HABIT,
  SAMPLE_RECEIPT,
  SAMPLE_SENTENCE,
  acceptSuggestion,
  buildSuggestion,
  canUseSuggestion,
  capabilityRows,
  captureFromText,
  commitTape,
  counterText,
  createCounter,
  detectFeatures,
  forgetLearned,
  loadState,
  locationRead,
  modeFor,
  passkeyCreationOptions,
  passkeyReady,
  phaseAfterCapture,
  prepareLocalSpeech,
  readPhotoText,
  reduceCounter,
  resetState,
  reviewTableHtml,
  runPasskey,
  sampleCapture,
  sampleLink,
  saveState,
  setConsent,
  startLocalRecognition,
  suggestionFor,
  textFromNdef,
  undoLast,
  withPartner
} from './tap-entry.mjs';

const PARTNER = 'Elena';

function storageOf(env) {
  try {
    const storage = env.localStorage;
    const probe = `${STORAGE_PROBE}`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return memoryStorage();
  }
}

const STORAGE_PROBE = 'lgme.tap-entry.probe';

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function el(tag, attrs, kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of kids || []) node.append(kid && kid.nodeType ? kid : document.createTextNode(kid == null ? '' : String(kid)));
  return node;
}

function freshFlow() {
  return {
    method: null,
    phase: 'pick',
    capture: null,
    suggestion: null,
    note: '',
    simulated: false,
    sub: '',
    counter: createCounter(),
    passkey: null,
    passkeyChecked: false,
    focusKey: ''
  };
}

function stepOf(phase) {
  if (phase === 'confirm-self' || phase === 'confirm-partner' || phase === 'done') return 3;
  if (phase === 'consent' || phase === 'correct' || phase === 'plain' || phase === 'edit') return 2;
  return 1;
}

export function mount(root, env) {
  const scope = env || window;
  const storage = storageOf(scope);
  let state = loadState(storage);
  let flow = freshFlow();
  let features = detectFeatures(scope);
  let stopMedia = () => {};
  let fieldCounted = false;
  let resetArmed = false;
  let listening = null;

  const capability = root.querySelector('#capability');
  const progress = root.querySelector('#progress');
  const counter = root.querySelector('#counter');
  const panel = root.querySelector('#panel');
  const status = root.querySelector('#status');
  const tape = root.querySelector('#tape');
  const learned = root.querySelector('#learned');
  const review = root.querySelector('#review');

  function persist() { saveState(storage, state); }

  function halt() {
    stopMedia();
    stopMedia = () => {};
    if (listening) {
      try { listening.stop(); } catch { /* already stopped */ }
      listening = null;
    }
  }

  function count(action) {
    flow.counter = reduceCounter(flow.counter, action);
    if (counter) counter.textContent = counterText(flow.counter);
  }

  function afterCapture() {
    flow.phase = phaseAfterCapture(state);
    flow.sub = '';
    if (flow.phase === 'correct') {
      const result = suggestionFor(state, flow.capture);
      flow.suggestion = result.blocked ? null : result.suggestion;
    } else if (flow.phase === 'plain') {
      flow.suggestion = buildSuggestion(flow.capture);
    }
    render();
  }

  function useSample(method, simulated, note) {
    halt();
    flow.capture = sampleCapture(method);
    flow.simulated = simulated;
    flow.note = note || modeFor(method, features).reason;
    afterCapture();
  }

  async function beginNfc() {
    if (typeof scope.NDEFReader !== 'function') {
      useSample('nfc', true, modeFor('nfc', features).reason);
      return;
    }
    flow.note = 'Hold the tag to this phone. This page reads the entry link and does not open it.';
    flow.sub = 'nfc-wait';
    render();
    try {
      const reader = new scope.NDEFReader();
      await reader.scan();
      reader.onreading = (event) => {
        const text = textFromNdef(event.message && event.message.records);
        flow.capture = captureFromText(text, 'nfc');
        flow.simulated = false;
        flow.note = 'The tag was read on this device. The link was not opened.';
        afterCapture();
      };
      reader.onreadingerror = () => {
        flow.note = 'The tag did not read. You can simulate a tap. iPhone can open a link from a tag, and it cannot read the tag into this page.';
        flow.sub = 'nfc-failed';
        render();
      };
    } catch (error) {
      flow.note = `The tag was not read (${error && error.name ? error.name : 'Error'}). You can simulate a tap.`;
      flow.sub = 'nfc-failed';
      render();
    }
  }

  async function beginScan() {
    if (!features.camera || typeof scope.jsQR !== 'function' || !scope.navigator.mediaDevices) {
      useSample('qr', true, modeFor('qr', features).reason);
      return;
    }
    flow.sub = 'scan';
    flow.note = 'Point the camera at the other device. The code is read here and is not uploaded.';
    render();
    try {
      const stream = await scope.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = panel.querySelector('video');
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let stopped = false;
      stopMedia = () => {
        stopped = true;
        stream.getTracks().forEach((track) => track.stop());
        video.hidden = true;
      };
      const tick = () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = scope.jsQR(image.data, image.width, image.height);
            if (found && found.data) {
              halt();
              flow.capture = captureFromText(found.data, 'qr');
              flow.simulated = false;
              flow.note = 'The code was read on this device. Nothing was uploaded.';
              afterCapture();
              return;
            }
          }
        } catch {
          halt();
          flow.note = 'The camera frame could not be read. You can use the sample scan.';
          flow.sub = 'scan-failed';
          render();
          return;
        }
        scope.requestAnimationFrame(tick);
      };
      scope.requestAnimationFrame(tick);
    } catch {
      flow.note = 'The camera did not open. You can use the sample scan. Nothing was uploaded.';
      flow.sub = 'scan-failed';
      render();
    }
  }

  async function beginCamera() {
    if (!features.camera || !scope.navigator.mediaDevices) {
      useSample('camera', true, modeFor('camera', features).reason);
      return;
    }
    flow.sub = 'preview';
    flow.note = features.textDetector
      ? 'Frame the receipt, then take the photo. TextDetector reads it on this device. The photo is not uploaded.'
      : 'This browser has no TextDetector. You can still take a photo. It will not be read, and the sample receipt line is what gets parsed.';
    render();
    try {
      const stream = await scope.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = panel.querySelector('video');
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      stopMedia = () => {
        stream.getTracks().forEach((track) => track.stop());
      };
    } catch {
      useSample('camera', true, 'The camera did not open. The sample receipt line is used. Nothing was uploaded.');
    }
  }

  async function shutter() {
    const video = panel.querySelector('video');
    const canvas = document.createElement('canvas');
    if (video && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
    }
    halt();
    if (!features.textDetector || typeof scope.TextDetector !== 'function') {
      useSample('camera', true, modeFor('camera', features).reason);
      return;
    }
    try {
      const detector = new scope.TextDetector();
      const result = await readPhotoText(detector, canvas);
      flow.capture = captureFromText(result.text, 'camera');
      flow.simulated = result.simulated;
      flow.note = result.reason;
      afterCapture();
    } catch {
      useSample('camera', true, 'TextDetector did not finish. The sample receipt line is used. The photo is not uploaded.');
    }
  }

  async function beginVoice() {
    const Speech = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    const mode = await prepareLocalSpeech(Speech);
    features = { ...features, speech: typeof Speech === 'function', localSpeech: mode.live ? true : features.speech ? false : undefined };
    if (!mode.live) {
      useSample('voice', true, mode.reason);
      return;
    }
    flow.sub = 'listening';
    flow.note = mode.reason;
    render();
    try {
      listening = startLocalRecognition(Speech, {
        onresult(text) {
          listening = null;
          flow.capture = captureFromText(text, 'voice');
          flow.simulated = false;
          flow.note = 'On-device speech produced this text. It was not sent to a vendor.';
          afterCapture();
        },
        onerror() {
          listening = null;
          useSample('voice', true, 'On-device speech did not return text. The sample sentence is used.');
        }
      });
    } catch {
      useSample('voice', true, 'On-device speech did not start. The sample sentence is used.');
    }
  }

  async function beginPasskey() {
    if (!scope.crypto || !scope.location || !scope.location.hostname) {
      flow.note = 'Simulated passkey. This page has no device authenticator to call. No server is contacted.';
      flow.simulated = true;
      flow.phase = 'confirm-partner';
      render();
      return;
    }
    if (flow.passkey && flow.passkey.live === false) {
      flow.note = flow.passkey.reason;
      flow.simulated = true;
      flow.phase = 'confirm-partner';
      render();
      return;
    }
    const challenge = scope.crypto.getRandomValues(new Uint8Array(32));
    const hostname = scope.location && scope.location.hostname;
    const options = passkeyCreationOptions(hostname, challenge);
    try {
      const result = await runPasskey(scope.navigator.credentials, options);
      flow.note = result.reason;
      flow.simulated = result.simulated;
      if (result.ok) flow.phase = 'confirm-partner';
      else flow.sub = 'passkey-failed';
    } catch {
      flow.note = 'Simulated passkey. The prompt could not start. No server is contacted.';
      flow.simulated = true;
      flow.sub = 'passkey-failed';
    }
    render();
  }

  function typedValue() {
    const field = panel.querySelector('[data-field]');
    return field ? field.value : '';
  }

  function onAction(action) {
    resetArmed = false;
    if (METHODS.some((method) => method.id === action)) {
      halt();
      fieldCounted = false;
      flow = freshFlow();
      flow.method = action;
      flow.phase = 'capture';
      count(action);
      render();
      return;
    }
    if (action === 'change-method' || action === 'another') {
      halt();
      fieldCounted = false;
      flow = freshFlow();
      render();
      return;
    }
    if (!ACTIONS[action]) return;
    count(action);
    if (action === 'nfc-live') { beginNfc(); return; }
    if (action === 'nfc-go' || action === 'nfc-sim') { useSample('nfc', true, modeFor('nfc', { nfc: false }).reason); return; }
    if (action === 'qr-go' || action === 'qr-sim') { useSample('qr', true, 'Simulated scan. The sample handshake is used. Nothing was uploaded.'); return; }
    if (action === 'qr-live') { beginScan(); return; }
    if (action === 'share-go') { useSample('share', true, modeFor('share', features).reason); return; }
    if (action === 'share-send') { sendShare(); return; }
    if (action === 'share-use' || action === 'manual-use' || action === 'voice-use') {
      const kind = action.startsWith('share') ? 'share' : action.startsWith('manual') ? 'manual' : 'voice';
      flow.capture = captureFromText(typedValue(), kind);
      flow.simulated = false;
      flow.note = 'The text in the box is the capture. It stays on this device.';
      afterCapture();
      return;
    }
    if (action === 'camera-go' || action === 'camera-sample') {
      useSample('camera', true, modeFor('camera', { textDetector: false }).reason);
      return;
    }
    if (action === 'camera-try') { beginCamera(); return; }
    if (action === 'camera-shutter') { shutter(); return; }
    if (action === 'camera-sample') { halt(); useSample('camera', true, modeFor('camera', { textDetector: false }).reason); return; }
    if (action === 'voice-go') { beginVoice(); return; }
    if (action === 'smart-go') { useSample('smart', true, `Simulated calendar hint: “${SAMPLE_HABIT}”. This page does not read a calendar.`); return; }
    if (action === 'smart-location') { askLocation(); return; }
    if (action === 'smart-partner' || action === 'plain-partner') {
      const base = flow.suggestion || buildSuggestion(flow.capture);
      flow.suggestion = withPartner(base, PARTNER);
      render();
      return;
    }
    if (action === 'passkey-go') {
      flow.capture = sampleCapture('passkey');
      flow.simulated = false;
      flow.note = 'Sample draft. A passkey does not contain the deed. Nothing was sent to a server.';
      afterCapture();
      return;
    }
    if (action === 'manual-go') { useSample('manual', false, 'The sample line is on this page. You can still change it before you confirm.'); return; }
    if (action === 'show-type') { flow.typing = true; render(); return; }
    if (action === 'consent-allow') {
      state = setConsent(state, 'allow');
      persist();
      flow.phase = 'correct';
      flow.suggestion = suggestionFor(state, flow.capture).suggestion;
      render();
      return;
    }
    if (action === 'consent-deny') {
      state = setConsent(state, 'deny');
      persist();
      flow.phase = 'plain';
      flow.suggestion = buildSuggestion(flow.capture);
      flow.note = 'On-device suggestions stay off. Nothing was learned. These fields are the capture.';
      render();
      return;
    }
    if (action === 'use-suggestion') {
      if (state.consent !== 'allow' || !canUseSuggestion(flow.suggestion)) return;
      state = acceptSuggestion(state, flow.suggestion);
      persist();
      flow.note = '';
      flow.phase = 'confirm-self';
      render();
      return;
    }
    if (action === 'plain-continue') {
      if (!canUseSuggestion(flow.suggestion)) return;
      flow.phase = 'confirm-self';
      render();
      return;
    }
    if (action === 'edit') { flow.phase = 'edit'; flow.editField = null; render(); return; }
    if (action === 'save-partner') {
      const typed = panel.querySelector('#partner-name');
      const name = typed && typed.value.trim() ? typed.value.trim() : PARTNER;
      const base = flow.suggestion || buildSuggestion(flow.capture);
      flow.suggestion = withPartner(base, name);
      flow.editField = null;
      flow.phase = state.consent === 'deny' ? 'plain' : 'correct';
      render();
      return;
    }
    if (action === 'set-category') return;
    if (action === 'confirm-self') { flow.note = ''; flow.phase = 'confirm-partner'; render(); return; }
    if (action === 'passkey-confirm') { beginPasskey(); return; }
    if (action === 'passkey-sim') {
      flow.simulated = true;
      flow.note = 'Simulated passkey. This confirm did not use WebAuthn. No server was contacted.';
      flow.phase = 'confirm-partner';
      render();
      return;
    }
    if (action === 'confirm-partner') {
      const source = flow.suggestion || buildSuggestion(flow.capture);
      state = commitTape(state, { ...source, method: flow.method });
      persist();
      flow.note = '';
      flow.phase = 'done';
      render();
      return;
    }
    if (action === 'undo') {
      state = undoLast(state);
      persist();
      if (state.consent == null) flow.phase = 'consent';
      else if (state.consent === 'deny') flow.phase = 'plain';
      else flow.phase = 'correct';
      if (flow.phase === 'correct') flow.suggestion = flow.suggestion || buildSuggestion(flow.capture);
      render();
    }
  }

  async function sendShare() {
    const payload = { title: 'lgme sample draft', text: SAMPLE_SENTENCE, url: sampleLink() };
    if (!scope.navigator.share) {
      flow.note = modeFor('share', features).reason;
      render();
      return;
    }
    try {
      await scope.navigator.share(payload);
      flow.note = 'The share sheet opened on this device. The draft is still a sample.';
    } catch (error) {
      if (error && error.name === 'AbortError') flow.note = 'The share sheet was closed.';
      else flow.note = 'The share sheet did not open. You can paste the sample text instead.';
    }
    render();
  }

  async function askLocation() {
    flow.note = 'Checking location after your press. Coordinates are not stored.';
    if (status) status.textContent = flow.note;
    const result = await locationRead(scope.navigator && scope.navigator.geolocation);
    flow.note = result.summary;
    render();
  }

  function badge(simulated) {
    return simulated ? el('span', { class: 'badge' }, ['Simulated']) : el('span', { class: 'badge' }, ['This device']);
  }

  function primary(action, label, simulated) {
    return el('button', { type: 'button', class: 'primary', 'data-action': action }, [label, simulated ? badge(true) : '']);
  }

  function ghost(action, label) {
    return el('button', { type: 'button', class: 'ghost', 'data-action': action }, [label]);
  }

  function renderCapability() {
    const rows = capabilityRows(features);
    const details = el('details', {}, [
      el('summary', { id: 'cap-heading' }, ['This device']),
      el('ul', {}, rows.map((row) => el('li', {}, [
        el('strong', {}, [`${row.label}: ${row.state}. `]),
        row.detail
      ]))),
      el('p', {}, ['Location is not listed as a capture. The location button appears only inside Smart suggestions, and only a press runs it.'])
    ]);
    capability.replaceChildren(details);
  }

  function renderProgress() {
    const step = stepOf(flow.phase);
    const names = ['1 Capture', '2 Correct', '3 Dual confirm'];
    progress.replaceChildren(
      el('div', { class: 'progress-label' }, names.map((name, index) => el('span', { 'aria-current': index + 1 === step ? 'step' : null }, [name]))),
      el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': '3', 'aria-valuenow': String(step), 'aria-valuetext': `Step ${step} of 3` }, [
        el('i', { style: `width:${Math.round((step / 3) * 100)}%` }, [])
      ])
    );
  }

  function renderPick() {
    const hash = scope.location && scope.location.hash && scope.location.hash.includes('draft=');
    const kids = [
      el('h2', {}, ['How do you want to capture this?']),
      el('div', { class: 'methods', role: 'list' }, METHODS.map((method) => el('button', {
        type: 'button',
        class: 'method',
        'data-action': method.id,
        'aria-pressed': flow.method === method.id ? 'true' : 'false'
      }, [el('strong', {}, [method.label]), el('span', {}, [method.question])])))
    ];
    if (hash) {
      kids.push(el('p', {}, ['This address has an entry link. An iPhone can land here from a tag. This page does not open a new address.']));
      kids.push(primary('hash-go', 'Use the link in this address', false));
    }
    return kids;
  }

  function renderCapture() {
    const method = flow.method;
    const mode = modeFor(method, features);
    const kids = [
      el('h2', {}, [METHODS.find((item) => item.id === method).question]),
      el('p', {}, [flow.note || mode.reason])
    ];
    if (method === 'qr') {
      kids.splice(1, 0, el('div', { class: 'qr', 'data-qr': '1', role: 'img', 'aria-label': 'QR for the sample draft' }, []));
      kids.push(el('video', { playsinline: 'true', muted: 'true', autoplay: 'true', 'aria-label': 'Camera preview', hidden: flow.sub === 'scan' ? null : 'hidden' }, []));
    }
    if (method === 'camera') kids.push(el('video', { playsinline: 'true', muted: 'true', autoplay: 'true', 'aria-label': 'Camera preview' }, []));
    if (method === 'share' || ((method === 'voice' || method === 'manual') && flow.typing)) {
      const fieldId = method === 'voice' ? 'voice-type' : method === 'share' ? 'share-type' : 'manual-type';
      kids.push(el('label', { for: 'entry-text' }, [method === 'share' ? 'Paste shared text' : 'One line']));
      kids.push(el('textarea', { id: 'entry-text', 'data-field': fieldId, placeholder: SAMPLE_SENTENCE }, []));
      kids.push(ghost(method === 'share' ? 'share-use' : method === 'manual' ? 'manual-use' : 'voice-use', method === 'share' ? 'Use the pasted text' : method === 'manual' ? 'Use the typed line' : 'Use the spoken line'));
    } else if (method === 'voice' || method === 'manual') {
      kids.push(ghost('show-type', 'Type a line instead'));
    }
    const go = {
      nfc: 'nfc-go',
      qr: 'qr-go',
      share: 'share-go',
      camera: 'camera-go',
      voice: 'voice-go',
      smart: 'smart-go',
      passkey: 'passkey-go',
      manual: 'manual-go'
    }[method];
    const simulated = method === 'qr' || method === 'camera' || method === 'nfc'
      ? true
      : method === 'manual' || method === 'passkey' || method === 'voice'
        ? false
        : !mode.live;
    if (method === 'nfc' && features.nfc) {
      kids.push(primary('nfc-live', ACTIONS['nfc-live'].label, false));
      kids.push(primary('nfc-go', ACTIONS['nfc-go'].label, true));
    } else {
      kids.push(primary(go, ACTIONS[go].label, simulated));
    }
    if (method === 'share') kids.push(ghost('share-send', 'Share this draft'));
    if (method === 'qr' && features.camera && features.jsQR) kids.push(ghost('qr-live', 'Scan with the camera'));
    if (method === 'camera' && features.camera) kids.push(ghost('camera-try', 'Take a photo'));
    if (flow.sub === 'preview') kids.push(primary('camera-shutter', 'Use this frame', !features.textDetector));
    if (method === 'smart') kids.push(ghost('smart-location', 'Check location'));
    kids.push(ghost('change-method', 'Change method'));
    return kids;
  }

  function renderConsent() {
    return [
      el('h2', {}, ['Allow on-device suggestions?']),
      el('p', {}, ['AI suggests, you decide. The pre-fill is a set of rules on this device. Nothing is sent to a server. You can undo a suggestion and forget a learned line.']),
      primary('consent-allow', ACTIONS['consent-allow'].label, false),
      ghost('consent-deny', 'Not now'),
      ghost('change-method', 'Change method')
    ];
  }

  function renderCorrect(plain) {
    const suggestion = flow.suggestion || buildSuggestion(flow.capture);
    flow.suggestion = suggestion;
    if (!suggestion.partner) {
      return [
        el('h2', {}, ['Who is the other person?']),
        el('p', {}, [plain ? 'Suggestions are off. Dual confirm still needs a name. Elena is a sample.' : 'The hint has no partner. Elena is a sample name.']),
        primary(plain ? 'plain-partner' : 'smart-partner', ACTIONS['smart-partner'].label, false),
        ghost('change-method', 'Change method')
      ];
    }
    const kids = [
      el('h2', {}, [plain ? 'Check the capture' : 'Use this suggestion?']),
      el('p', {}, [`${categoryLabelSafe(suggestion.category)} · ${suggestion.hours == null ? 'No hours' : `${suggestion.hours} hours`} · ${suggestion.partner} · ${suggestion.place || 'No place'}`]),
      el('p', {}, [suggestion.note])
    ];
    if (!plain) {
      kids.push(el('h3', {}, ['Why this suggestion?']));
      kids.push(el('ul', { class: 'why' }, (suggestion.reasons || []).map((reason) => el('li', {}, [reason]))));
    } else {
      kids.push(el('p', {}, [flow.note || 'On-device suggestions are off. These fields are the capture, not a suggestion.']));
    }
    if (canUseSuggestion(suggestion)) kids.push(primary(plain ? 'plain-continue' : 'use-suggestion', plain ? 'Use these fields' : ACTIONS['use-suggestion'].label, false));
    kids.push(ghost('edit', 'Change one field'));
    if (state.undo) kids.push(ghost('undo', 'Undo'));
    kids.push(ghost('change-method', 'Change method'));
    return kids;
  }

  function renderEdit() {
    const suggestion = flow.suggestion || buildSuggestion(flow.capture);
    if (!flow.editField) {
      return [
        el('h2', {}, ['Which field?']),
        ghost('pick-field', 'Category'),
        ghost('pick-field', 'Hours'),
        ghost('pick-field', 'Partner'),
        ghost('pick-field', 'Place')
      ].map((node, index) => {
        if (index === 0) return node;
        const names = ['category', 'hours', 'partner', 'place'];
        node.setAttribute('data-edit', names[index - 1]);
        return node;
      }).concat([ghost('back-correct', 'Back to the suggestion')]);
    }
    if (flow.editField === 'category') {
      return [
        el('h2', {}, ['Which category?']),
        el('div', { class: 'stack' }, CATEGORIES.map((item) => el('button', {
          type: 'button',
          class: 'chip',
          'data-action': 'set-category',
          'data-category': item.id,
          'aria-pressed': suggestion.category === item.id ? 'true' : 'false'
        }, [item.label]))),
        ghost('back-correct', 'Back to the suggestion')
      ];
    }
    if (flow.editField === 'hours') {
      return [
        el('h2', {}, ['How many hours?']),
        el('div', { class: 'stack' }, ['1', '2', '3'].map((hours) => el('button', {
          type: 'button',
          class: 'chip',
          'data-hours': hours,
          'aria-pressed': String(suggestion.hours) === hours ? 'true' : 'false'
        }, [`${hours} hours`]))),
        ghost('back-correct', 'Back to the suggestion')
      ];
    }
    if (flow.editField === 'partner') {
      return [
        el('h2', {}, ['Who is the other person?']),
        el('label', { for: 'partner-name' }, ['Name']),
        el('input', { id: 'partner-name', type: 'text', 'data-field': 'partner-type', value: suggestion.partner || PARTNER }, []),
        primary('save-partner', 'Keep this partner', false),
        ghost('back-correct', 'Back to the suggestion')
      ];
    }
    return [
      el('h2', {}, ['Which place?']),
      el('div', { class: 'stack' }, ['greenhouse', 'workshop', 'shed', ''].map((place) => el('button', {
        type: 'button',
        class: 'chip',
        'data-place': place || 'none',
        'aria-pressed': (suggestion.place || '') === place ? 'true' : 'false'
      }, [place || 'No place']))),
      ghost('back-correct', 'Back to the suggestion')
    ];
  }

  function renderConfirmSelf() {
    const passkey = flow.method === 'passkey';
    const simulated = passkey && flow.passkey && flow.passkey.live === false;
    const kids = [
      el('h2', {}, [passkey ? 'Confirm with this device?' : 'Do you confirm this sample entry?']),
      el('p', {}, [flow.note || (passkey ? 'A passkey here does not tell the other person who you are. No server is contacted.' : 'This confirm is the first of two. It stays on this device.')])
    ];
    if (passkey) {
      kids.push(primary('passkey-confirm', ACTIONS['passkey-confirm'].label, simulated || flow.sub === 'passkey-failed'));
      if (flow.sub === 'passkey-failed') kids.push(ghost('passkey-sim', 'Use the labelled simulation'));
    } else {
      kids.push(primary('confirm-self', ACTIONS['confirm-self'].label, false));
    }
    if (state.undo) kids.push(ghost('undo', 'Undo'));
    return kids;
  }

  function renderConfirmPartner() {
    const kids = [
      el('h2', {}, ['Does the other person confirm?']),
      el('p', {}, ['The second confirm on this page is a sample tap on the same device. Two taps here do not show that two people agreed. A real second confirm would happen on the other person’s device. The Third Seat is the arbiter who can veto. This demo does not contact an arbiter.']),
      primary('confirm-partner', ACTIONS['confirm-partner'].label, true)
    ];
    if (state.undo) kids.push(ghost('undo', 'Undo'));
    return kids;
  }

  function renderDone() {
    const last = state.tape[state.tape.length - 1];
    const kids = [
      el('h2', {}, ['On the sample Tape']),
      el('p', {}, [last ? `${categoryLabelSafe(last.category)} · ${last.note}` : 'The line is on the sample Tape.']),
      el('p', {}, ['Marked SAMPLE. It is in local storage on this device. It is not the live book.']),
      primary('another', 'Log another', false)
    ];
    if (state.undo) kids.push(ghost('undo', 'Undo'));
    return kids;
  }

  function renderPanel() {
    let kids = [];
    if (flow.phase === 'pick') kids = renderPick();
    else if (flow.phase === 'capture') kids = renderCapture();
    else if (flow.phase === 'consent') kids = renderConsent();
    else if (flow.phase === 'correct') kids = renderCorrect(false);
    else if (flow.phase === 'plain') kids = renderCorrect(true);
    else if (flow.phase === 'edit') kids = renderEdit();
    else if (flow.phase === 'confirm-self') kids = renderConfirmSelf();
    else if (flow.phase === 'confirm-partner') kids = renderConfirmPartner();
    else kids = renderDone();
    panel.replaceChildren(el('div', { class: 'panel stack' }, kids));
    const box = panel.querySelector('textarea');
    if (box && flow.draftText) box.value = flow.draftText;
    if (flow.method === 'qr' && flow.phase === 'capture' && typeof scope.QRCode === 'function') {
      const host = panel.querySelector('[data-qr]');
      if (host) {
        try {
          const level = scope.QRCode.CorrectLevel && scope.QRCode.CorrectLevel.M;
          new scope.QRCode(host, { text: sampleLink(), width: 180, height: 180, colorDark: '#14180f', colorLight: '#f4f1e8', correctLevel: level });
        } catch {
          host.textContent = 'The QR could not be drawn in this browser. The sample scan still works.';
        }
      }
    }
    const key = `${flow.phase}:${flow.method || ''}:${flow.sub}`;
    const heading = panel.querySelector('h2');
    if (heading && key !== flow.focusKey) {
      flow.focusKey = key;
      heading.tabIndex = -1;
      if (flow.phase !== 'pick') heading.focus();
    }
    if (flow.method === 'passkey' && flow.phase === 'confirm-self' && !flow.passkeyChecked) {
      flow.passkeyChecked = true;
      passkeyReady(scope.PublicKeyCredential).then((result) => {
        flow.passkey = result;
        flow.focusKey = '';
        render();
      });
    }
  }

  function renderTape() {
    const lines = state.tape.length
      ? state.tape.map((line) => el('li', {}, [
        el('span', { class: 'badge' }, ['Sample']),
        ` ${categoryLabelSafe(line.category)} · ${line.hours == null ? 'No hours' : `${line.hours} hours`} · ${line.partner || 'No partner'} · ${line.place || 'No place'}. ${line.note} Via ${methodLabel(line.method)}.`
      ]))
      : [el('li', {}, ['No sample lines yet.'])];
    tape.replaceChildren(el('h2', { id: 'tape-heading' }, ['Sample Tape']), el('ul', {}, lines));
  }

  function renderLearned() {
    const items = state.learned.length
      ? state.learned.map((item) => el('li', {}, [
        el('strong', {}, [item.label]),
        el('p', {}, [item.why]),
        el('button', { type: 'button', class: 'ghost', 'data-forget': item.id }, [`Forget ${item.label}`])
      ]))
      : [el('li', {}, ['Nothing yet. An accepted suggestion is listed here after you allow on-device suggestions.'])];
    const reset = el('button', { type: 'button', class: 'danger', 'data-action': 'reset-demo' }, [resetArmed ? 'Reset again to clear this demo' : 'Reset']);
    learned.replaceChildren(
      el('h2', { id: 'learned-heading' }, ['What it learned']),
      el('ul', {}, items),
      reset
    );
  }

  function renderReview() {
    review.replaceChildren(
      el('h2', { id: 'review-heading' }, ['Review: what works, what doesn’t']),
      ...REVIEW_INTRO.map((paragraph) => el('p', {}, [paragraph])),
      el('div', { id: 'review-table' }, [])
    );
    const host = review.querySelector('#review-table');
    host.innerHTML = reviewTableHtml();
  }

  function render() {
    renderCapability();
    renderProgress();
    if (counter) counter.textContent = counterText(flow.counter);
    if (status) status.textContent = flow.note || '';
    renderPanel();
    renderTape();
    renderLearned();
  }

  root.addEventListener('click', (event) => {
    const forget = event.target.closest('[data-forget]');
    if (forget && root.contains(forget)) {
      state = forgetLearned(state, forget.getAttribute('data-forget'));
      persist();
      render();
      return;
    }
    const edit = event.target.closest('[data-edit]');
    if (edit && root.contains(edit)) {
      count('pick-field');
      flow.editField = edit.getAttribute('data-edit');
      render();
      return;
    }
    const hours = event.target.closest('[data-hours]');
    if (hours && root.contains(hours)) {
      count('pick-field');
      const base = flow.suggestion || buildSuggestion(flow.capture);
      flow.suggestion = { ...base, hours: Number(hours.getAttribute('data-hours')) };
      flow.editField = null;
      flow.phase = state.consent === 'deny' ? 'plain' : 'correct';
      render();
      return;
    }
    const place = event.target.closest('[data-place]');
    if (place && root.contains(place)) {
      count('pick-field');
      const base = flow.suggestion || buildSuggestion(flow.capture);
      const value = place.getAttribute('data-place');
      flow.suggestion = { ...base, place: value === 'none' ? null : value };
      flow.editField = null;
      flow.phase = state.consent === 'deny' ? 'plain' : 'correct';
      render();
      return;
    }
    const category = event.target.closest('[data-category]');
    if (category && root.contains(category)) {
      count('set-category');
      const base = flow.suggestion || buildSuggestion(flow.capture);
      const id = category.getAttribute('data-category');
      flow.suggestion = { ...base, category: id, reasons: (base.reasons || []).concat(`Category set to ${categoryLabelSafe(id)} on this page.`) };
      flow.editField = null;
      flow.phase = state.consent === 'deny' ? 'plain' : 'correct';
      render();
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button || !root.contains(button)) return;
    const action = button.getAttribute('data-action');
    if (action === 'reset-demo') {
      if (!resetArmed) {
        resetArmed = true;
        renderLearned();
        return;
      }
      halt();
      state = resetState(storage);
      flow = freshFlow();
      resetArmed = false;
      fieldCounted = false;
      render();
      return;
    }
    if (action === 'back-correct') {
      flow.phase = state.consent === 'deny' ? 'plain' : 'correct';
      render();
      return;
    }
    if (action === 'hash-go') {
      halt();
      fieldCounted = false;
      flow = freshFlow();
      flow.method = 'nfc';
      count('hash-go');
      flow.capture = captureFromText(`${scope.location.href}`, 'nfc');
      flow.simulated = false;
      flow.note = 'The link in this address is the capture. It was not sent again. An iPhone can open a tag this way, and it cannot read the tag into the page.';
      afterCapture();
      return;
    }
    onAction(action);
  });

  root.addEventListener('input', (event) => {
    const field = event.target.closest('[data-field]');
    if (!field) return;
    flow.draftText = field.value;
    const fieldAction = field.getAttribute('data-field');
    if (fieldCounted || !fieldAction || !ACTIONS[fieldAction]) return;
    fieldCounted = true;
    count(fieldAction);
  });

  renderReview();
  render();
}

function methodLabel(id) {
  const found = METHODS.find((item) => item.id === id);
  return found ? found.label : id || '';
}

function categoryLabelSafe(id) {
  const found = CATEGORIES.find((item) => item.id === id);
  return found ? found.label : 'No category';
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('tap-entry-app');
  if (root) mount(root, window);
}
