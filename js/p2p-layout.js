    (function () {
      var w = window.innerWidth || 1024;
      var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      var phone = w <= 767 || (coarse && w <= 1023);
      document.documentElement.classList.add(phone ? 'phone' : 'desk');
    })();
  
