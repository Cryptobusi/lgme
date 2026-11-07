const slot = document.getElementById('zelle-recipient');
if (slot) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/data/payment-methods.json', { signal: controller.signal });
    if (response.ok) {
      const body = await response.json();
      const recipient = String(body?.zelle?.recipient || '').trim();
      if (recipient) slot.textContent = `Zelle recipient: ${recipient}`;
    }
  } catch { /* the ask-in-chat line stays */ }
  clearTimeout(timer);
}
