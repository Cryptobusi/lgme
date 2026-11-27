(function () {
  var STORAGE_KEY = "lgme_creo_tape_v1";
  var DAILY_PAIR_CAP_CREO = 150;
  var PRESETS = [
    { id: "move_30", mode: "Moved / Learned", pillar: "Did", label: "30-min walk or workout", creo: 30 },
    { id: "read_study", mode: "Moved / Learned", pillar: "Did", label: "Chapter read & discussed", creo: 25 },
    { id: "peer_help", mode: "Helped / Shared", pillar: "Duty", label: "Peer tutoring or neighbor help", creo: 40 },
    { id: "swap_offer", mode: "Offered / Needed", pillar: "Sell", label: "Light tool/book/skill swap", creo: 20 }
  ];

  var root = document.getElementById("creo-root");
  var unlocked = false;
  var pin = "";
  var pinError = "";
  var partnerHandle = "";
  var selectedId = PRESETS[0].id;
  var customNote = "";
  var showFloorNote = false;
  var activeShareId = null;
  var copiedId = null;
  var entries = loadEntries();

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function encodePayload(obj) {
    var json = JSON.stringify(obj);
    var bytes = new TextEncoder().encode(json);
    var binary = "";
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function decodePayload(raw) {
    var binary = atob(raw);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function buildCoSignUrl(receipt) {
    var payload = encodePayload({
      id: receipt.id,
      day: receipt.day,
      mode: receipt.mode,
      pillar: receipt.pillar,
      summary: receipt.summary,
      partner: receipt.partner,
      creo: receipt.creo
    });
    return location.origin + location.pathname + "?cosign=" + encodeURIComponent(payload);
  }

  function parseIncomingCoSign() {
    var raw = new URLSearchParams(location.search).get("cosign");
    if (!raw) return null;
    try {
      var parsed = decodePayload(raw);
      if (!parsed || !parsed.id || !parsed.summary) return null;
      return {
        id: String(parsed.id),
        day: parsed.day || todayKey(),
        mode: parsed.mode || "Peer Co-Sign",
        pillar: parsed.pillar || "Did",
        summary: String(parsed.summary),
        partner: String(parsed.partner || "peer-partner"),
        creo: Number(parsed.creo || 0),
        capped: false,
        status: "PENDING_COSIGN",
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  function loadEntries() {
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (error) { saved = []; }
    if (!Array.isArray(saved)) saved = [];
    var incoming = parseIncomingCoSign();
    if (incoming && !saved.some(function (item) { return item.id === incoming.id; })) {
      saved = [incoming].concat(saved);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (error) {}
    }
    return saved;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (error) {}
  }

  function selectedPreset() {
    return PRESETS.filter(function (item) { return item.id === selectedId; })[0] || PRESETS[0];
  }

  function todayPairCreo() {
    var clean = partnerHandle.trim().toLowerCase();
    if (!clean) return 0;
    return entries.filter(function (entry) {
      return entry.day === todayKey() && String(entry.partner).toLowerCase() === clean && entry.status !== "REFUSED";
    }).reduce(function (sum, entry) { return sum + Number(entry.creo || 0); }, 0);
  }

  function totalCreo() {
    return entries.filter(function (entry) { return entry.status === "CO_SIGNED"; })
      .reduce(function (sum, entry) { return sum + Number(entry.creo || 0); }, 0);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
      else if (key === "html") node.innerHTML = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function renderLock() {
    root.replaceChildren(
      el("p", { class: "muted", text: "lgme · device tape" }),
      el("h1", { text: "Daily Creo Tape" }),
      el("p", { text: "Log a walk, a chapter, or a neighbor deed on this device. A peer co-signs it. No coin, no wallet, and no chain write." }),
      el("input", {
        class: "field",
        type: "password",
        inputmode: "numeric",
        autocomplete: "off",
        placeholder: "Quick PIN (4+ digits)",
        value: pin,
        oninput: function (event) { pin = event.target.value; pinError = ""; }
      }),
      el("p", { class: "err", text: pinError }),
      el("button", {
        type: "button",
        style: "width:100%;font-weight:700",
        text: "Unlock",
        onclick: function () {
          if (pin.trim().length >= 4) {
            unlocked = true;
            pinError = "";
            render();
            return;
          }
          pinError = "Enter 4 digits. The PIN stays in this tab. It is not saved.";
          render();
        }
      }),
      el("p", { class: "muted", text: "This is a local gate, not a passkey and not an account. Floor stays senior. Nothing here mints." })
    );
    var input = root.querySelector("input");
    if (input) input.value = pin;
  }

  function drawQr(holder, url) {
    holder.replaceChildren();
    if (typeof QRCode !== "function") {
      holder.appendChild(el("p", { class: "muted", text: "QR code did not load. Use Copy link." }));
      return;
    }
    try {
      new QRCode(holder, {
        text: url,
        width: 160,
        height: 160,
        colorDark: "#0c100c",
        colorLight: "#f4f1e8",
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (error) {
      holder.appendChild(el("p", { class: "muted", text: "This link is too long for a QR code. Use Copy link." }));
    }
  }

  function renderDeck() {
    var preset = selectedPreset();
    var pair = todayPairCreo();
    var head = el("div", { class: "top" }, [
      el("div", {}, [
        el("h1", { text: "Daily Creo Tape" }),
        el("p", { class: "muted", text: "Co-signed Creo: " + totalCreo() + " · Pair cap today: " + pair + "/" + DAILY_PAIR_CAP_CREO })
      ]),
      el("button", { type: "button", text: "Export log", onclick: exportTape })
    ]);

    var grid = el("div", { class: "grid" });
    PRESETS.forEach(function (item) {
      grid.appendChild(el("button", {
        type: "button",
        class: "preset",
        "aria-pressed": item.id === selectedId ? "true" : "false",
        onclick: function () { selectedId = item.id; render(); }
      }, [
        el("div", { text: item.label }),
        el("small", { class: "muted", text: item.mode + " · +" + item.creo + " Creo" })
      ]));
    });

    var partner = el("input", {
      class: "field",
      type: "text",
      placeholder: "Co-signer handle",
      oninput: function (event) { partnerHandle = event.target.value; }
    });
    var note = el("input", {
      class: "field",
      type: "text",
      placeholder: "Optional short note",
      oninput: function (event) { customNote = event.target.value; }
    });
    var fields = el("div", { style: "flex:1" }, [grid, partner, note]);
    var actions = el("div", { class: "col" }, [
      el("button", { type: "submit", style: "flex:1;font-weight:700", text: "Send co-sign" }),
      el("button", {
        type: "button",
        text: showFloorNote ? "Hide rule" : "Creo & Floor",
        onclick: function () { showFloorNote = !showFloorNote; render(); }
      })
    ]);
    var form = el("form", {
      class: "row",
      onsubmit: function (event) {
        event.preventDefault();
        var cleanPartner = partnerHandle.trim() || "peer-partner";
        var allowed = Math.max(0, Math.min(preset.creo, DAILY_PAIR_CAP_CREO - todayPairCreo()));
        var receipt = {
          id: "deed_" + Date.now(),
          day: todayKey(),
          mode: preset.mode,
          pillar: preset.pillar,
          summary: customNote.trim() || preset.label,
          partner: cleanPartner,
          creo: allowed,
          capped: allowed < preset.creo,
          status: "PENDING_COSIGN",
          createdAt: new Date().toISOString()
        };
        entries = [receipt].concat(entries);
        activeShareId = receipt.id;
        customNote = "";
        save();
        render();
      }
    }, [fields, actions]);

    var list = el("div");
    entries.forEach(function (entry) {
      var shareUrl = buildCoSignUrl(entry);
      var showing = activeShareId === entry.id;
      var buttons = [
        el("button", {
          type: "button",
          text: copiedId === entry.id ? "Copied" : "Copy link",
          onclick: function () { copyLink(entry); }
        }),
        el("button", {
          type: "button",
          text: "Share",
          onclick: function () { shareLink(entry); }
        }),
        el("button", {
          type: "button",
          text: showing ? "Hide QR" : "QR",
          onclick: function () {
            activeShareId = showing ? null : entry.id;
            render();
          }
        })
      ];
      if (entry.status === "PENDING_COSIGN") {
        buttons.push(el("button", {
          type: "button",
          text: "Confirm",
          onclick: function () { setStatus(entry.id, "CO_SIGNED"); }
        }));
        buttons.push(el("button", {
          type: "button",
          text: "Refuse",
          onclick: function () { setStatus(entry.id, "REFUSED"); }
        }));
      }
      var card = el("article", { class: "card" }, [
        el("strong", { text: entry.summary }),
        el("div", {
          class: "muted",
          text: "Partner: " + entry.partner + " · +" + entry.creo + " Creo" + (entry.capped ? " (daily cap applied)" : "") + " · " + entry.status
        }),
        el("div", { class: "actions" }, buttons)
      ]);
      if (showing) {
        var qrHold = el("div");
        var qrRow = el("div", { class: "qr" }, [
          qrHold,
          el("div", {}, [
            el("strong", { text: "Scan or share to co-sign" }),
            el("div", { class: "link", text: shareUrl })
          ])
        ]);
        card.appendChild(qrRow);
        list.appendChild(card);
        drawQr(qrHold, shareUrl);
      } else {
        list.appendChild(card);
      }
    });

    var nodes = [
      el("p", { class: "muted" }, [
        el("a", { href: "/", text: "lgme" }),
        document.createTextNode(" · stays on this device")
      ]),
      head,
      form
    ];
    if (showFloorNote) {
      nodes.push(el("div", { class: "note" }, [
        el("strong", { text: "Creo and Floor" }),
        el("p", { text: "Creo here is a peer-confirmed tally on this device. It is not a coin and it is not minted. A living-need claim stays ahead. Floor stays senior." })
      ]));
    }
    nodes.push(list);
    if (!entries.length) nodes.push(el("p", { class: "muted", text: "No deeds yet. Pick one, name a partner, and send a co-sign." }));
    root.replaceChildren.apply(root, nodes);
    var inputs = root.querySelectorAll("input");
    if (inputs[0]) inputs[0].value = partnerHandle;
    if (inputs[1]) inputs[1].value = customNote;
  }

  function setStatus(id, status) {
    entries = entries.map(function (item) {
      return item.id === id ? Object.assign({}, item, { status: status }) : item;
    });
    save();
    render();
  }

  function copyLink(entry) {
    var link = buildCoSignUrl(entry);
    var done = function () {
      copiedId = entry.id;
      activeShareId = entry.id;
      render();
      setTimeout(function () {
        if (copiedId === entry.id) copiedId = null;
        render();
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(function () {
        activeShareId = entry.id;
        render();
      });
      return;
    }
    activeShareId = entry.id;
    render();
  }

  function shareLink(entry) {
    var link = buildCoSignUrl(entry);
    if (navigator.share) {
      navigator.share({
        title: "Creo co-sign",
        text: entry.summary + " (+" + entry.creo + " Creo). Tap to co-sign.",
        url: link
      }).catch(function () {});
      return;
    }
    copyLink(entry);
  }

  function exportTape() {
    var blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "lgme-creo-v1-" + todayKey() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function render() {
    if (!unlocked) renderLock();
    else renderDeck();
  }

  render();
})();
