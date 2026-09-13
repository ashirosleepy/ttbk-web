import { createClient } from "@supabase/supabase-js";
import { runLegacy } from "./generated/login-legacy.js";

window.supabase = { createClient };
runLegacy();

const form = document.getElementById("login-form");
const errorBox = document.getElementById("auth-error");
const loginButton = document.getElementById("login-btn");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.classList.remove("show");
  loginButton.disabled = true;
  loginButton.textContent = "Đang đăng nhập...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await window.login(email, password);

  if (error) {
    errorBox.textContent = "Sai email hoặc mật khẩu. Thử lại nhé.";
    errorBox.classList.add("show");
    loginButton.disabled = false;
    loginButton.textContent = "Đăng nhập";
    return;
  }
  window.location.href = "index.html";
});

(async () => {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (session) window.location.href = "index.html";
})();