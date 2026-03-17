// js/layout-fix.js
(function () {
  function setVh() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  }
  setVh();
  window.addEventListener('resize', setVh);
  window.addEventListener('orientationchange', setVh);
})();
