/* Theme toggle — sáng / tối, lưu lựa chọn vào localStorage */
(function () {
  var STORAGE_KEY = 'ttbk-theme';
  var root = document.documentElement;

  function getPreferred() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#171B15' : '#A13F52');
    var btn = document.getElementById('theme-switch');
    if (btn) btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  // Áp dụng ngay (đề phòng script head bị bỏ qua / chạy muộn)
  apply(getPreferred());

  document.addEventListener('DOMContentLoaded', function () {
    apply(getPreferred());
    var btn = document.getElementById('theme-switch');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
        apply(next);
      });
    }
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      var saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) {}
      if (!saved) apply(e.matches ? 'dark' : 'light');
    });
  }
})();
