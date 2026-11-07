    const KEY = "lgme-note-replies-v1";
    const notice = document.getElementById("notice");
    const running = document.getElementById("running");
    function load() {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]").filter((r) => r && r.text && r.noteId); }
      catch { return []; }
    }
    function line(text) {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }
    function paint(replies) {
      document.querySelectorAll("article").forEach((article) => {
        let list = article.querySelector("ol");
        if (!list) {
          list = document.createElement("ol");
          list.className = "list";
          article.querySelector("p").after(list);
        }
        list.replaceChildren();
        replies.filter((r) => r.noteId === article.dataset.id).forEach((r) => list.append(line(r.text)));
      });
      running.replaceChildren();
      if (!replies.length) {
        const empty = line("Nothing sent yet.");
        empty.className = "muted";
        running.append(empty);
        return;
      }
      replies.forEach((r, i) => {
        const li = document.createElement("li");
        const k = document.createElement("p");
        k.className = "kicker";
        k.textContent = (i + 1) + " · " + r.title;
        const body = document.createElement("p");
        body.textContent = r.text;
        const mark = document.createElement("p");
        mark.className = "kicker";
        mark.textContent = "For @trancesage to review";
        li.append(k, body, mark);
        running.append(li);
      });
    }
    document.querySelectorAll("article").forEach((article) => {
      const form = document.createElement("form");
      const label = document.createElement("label");
      label.append("Response");
      const input = document.createElement("input");
      input.name = "text";
      input.autocomplete = "off";
      label.append(input);
      const stop = document.createElement("p");
      stop.className = "stop";
      stop.hidden = true;
      const button = document.createElement("button");
      button.type = "submit";
      button.textContent = "Send for review";
      form.append(label, stop, button);
      article.append(form);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (text.length < 2) {
          stop.hidden = false;
          stop.textContent = "Write a response. Two letters at least.";
          return;
        }
        stop.hidden = true;
        const replies = load().concat([{ id: crypto.randomUUID(), noteId: article.dataset.id, title: article.dataset.title, text, at: new Date().toISOString() }]).slice(-80);
        localStorage.setItem(KEY, JSON.stringify(replies));
        paint(replies);
        input.value = "";
        notice.textContent = article.dataset.title + " is in the list for @trancesage to review.";
        const post = ("@trancesage for review — " + article.dataset.title + ": " + text).slice(0, 280);
        window.open("https://x.com/intent/post?text=" + encodeURIComponent(post), "_blank", "noopener,noreferrer");
      });
    });
    paint(load());
  
