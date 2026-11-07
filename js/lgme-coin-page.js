    var ADDRESS = '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY';
    var MINT = '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump';

    function copyFrom(id, button) {
      var value = document.getElementById(id).textContent.trim();
      button.textContent = 'Copied';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(function () {});
      }
    }

    function payUrl(amount) {
      var params = new URLSearchParams();
      if (amount) params.set('amount', amount);
      params.set('spl-token', MINT);
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
    var quoteTimer = 0;
    function paintGift(url) {
      if (pay) pay.href = url;
      drawGift(url);
    }
    function loadQuote(mod) {
      var usd = Number(amount && amount.value);
      var eq = document.getElementById('lgme-equivalent');
      var clock = document.getElementById('quote-countdown');
      mod.fetchLgmePrice().then(function (priced) {
        if (!priced.ok || !(usd > 0)) {
          if (quoteTimer) clearInterval(quoteTimer);
          if (eq) eq.textContent = priced.ok ? 'Enter a US$ amount.' : 'No $lgme price is available. Coin settlement is closed. Pay in terms or barter. Both parties consent.';
          if (clock) clock.textContent = priced.history === 'history unavailable' ? 'history unavailable' : '';
          paintGift(payUrl(''));
          return;
        }
        var banded = mod.applyPegBands({ raw: priced.price, candles: priced.candles, now: Date.now(), history: priced.history === 'ok', rules: { band: 0.05 } });
        var lgme = mod.lgmeForUsd(usd, banded.price);
        var until = Date.now() + mod.QUOTE_MS;
        if (eq) eq.textContent = 'US$ ' + usd + ' is ' + lgme + ' $lgme.';
        paintGift(payUrl(String(lgme)));
        if (quoteTimer) clearInterval(quoteTimer);
        quoteTimer = setInterval(function () {
          var left = Math.max(0, until - Date.now());
          if (clock) clock.textContent = left > 0 ? 'Price lock ' + Math.ceil(left / 1000) + 's' : 'The 15 second lock expired. Quoting again.';
          if (banded.history === 'history unavailable' && clock && left > 0) clock.textContent += ' history unavailable';
          if (left <= 0) {
            clearInterval(quoteTimer);
            loadQuote(mod);
          }
        }, 250);
      }).catch(function () {
        if (eq) eq.textContent = 'No $lgme price is available. Coin settlement is closed. Pay in terms or barter. Both parties consent.';
        paintGift(payUrl(''));
      });
    }
    import('/js/lgme-price.mjs').then(function (mod) {
      if (amount) amount.addEventListener('input', function () { loadQuote(mod); });
      loadQuote(mod);
    });

    var receipt = document.getElementById('tx-receipt');
    if (receipt) receipt.addEventListener('click', function () {
      var out = document.getElementById('tx-out');
      var id = String(document.getElementById('tx-id').value || '').trim();
      out.textContent = '';
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,128}$/.test(id)) {
        out.textContent = 'Paste the transaction id from your wallet.';
        return;
      }
      out.append('THANK YOU FOR YOUR SUPPORT. ');
      var link = document.createElement('a');
      link.href = 'https://solscan.io/tx/' + id;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'View on Solscan';
      out.append(link);
    });
