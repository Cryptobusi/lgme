    (function () {
      var t = document.getElementById("menu-toggle");
      var n = document.getElementById("main-nav");
      if (!t || !n) return;
      function toggle() {
        var open = n.classList.toggle("open");
        t.classList.toggle("open", open);
        t.setAttribute("aria-expanded", open ? "true" : "false");
      }
      t.addEventListener("click", toggle);
      t.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
    })();
  
