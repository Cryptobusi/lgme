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

    document.getElementById('copy-mint').addEventListener('click', function () { copyFrom('mint', this); });
    document.getElementById('copy-donate').addEventListener('click', function () { copyFrom('donate', this); });

    var amount = document.getElementById('gift-amount');
    var pay = document.getElementById('solana-pay');
    var samples = [];
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
      var average = mod.lockOpen(lock, now) ? lock : mod.averagePrice(samples, now);
      if (!(usd > 0)) {
        if (eq) eq.textContent = 'Enter a US$ amount.';
        paintGift(payUrl('', reference));
        return;
      }
      if (!average.ok) {
        if (eq) eq.textContent = mod.PRICE_UNAVAILABLE;
        if (clock) clock.textContent = '';
        paintGift(payUrl('', reference));
        return;
      }
      var price = mod.lockOpen(lock, now) ? lock.price : average.price;
      var lgme = mod.lgmeForUsd(usd, price);
      if (eq) eq.textContent = 'At current price (3-sec avg): ' + lgme + ' $lgme for US$' + usd + '.';
      if (clock) {
        clock.textContent = mod.lockOpen(lock, now)
          ? 'Locked until ' + new Date(lock.expiresAt).toISOString() + '.'
          : average.source + ' · ' + average.timestamp;
      }
      paintGift(payUrl(String(lgme), reference));
    }
    function holdGift(mod) {
      var usd = Number(amount && amount.value);
      if (!(usd > 0)) return null;
      if (!mod.lockOpen(lock)) lock = mod.lockPayQuote(mod.averagePrice(samples), usd);
      paintQuote(mod);
      return lock && lock.ok ? lock : null;
    }
    Promise.all([import('/js/lgme-price.mjs'), import('/js/solana-pay.mjs'), import('/js/setup-fee.mjs')]).then(function (mods) {
      var mod = mods[0];
      var payMod = mods[1];
      var fee = mods[2];
      reference = payMod.createReference();
      function sample() {
        return mod.fetchSpotPrice().then(function (spot) {
          if (spot.ok) samples.push({ t: Date.now(), price: spot.price, source: spot.source });
          while (samples.length > 6) samples.shift();
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
        if (!held) { if (out) out.textContent = mod.PRICE_UNAVAILABLE; return; }
        fee.findSetupPayment(reference, { amount: held.lgmeAmount, tolerance: 0.02 }).then(function (found) {
          if (!out) return;
          out.textContent = found.ok ? 'The reference payment matched the locked quote.' : found.error;
        });
      });
      sample();
      setInterval(sample, mod.SAMPLE_MS);
    });
