// ============================================================
// SETTINGS.JS — trang "Cài đặt" (hồ sơ cá nhân)
// ============================================================

function renderColorPicker() {
  const wrap = document.getElementById("st-colors");
  wrap.innerHTML = AVATAR_COLORS.map(
    (c) => `<button type="button" class="color-dot ${c === STATE.me.avatar_color ? "on" : ""}" style="background:${c}" data-color="${c}"></button>`
  ).join("");
}

function bindSettingsEvents() {
  const wrap = document.getElementById("st-colors");
  if (!wrap.dataset.bound) {
    wrap.dataset.bound = "1";
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".color-dot");
      if (!btn) return;
      wrap.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("on"));
      btn.classList.add("on");
    });
  }

  const saveBtn = document.getElementById("save-settings");
  if (!saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const name = document.getElementById("st-name").value.trim();
      const household = document.getElementById("st-household").value.trim();
      const activeDot = document.querySelector("#st-colors .color-dot.on");
      const color = activeDot ? activeDot.dataset.color : STATE.me.avatar_color;
      if (!name) return alert("Tên không được để trống.");

      const { error } = await supabaseClient
        .from("profiles")
        .update({ name, household, avatar_color: color })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.name = name;
      STATE.me.household = household;
      STATE.me.avatar_color = color;
      STATE.profiles = await getAllProfiles();
      updateTopbar();
      alert("Đã lưu thay đổi.");
    });
  }

  const logoutBtn = document.getElementById("st-logout");
  if (!logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "1";
    logoutBtn.addEventListener("click", logout);
  }
}

async function loadSettingsSection() {
  document.getElementById("st-name").value = STATE.me.name;
  document.getElementById("st-household").value = STATE.me.household || "Nhà TTBK";
  renderColorPicker();
  bindSettingsEvents();
}
