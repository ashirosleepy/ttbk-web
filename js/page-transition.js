/* ==========================================================
   TTBK - Hieu ung chuyen trang muot
   Dung chung cho index.html va "Chi tieu TTBK.html".
   ========================================================== */
(function () {
  var FADE_OUT_MS = 220;
  var root = document.documentElement;

  function showPage() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add("pg-ready");
      });
    });
  }

  function isLocalHtmlLink(href) {
    if (!href) return false;
    try {
      var url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return false;
      if (url.href.split("#")[0] === window.location.href.split("#")[0]) return false;
      return /\.html?$/i.test(url.pathname) || href.slice(-5).toLowerCase() === ".html";
    } catch (e) {
      return false;
    }
  }

  window.ttbkNavigate = function (href) {
    root.classList.remove("pg-ready");
    root.classList.add("pg-leave");
    window.setTimeout(function () {
      window.location.href = href;
    }, FADE_OUT_MS);
  };

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = e.target.closest("a[href]");
    if (!el || el.target === "_blank") return;
    var href = el.getAttribute("href");
    if (!isLocalHtmlLink(href)) return;
    e.preventDefault();
    window.ttbkNavigate(href);
  }, true);

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      root.classList.remove("pg-leave");
      root.classList.add("pg-fade");
      showPage();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showPage);
  } else {
    showPage();
  }
})();
