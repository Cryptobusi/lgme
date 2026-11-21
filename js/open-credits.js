(function () {
  if (navigator.webdriver) return;
  if (/[?&]home=1(?:&|$)/.test(location.search)) return;
  try { if (sessionStorage.getItem('lgme.open.credits') === '1') return; } catch (error) { /* still show the opening */ }
  var coins = [
    ['/icons/coin-tragedy.jpg', 'Tragedy'],
    ['/icons/coin-comedy.jpg', 'Comedy'],
    ['/icons/coin-hope.jpg', 'Hope']
  ];
  var root = document.createElement('div');
  root.id = 'open-credits';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Opening');
  root.innerHTML = '<div class="credit-pin"><img src="/icons/lgme-coin.svg" width="28" height="28" alt=""></div>'
    + '<div class="credit-stage"><img id="credit-coin" src="/icons/coin-tragedy.jpg" alt="lgme coin, tragedy"><p id="credit-mood">Tragedy</p></div>'
    + '<div class="credit-roll" id="credit-roll">'
    + '<p>A balance sheet isn’t a mirror of your worth.</p>'
    + '<p>Coercive debt doesn’t just bill an account—it bills human posture. When basic footing, time, and dignity are squeezed by extractive terms, obligation stops acting as a bridge between people and starts acting like an internal landlord. Tomorrow gets spoken for before it arrives. Choice narrows to survival. And an imbalance in the ledger gets twisted into moral guilt inside the person carrying it.</p>'
    + '<h2>The problem</h2>'
    + '<p>Why coercive debt distorts agency.</p>'
    + '<ul>'
    + '<li><strong>Future capture.</strong> Compounding claims pre-assign your hours and attention before you have room to build, rest, or decide freely.</li>'
    + '<li><strong>Duress disguised as choice.</strong> When saying no carries severe instability, signing isn’t pure authorship—it’s compliance under pressure.</li>'
    + '<li><strong>Bandwidth compression.</strong> Constant strain narrows cognitive slack, making long-horizon planning harder without changing who you are.</li>'
    + '<li><strong>Moralized guilt and shame.</strong> Real reciprocity is built on care and mutual standing. Coercive debt turns economic friction into self-blame, secrecy, and isolation.</li>'
    + '</ul>'
    + '<h2>The shift</h2>'
    + '<p>Floor-first accounting and mutual credit.</p>'
    + '<ul>'
    + '<li><strong>Floor-first accounting.</strong> Protect human footing and baseline breathing room first. Real agency begins when essential needs aren’t sacrificed to feed leverage.</li>'
    + '<li><strong>Mutual credit.</strong> Keep value circulating through peer-to-peer reciprocity and clear bounds rather than rigid creditor-versus-debtor hierarchies.</li>'
    + '<li><strong>Five-pillar clearing on lgme.app.</strong> Want, Did, Sell, Wish, Duty. Give real action, care, offer, aspiration, and civic effort distinct places on the ledger—so everyday contribution isn’t flattened into a single coercive debt trap or moral stigma.</li>'
    + '</ul>'
    + '<h2>A balance is a contract term</h2>'
    + '<p>Not a verdict on a human life.</p>'
    + '<p>egonomicanonymous.live sets out the framework—floor-first sequence, public clarity, and sovereign provenance.</p>'
    + '<p>lgme.app puts it into everyday motion—where reciprocity, attested effort, and mutual clearing happen out in the open.</p>'
    + '</div>'
    + '<p class="credit-hint">Tap to enter</p>'
    + '<div class="credit-pin"><img src="/icons/lgme-coin.svg" width="28" height="28" alt=""></div>';
  document.body.appendChild(root);
  var roll = document.getElementById('credit-roll');
  var picture = document.getElementById('credit-coin');
  var mood = document.getElementById('credit-mood');
  var shown = 0;
  var paint = function () {
    var height = roll.scrollHeight - roll.clientHeight;
    var ratio = height > 0 ? roll.scrollTop / height : 0;
    var index = ratio < 0.34 ? 0 : ratio < 0.67 ? 1 : 2;
    if (index === shown) return;
    shown = index;
    picture.src = coins[index][0];
    picture.alt = 'lgme coin, ' + coins[index][1].toLowerCase();
    mood.textContent = coins[index][1];
  };
  var timer = window.setInterval(function () {
    if (!root.isConnected) { window.clearInterval(timer); return; }
    if (roll.scrollTop + roll.clientHeight >= roll.scrollHeight - 2) return;
    roll.scrollTop += 1;
    paint();
  }, 40);
  var close = function () {
    window.clearInterval(timer);
    try { sessionStorage.setItem('lgme.open.credits', '1'); } catch (error) { /* the opening still closes */ }
    root.classList.add('is-gone');
    window.setTimeout(function () { root.remove(); }, 140);
  };
  var drag = false;
  var y = 0;
  root.addEventListener('pointerdown', function (event) { drag = false; y = event.clientY; });
  root.addEventListener('pointermove', function (event) { if (Math.abs(event.clientY - y) > 8) drag = true; });
  root.addEventListener('click', function () { if (!drag) close(); });
  roll.addEventListener('scroll', paint, { passive: true });
})();
