if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller && typeof showToast === "function") {
            showToast("Có bản cập nhật mới — tải lại trang để dùng bản mới nhất", "info", 5000);
          }
        });
      });
    }).catch((error) => console.warn("Không đăng ký được service worker:", error));
  });
}