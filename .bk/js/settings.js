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

  const awayToggle = document.getElementById("st-away-toggle");
  const awayDatesWrap = document.getElementById("st-away-dates");
  if (awayToggle && !awayToggle.dataset.bound) {
    awayToggle.dataset.bound = "1";
    awayToggle.addEventListener("change", () => {
      awayDatesWrap.style.display = awayToggle.checked ? "block" : "none";
      if (awayToggle.checked && !document.getElementById("st-away-from").value) {
        document.getElementById("st-away-from").value = todayStr();
      }
    });
  }

  const saveAwayBtn = document.getElementById("save-away-status");
  if (saveAwayBtn && !saveAwayBtn.dataset.bound) {
    saveAwayBtn.dataset.bound = "1";
    saveAwayBtn.addEventListener("click", async () => {
      const isAway = document.getElementById("st-away-toggle").checked;
      const awayFrom = isAway ? (document.getElementById("st-away-from").value || todayStr()) : null;
      const awayUntil = isAway ? (document.getElementById("st-away-until").value || null) : null;

      const { error } = await supabaseClient
        .from("profiles")
        .update({ is_away: isAway, away_from: awayFrom, away_until: awayUntil })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.is_away = isAway;
      STATE.me.away_from = awayFrom;
      STATE.me.away_until = awayUntil;
      STATE.profiles = await getAllProfiles();

      await logHistory(
        null,
        STATE.me.id,
        isAway ? "bat_dau_vang" : "ket_thuc_vang",
        isAway
          ? `${STATE.me.name} bật chế độ đi vắng${awayUntil ? " đến " + formatDateShort(awayUntil) : ""}.`
          : `${STATE.me.name} đã tắt chế độ đi vắng (quay lại).`
      );

      alert(isAway ? "Đã bật chế độ đi vắng." : "Đã tắt chế độ đi vắng.");
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

  const awayToggle = document.getElementById("st-away-toggle");
  if (awayToggle) {
    awayToggle.checked = !!STATE.me.is_away;
    document.getElementById("st-away-dates").style.display = STATE.me.is_away ? "block" : "none";
    document.getElementById("st-away-from").value = STATE.me.away_from || "";
    document.getElementById("st-away-until").value = STATE.me.away_until || "";
  }

  bindSettingsEvents();
}
