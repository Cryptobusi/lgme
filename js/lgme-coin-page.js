    function copyFrom(id, button) {
      var value = document.getElementById(id).textContent.trim();
      var done = function () { button.textContent = 'Copied'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done).catch(function () { done(); });
      } else done();
    }
    document.getElementById('copy-mint').addEventListener('click', function () { copyFrom('mint', this); });
    document.getElementById('copy-donate').addEventListener('click', function () { copyFrom('donate', this); });
    var address = document.getElementById('donate').textContent.trim();
    if (window.QRCode) {
      new QRCode(document.getElementById('donate-qr'), { text: address, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
    }
  
