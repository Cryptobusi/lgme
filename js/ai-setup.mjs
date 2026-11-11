export function aiSetupSteps(ua = '') {
  const text = String(ua || '');
  const edge = /Edg\//i.test(text);
  const samsung = /SamsungBrowser/i.test(text);
  const firefox = /Firefox|FxiOS/i.test(text);
  const chrome = /Chrome|CriOS/i.test(text) && !edge && !samsung;
  const android = /Android/i.test(text) || /CriOS/i.test(text);
  const safari = /Safari/i.test(text) && !chrome && !edge && !firefox && !samsung;
  if (samsung) {
    return {
      id: 'samsung',
      can: false,
      title: 'Samsung Internet',
      steps: [
        'Samsung Internet does not include the built-in model.',
        'You can try the on-device model. It stays on this phone and turns on only after a short warmup passes.',
        'If the warmup does not pass, you can still browse and confirm by hand. Chrome can use its built-in model.'
      ]
    };
  }
  if (firefox) {
    return {
      id: 'firefox',
      can: false,
      title: 'Firefox',
      steps: [
        'Firefox does not include the built-in model.',
        'You can try the on-device model. It stays on this phone and turns on only after a short warmup passes.',
        'If the warmup does not pass, you can still browse and confirm by hand. Chrome can use its built-in model.'
      ]
    };
  }
  if (safari) {
    return {
      id: 'safari',
      can: false,
      title: 'Safari',
      steps: [
        'Safari on iPhone, iPad, and Mac does not include the built-in model.',
        'You can try the on-device model. It stays on this phone and turns on only after a short warmup passes.',
        'If the warmup does not pass, you can still browse and confirm by hand.'
      ]
    };
  }
  if (edge) {
    return {
      id: 'edge',
      can: true,
      title: 'Microsoft Edge',
      steps: [
        'Open a new tab and go to edge://flags.',
        'Search for Prompt API.',
        'If you see it, set it to Enabled and relaunch Edge.',
        'Come back to lgme and tap Check again.',
        'If the flag is not there, this Edge build cannot run the helper. Use Chrome.'
      ]
    };
  }
  if (chrome && android) {
    return {
      id: 'chrome-android',
      can: true,
      title: 'Chrome on Android',
      steps: [
        'Open Chrome settings on this phone.',
        'Look for AI or the on-device model.',
        'Turn it on and wait until the model finishes downloading.',
        'Come back to lgme and tap Check again.',
        'If Chrome has no AI setting, this phone cannot run the helper. Browsing still works.'
      ]
    };
  }
  if (chrome) {
    return {
      id: 'chrome',
      can: true,
      title: 'Chrome on a computer',
      steps: [
        'Open a new tab and go to chrome://settings/ai.',
        'If that page is missing, go to chrome://flags and search for Prompt API.',
        'Turn the on-device model on.',
        'Open chrome://components and wait until the model download finishes.',
        'Come back to lgme and tap Check again.'
      ]
    };
  }
  return {
    id: 'other',
    can: false,
    title: 'This browser',
    steps: [
      'This browser cannot run the on-device helper.',
      'You can still browse.',
      'To use the helper, open lgme in Chrome on a computer or an Android phone.'
    ]
  };
}
