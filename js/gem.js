(function () {
  var TOPIC = "0.0.11399829";
  var MIRROR = "https://testnet.mirrornode.hedera.com/api/v1/topics/" + TOPIC + "/messages?limit=8&order=desc";
  var lenses = {
    neighbor: {
      title: "Prove real work. Refuse broken order.",
      sub: "Draft a work receipt on this device, or test a rule against the canonical order. Nothing here is posted, sold, or minted."
    },
    builder: {
      title: "HCS-1 tape and default-closed barriers",
      sub: "The public list on the Tape tab is the testnet attestation topic. It stores daily hashes. Mainnet tape is not open."
    },
    auditor: {
      title: "Three-seat constitutional symmetry",
      sub: "State, firm, and person sit under the same order. A refusal logged here stays in this browser."
    }
  };

  function $(id) { return document.getElementById(id); }

  function show(tab) {
    var sections = document.querySelectorAll("[data-panel]");
    for (var i = 0; i < sections.length; i++) {
      sections[i].hidden = sections[i].getAttribute("data-panel") !== tab;
    }
    var buttons = document.querySelectorAll("[data-tab]");
    for (var j = 0; j < buttons.length; j++) {
      var on = buttons[j].getAttribute("data-tab") === tab;
      buttons[j].classList.toggle("on", on);
      buttons[j].setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  function setLens(name) {
    var copy = lenses[name] || lenses.neighbor;
    $("hero-title").textContent = copy.title;
    $("hero-sub").textContent = copy.sub;
    var buttons = document.querySelectorAll("[data-lens]");
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute("data-lens") === name;
      buttons[i].classList.toggle("on", on);
      buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function compose() {
    var raw = $("ididit-input").value.trim();
    var out = $("ididit-output");
    if (!raw) {
      out.hidden = true;
      return;
    }
    var payload = {
      schema: "lgme.ididit.v1",
      timestamp: new Date().toISOString(),
      stewardship_summary: raw,
      classification: "NON_CASH_WORK_FACT",
      posted: false
    };
    out.hidden = false;
    out.className = "output pass";
    out.textContent = "Draft only. Not inscribed.\n\n" + JSON.stringify(payload, null, 2);
  }

  function audit() {
    var text = $("audit-input").value.toLowerCase();
    var out = $("audit-output");
    var refuse = $("refuse-btn");
    if (!text.trim()) {
      out.hidden = true;
      refuse.hidden = true;
      return;
    }
    var skips = text.indexOf("before") >= 0 || text.indexOf("fee") >= 0 || text.indexOf("deduct") >= 0 || text.indexOf("unbacked") >= 0;
    out.hidden = false;
    if (skips) {
      out.className = "output fail";
      out.textContent = "This line tries to charge or issue before Floor and the tape. That breaks the order. This is a local check, not a ruling.";
      refuse.hidden = false;
    } else {
      out.className = "output pass";
      out.textContent = "No skipped Floor or tape step was found in this wording. This is a local check, not a ruling.";
      refuse.hidden = true;
    }
  }

  function refuse() {
    var count = Number(localStorage.getItem("lgme_refusals") || 0) + 1;
    localStorage.setItem("lgme_refusals", String(count));
    paintSeat(count);
  }

  function paintSeat(count) {
    $("seat-status").textContent = count ? "Third Seat: " + count + " refusal" + (count === 1 ? "" : "s") + " on this device" : "Third Seat: Ready";
  }

  function explain(question) {
    var q = String(question || "").toLowerCase();
    var box = $("drawer-a");
    if (!q.trim()) return;
    var text;
    if (q.indexOf("floor") >= 0) {
      text = "Floor Seniority means baseline living and operating costs are funded first from named reserves. Surplus, fees, and residual come after. This drawer is a glossary, not a model call.";
    } else if (q.indexOf("seat") >= 0 || q.indexOf("symmetry") >= 0) {
      text = "Three-seat symmetry binds the state, the firm, and the person to the same default-closed checks. Any seat may refuse a line that skips Floor or the tape.";
    } else if (q.indexOf("ididit") >= 0 || q.indexOf("receipt") >= 0 || q.indexOf("security") >= 0) {
      text = "An IDidIt receipt, as specified, is a record of a work fact. It is not cash, not a security, and not an offer. This page does not inscribe one.";
    } else if (q.indexOf("order") >= 0 || q.indexOf("canonical") >= 0) {
      text = "The order is Floor, Mint, Issue, Tape, Charge, Registrar, Thin, Residual. Charge before Floor is a broken line.";
    } else {
      text = "This drawer answers from the charter glossary on this page. It does not call a model. A semantic reading of a long contract needs a server route primed with the docs, which is not connected.";
    }
    box.textContent = text;
  }

  function openDrawer(prefill) {
    $("charter-drawer").hidden = false;
    if (prefill) {
      $("drawer-q").value = prefill;
      explain(prefill);
    }
  }

  function decode(message) {
    try {
      var text = atob(message);
      var body = JSON.parse(text);
      return {
        day: body.day || "undated",
        summary: (body.network || "testnet") + " hash · " + (body.leafCount == null ? 0 : body.leafCount) + " leaf",
        raw: text
      };
    } catch (error) {
      return { day: "unparsed", summary: "Message was not a JSON hash.", raw: message };
    }
  }

  function renderTape(messages) {
    var list = $("tape-list");
    list.textContent = "";
    if (!messages.length) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "The topic returned no messages.";
      list.appendChild(empty);
      return;
    }
    messages.forEach(function (row) {
      var decoded = decode(row.message);
      var item = document.createElement("article");
      item.className = "tape-item";
      var title = document.createElement("h2");
      title.textContent = "Message " + row.sequence_number + " · " + decoded.day;
      var summary = document.createElement("p");
      summary.textContent = decoded.summary;
      var link = document.createElement("a");
      link.href = "https://hashscan.io/testnet/topic/" + TOPIC + "/message/" + row.sequence_number;
      link.textContent = "HashScan";
      var pre = document.createElement("pre");
      pre.textContent = decoded.raw;
      item.appendChild(title);
      item.appendChild(summary);
      item.appendChild(link);
      item.appendChild(pre);
      list.appendChild(item);
    });
  }

  function loadTape() {
    var note = $("tape-note");
    fetch(MIRROR)
      .then(function (res) {
        if (!res.ok) throw new Error("Mirror returned " + res.status);
        return res.json();
      })
      .then(function (body) { renderTape(body.messages || []); })
      .catch(function (error) {
        note.textContent = "The mirror did not answer. " + error.message;
      });
  }

  document.addEventListener("click", function (event) {
    var node = event.target.closest("[data-tab], [data-lens], [data-act]");
    if (!node) return;
    if (node.hasAttribute("data-tab")) show(node.getAttribute("data-tab"));
    if (node.hasAttribute("data-lens")) setLens(node.getAttribute("data-lens"));
    var act = node.getAttribute("data-act");
    if (act === "compose") compose();
    if (act === "audit") audit();
    if (act === "refuse") refuse();
    if (act === "open") openDrawer(node.getAttribute("data-prefill") || "");
    if (act === "close") $("charter-drawer").hidden = true;
    if (act === "explain") explain($("drawer-q").value);
  });

  paintSeat(Number(localStorage.getItem("lgme_refusals") || 0));
  show("workspace");
  setLens("neighbor");
  loadTape();
})();
