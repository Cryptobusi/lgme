    var ADDRESS = '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY';
    var MINT = '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump';

    function copyFrom(id, button) {
      var value = document.getElementById(id).textContent.trim();
      button.textContent = 'Copied';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(function () {});
      }
    }

    function payUrl(amount, reference) {
      var params = new URLSearchParams();
      if (amount) params.set('amount', amount);
      params.set('spl-token', MINT);
      if (reference) params.set('reference', reference);
      params.set('label', 'soBeIT');
      params.set('message', 'THANK YOU FOR YOUR SUPPORT.');
      return 'solana:' + ADDRESS + '?' + params.toString();
    }

    function drawGift(text) {
      var host = document.getElementById('donate-qr');
      if (!host || !window.QRCode) return;
      host.textContent = '';
      new QRCode(host, { text: text, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    }

    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-copy]');
      if (!button || !navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(button.getAttribute('data-copy')).then(function () { button.textContent = 'Copied'; }).catch(function () {});
    });
    document.getElementById('copy-mint').addEventListener('click', function () { copyFrom('mint', this); });
    document.getElementById('copy-donate').addEventListener('click', function () { copyFrom('donate', this); });

    var amount = document.getElementById('gift-amount');
    var pay = document.getElementById('solana-pay');
    var samples = [];
    var board = [];
    var lock = null;
    var reference = '';
    function paintGift(url) {
      if (pay) pay.href = url;
      drawGift(url);
    }
    function paintQuote(mod) {
      var usd = Number(amount && amount.value);
      var eq = document.getElementById('lgme-equivalent');
      var clock = document.getElementById('quote-countdown');
      var now = Date.now();
      if (lock && !mod.lockOpen(lock, now)) lock = null;
      var quote = mod.lockOpen(lock, now) ? lock : mod.pegQuote({ usd: usd, samples: samples, quotes: board, now: now });
      if (!(usd > 0)) {
        if (eq) eq.textContent = 'Enter a US$ amount.';
        paintGift(payUrl('', reference));
        return;
      }
      if (!quote.ok) {
        if (eq) eq.textContent = quote.error || mod.PRICE_UNAVAILABLE;
        if (clock) clock.textContent = '';
        paintGift(payUrl('', reference));
        return;
      }
      if (eq) eq.textContent = quote.plain + ' ' + quote.lgmeAmount + ' $lgme for US$' + usd + '.';
      if (clock) {
        clock.textContent = mod.lockOpen(lock, now)
          ? 'Locked until ' + new Date(lock.expiresAt).toISOString() + '.'
          : (quote.source || '') + ' · ' + (quote.timestamp || '');
      }
      paintGift(payUrl(String(quote.lgmeAmount), reference));
    }
    function holdGift(mod) {
      var usd = Number(amount && amount.value);
      if (!(usd > 0)) return null;
      if (!mod.lockOpen(lock)) lock = mod.lockPayQuote(mod.pegQuote({ usd: usd, samples: samples, quotes: board, now: Date.now() }), usd);
      paintQuote(mod);
      return lock && lock.ok ? lock : null;
    }
    Promise.all([import('/js/lgme-price.mjs'), import('/js/solana-pay.mjs'), import('/js/setup-fee.mjs')]).then(function (mods) {
      var mod = mods[0];
      var payMod = mods[1];
      var fee = mods[2];
      reference = payMod.createReference();
      function sample() {
        return mod.fetchSpotBoard().then(function (spot) {
          board = spot.quotes || [];
          mod.pushSpot(samples, spot);
          paintQuote(mod);
        }).catch(function () { paintQuote(mod); });
      }
      if (amount) amount.addEventListener('input', function () { lock = null; paintQuote(mod); });
      if (pay) pay.addEventListener('click', function (event) {
        if (!holdGift(mod)) event.preventDefault();
      });
      var check = document.getElementById('gift-check');
      if (check) check.addEventListener('click', function () {
        var out = document.getElementById('tx-out');
        var held = holdGift(mod);
        if (!held) { if (out) out.textContent = (lock && lock.error) || mod.PRICE_UNAVAILABLE; return; }
        fee.findSetupPayment(reference, { amount: held.lgmeAmount, tolerance: 0.02 }).then(function (found) {
          if (!out) return;
          out.textContent = found.ok ? 'The reference payment matched the locked quote.' : found.error;
        });
      });
      sample();
      setInterval(sample, mod.SAMPLE_MS);
    });
