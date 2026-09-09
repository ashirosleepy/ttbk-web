// ============================================================
// SETTINGS.JS — trang "Cài đặt" (hồ sơ cá nhân)
// ============================================================

function renderColorPicker() {
  const wrap = document.getElementById("st-colors");
  wrap.innerHTML = AVATAR_COLORS.map(
    (c) => `<button type="button" class="color-dot ${c === STATE.me.avatar_color ? "on" : ""}" style="background:${c}" data-color="${c}"></button>`
  ).join("");
}

function renderAvatarPreview() {
  const wrap = document.getElementById("st-avatar-preview");
  if (!wrap) return;
  wrap.innerHTML = avatarHTML(STATE.me);
  const removeBtn = document.getElementById("st-avatar-remove");
  if (removeBtn) removeBtn.style.display = STATE.me.avatar_url ? "inline-flex" : "none";
}

function bindSettingsEvents() {
  const avatarInput = document.getElementById("st-avatar-input");
  const avatarPickBtn = document.getElementById("st-avatar-pick");
  const avatarRemoveBtn = document.getElementById("st-avatar-remove");
  const avatarStatus = document.getElementById("st-avatar-status");

  if (avatarPickBtn && !avatarPickBtn.dataset.bound) {
    avatarPickBtn.dataset.bound = "1";
    avatarPickBtn.addEventListener("click", () => avatarInput.click());
  }

  if (avatarInput && !avatarInput.dataset.bound) {
    avatarInput.dataset.bound = "1";
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files[0];
      avatarInput.value = ""; // cho phép chọn lại đúng file này lần sau nếu cần
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Vui lòng chọn một tệp hình ảnh (jpg, png, ...).");
        return;
      }
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        alert("Ảnh quá lớn, vui lòng chọn ảnh dưới 5MB.");
        return;
      }

      if (avatarPickBtn) avatarPickBtn.disabled = true;
      if (avatarStatus) avatarStatus.textContent = "Đang tải ảnh lên...";

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${STATE.me.id}/avatar_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) {
        if (avatarPickBtn) avatarPickBtn.disabled = false;
        if (avatarStatus) avatarStatus.textContent = "";
        return alert("Lỗi tải ảnh lên: " + uploadError.message);
      }

      const { data: publicUrlData } = supabaseClient.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", STATE.me.id);

      if (avatarPickBtn) avatarPickBtn.disabled = false;

      if (updateError) {
        if (avatarStatus) avatarStatus.textContent = "";
        return alert("Lỗi lưu ảnh đại diện: " + updateError.message);
      }

      STATE.me.avatar_url = avatarUrl;
      STATE.profiles = await getAllProfiles();
      renderAvatarPreview();
      updateTopbar();
      if (avatarStatus) avatarStatus.textContent = "Đã cập nhật ảnh đại diện.";
    });
  }

  if (avatarRemoveBtn && !avatarRemoveBtn.dataset.bound) {
    avatarRemoveBtn.dataset.bound = "1";
    avatarRemoveBtn.addEventListener("click", async () => {
      if (!STATE.me.avatar_url) return;
      if (!confirm("Xoá ảnh đại diện và quay lại avatar màu mặc định?")) return;

      const { error } = await supabaseClient
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.avatar_url = null;
      STATE.profiles = await getAllProfiles();
      renderAvatarPreview();
      updateTopbar();
      if (avatarStatus) avatarStatus.textContent = "Đã xoá ảnh đại diện.";
    });
  }

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
  renderAvatarPreview();

  const awayToggle = document.getElementById("st-away-toggle");
  if (awayToggle) {
    awayToggle.checked = !!STATE.me.is_away;
    document.getElementById("st-away-dates").style.display = STATE.me.is_away ? "block" : "none";
    document.getElementById("st-away-from").value = STATE.me.away_from || "";
    document.getElementById("st-away-until").value = STATE.me.away_until || "";
  }

  bindSettingsEvents();
}
