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
    function refreshPay() {
      var figure = String(amount && amount.value || '').trim();
      var number = Number(figure);
      var url = payUrl(Number.isFinite(number) && number > 0 ? String(number) : '');
      if (pay) pay.href = url;
      drawGift(url);
    }
    if (amount) amount.addEventListener('input', refreshPay);
    refreshPay();

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
