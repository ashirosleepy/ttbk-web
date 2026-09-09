// ============================================================
// SETTINGS.JS — trang "Cài đặt" (hồ sơ cá nhân)
// ============================================================

// ---- Cắt ảnh đại diện thành hình vuông theo ý người dùng ----
// Trước đây ảnh tải lên bị CSS (object-fit: cover) tự động cắt theo tâm ảnh,
// nên với ảnh không vuông người dùng không tự chọn được phần muốn giữ lại.
// Cách xử lý: khi chọn ảnh, mở 1 khung cắt hình vuông (kéo để di chuyển,
// thanh trượt để phóng to/thu nhỏ), rồi xuất ra 1 ảnh vuông thật sự trước khi upload.
const AVATAR_CROP_OUTPUT_SIZE = 512; // kích thước (px) ảnh vuông xuất ra để upload

function ensureAvatarCropModal() {
  if (document.getElementById("avatar-crop-modal")) return;
  const modal = document.createElement("div");
  modal.className = "calendar-detail-modal avatar-crop-modal";
  modal.id = "avatar-crop-modal";
  modal.innerHTML = `
    <div class="calendar-detail-backdrop" id="avatar-crop-backdrop"></div>
    <div class="calendar-detail-panel avatar-crop-panel">
      <div class="calendar-detail-head">
        <div>
          <span class="calendar-detail-kicker">Ảnh đại diện</span>
          <h3>Chọn vùng ảnh</h3>
        </div>
        <button type="button" class="calendar-detail-close" id="avatar-crop-close">×</button>
      </div>
      <div class="avatar-crop-stage-wrap">
        <div class="avatar-crop-stage" id="avatar-crop-stage">
          <img id="avatar-crop-img" draggable="false" alt="" />
        </div>
      </div>
      <div class="avatar-crop-zoom-row">
        <span>−</span>
        <input type="range" id="avatar-crop-zoom" min="1" max="3" step="0.01" value="1" />
        <span>+</span>
      </div>
      <p class="avatar-crop-hint">Kéo ảnh để di chuyển, dùng thanh trượt để phóng to / thu nhỏ vùng chọn.</p>
      <div class="avatar-crop-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="avatar-crop-cancel">Huỷ</button>
        <button type="button" class="btn btn-primary btn-sm" id="avatar-crop-confirm">Dùng ảnh này</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Mở khung cắt ảnh cho 1 file đã chọn, trả về Promise<Blob|null>
// (null nếu người dùng bấm Huỷ/đóng mà không xác nhận).
function openAvatarCropper(file) {
  return new Promise((resolve) => {
    ensureAvatarCropModal();
    const modal = document.getElementById("avatar-crop-modal");
    const stage = document.getElementById("avatar-crop-stage");
    const img = document.getElementById("avatar-crop-img");
    let zoomInput = document.getElementById("avatar-crop-zoom");
    let closeBtn = document.getElementById("avatar-crop-close");
    let cancelBtn = document.getElementById("avatar-crop-cancel");
    let confirmBtn = document.getElementById("avatar-crop-confirm");
    let backdrop = document.getElementById("avatar-crop-backdrop");

    const objectUrl = URL.createObjectURL(file);
    let baseScale = 1;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let naturalW = 0;
    let naturalH = 0;
    let stageSize = 0;
    let dragging = false;
    let dragStart = null;
    let settled = false;

    function applyTransform() {
      img.style.width = `${naturalW * scale}px`;
      img.style.height = `${naturalH * scale}px`;
      img.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    // Không cho kéo/zoom làm lộ viền trắng ngoài ảnh
    function clampOffset() {
      const w = naturalW * scale;
      const h = naturalH * scale;
      offsetX = Math.min(0, Math.max(stageSize - w, offsetX));
      offsetY = Math.min(0, Math.max(stageSize - h, offsetY));
    }

    function onLoad() {
      naturalW = img.naturalWidth;
      naturalH = img.naturalHeight;
      stageSize = stage.clientWidth;
      // baseScale = mức zoom nhỏ nhất để ảnh luôn phủ kín khung vuông
      baseScale = Math.max(stageSize / naturalW, stageSize / naturalH);
      scale = baseScale;
      offsetX = (stageSize - naturalW * scale) / 2;
      offsetY = (stageSize - naturalH * scale) / 2;
      zoomInput.value = "1";
      clampOffset();
      applyTransform();
    }
    img.addEventListener("load", onLoad, { once: true });
    img.src = objectUrl;

    function onZoom() {
      const factor = parseFloat(zoomInput.value); // 1 = baseScale, tối đa 3x
      const prevScale = scale;
      scale = baseScale * factor;
      // Giữ nguyên tâm khung khi phóng to/thu nhỏ để không bị "nhảy" ảnh
      const cx = stageSize / 2;
      const cy = stageSize / 2;
      offsetX = cx - ((cx - offsetX) / prevScale) * scale;
      offsetY = cy - ((cy - offsetY) / prevScale) * scale;
      clampOffset();
      applyTransform();
    }
    zoomInput.addEventListener("input", onZoom);

    function pointerDown(e) {
      dragging = true;
      const p = e.touches ? e.touches[0] : e;
      dragStart = { x: p.clientX - offsetX, y: p.clientY - offsetY };
      stage.classList.add("dragging");
    }
    function pointerMove(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      offsetX = p.clientX - dragStart.x;
      offsetY = p.clientY - dragStart.y;
      clampOffset();
      applyTransform();
      if (e.cancelable) e.preventDefault();
    }
    function pointerUp() {
      dragging = false;
      stage.classList.remove("dragging");
    }
    stage.addEventListener("mousedown", pointerDown);
    window.addEventListener("mousemove", pointerMove);
    window.addEventListener("mouseup", pointerUp);
    stage.addEventListener("touchstart", pointerDown, { passive: true });
    window.addEventListener("touchmove", pointerMove, { passive: false });
    window.addEventListener("touchend", pointerUp);

    function cleanup() {
      modal.classList.remove("show");
      img.removeEventListener("load", onLoad);
      stage.removeEventListener("mousedown", pointerDown);
      window.removeEventListener("mousemove", pointerMove);
      window.removeEventListener("mouseup", pointerUp);
      stage.removeEventListener("touchstart", pointerDown);
      window.removeEventListener("touchmove", pointerMove);
      window.removeEventListener("touchend", pointerUp);
      // Thay các nút bằng bản sao "sạch" để gỡ hết listener,
      // tránh cộng dồn listener nếu người dùng mở khung cắt nhiều lần.
      zoomInput.replaceWith(zoomInput.cloneNode(true));
      closeBtn.replaceWith(closeBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      backdrop.replaceWith(backdrop.cloneNode(true));
      URL.revokeObjectURL(objectUrl);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    closeBtn.addEventListener("click", () => finish(null));
    cancelBtn.addEventListener("click", () => finish(null));
    backdrop.addEventListener("click", () => finish(null));

    confirmBtn.addEventListener("click", () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_CROP_OUTPUT_SIZE;
      canvas.height = AVATAR_CROP_OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      const ratio = AVATAR_CROP_OUTPUT_SIZE / stageSize;
      ctx.drawImage(
        img,
        0, 0, naturalW, naturalH,
        offsetX * ratio, offsetY * ratio, naturalW * scale * ratio, naturalH * scale * ratio
      );
      canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.92);
    });

    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

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

      // Cho người dùng tự chọn vùng ảnh (kéo/zoom) thay vì để CSS tự cắt theo tâm.
      const croppedBlob = await openAvatarCropper(file);
      if (!croppedBlob) return; // người dùng bấm Huỷ

      if (avatarPickBtn) avatarPickBtn.disabled = true;
      if (avatarStatus) avatarStatus.textContent = "Đang tải ảnh lên...";

      // Ảnh cắt luôn xuất ra dạng jpg (xem openAvatarCropper / canvas.toBlob).
      const path = `${STATE.me.id}/avatar_${Date.now()}.jpg`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, croppedBlob, { upsert: true, cacheControl: "3600", contentType: "image/jpeg" });
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
      const universityEl = document.getElementById("st-university");
      const university = universityEl ? universityEl.value : STATE.me.university || "";
      const activeDot = document.querySelector("#st-colors .color-dot.on");
      const color = activeDot ? activeDot.dataset.color : STATE.me.avatar_color;
      if (!name) return alert("Tên không được để trống.");

      const { error } = await supabaseClient
        .from("profiles")
        .update({ name, household, avatar_color: color, university: university || null })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.name = name;
      STATE.me.household = household;
      STATE.me.avatar_color = color;
      STATE.me.university = university || null;
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

      if (isAway && STATE.me.status === "SICK") {
        alert("Bạn đang ở trạng thái Ốm — hãy tắt trạng thái ốm trước nếu muốn bật Đi vắng.");
        return;
      }
      const newStatus = isAway ? "AWAY" : (STATE.me.busy_level > 0 ? "BUSY" : "AVAILABLE");

      const { error } = await supabaseClient
        .from("profiles")
        .update({ is_away: isAway, away_from: awayFrom, away_until: awayUntil, status: newStatus })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.is_away = isAway;
      STATE.me.away_from = awayFrom;
      STATE.me.away_until = awayUntil;
      STATE.me.status = newStatus;
      STATE.profiles = await getAllProfiles();

      await logHistory(
        null,
        STATE.me.id,
        isAway ? "bat_dau_vang" : "ket_thuc_vang",
        isAway
          ? `${STATE.me.name} bật chế độ đi vắng${awayUntil ? " đến " + formatDateShort(awayUntil) : ""}.`
          : `${STATE.me.name} đã tắt chế độ đi vắng (quay lại).`
      );

      // Khi bật đi vắng: đưa việc chưa xong vào hàng chờ để người khác "Nhận thay"
      // (giữ đúng hành vi cũ, chỉ tách ra thành hàm dùng chung với Sick Mode).
      if (isAway && typeof reassignTasksForUnavailableUser === "function") {
        await reassignTasksForUnavailableUser(STATE.me.id);
      }

      alert(isAway ? "Đã bật chế độ đi vắng." : "Đã tắt chế độ đi vắng.");
    });
  }

  // ---------- Phương tiện & tốc độ di chuyển ----------
  const saveLocationBtn = document.getElementById("save-location");
  if (saveLocationBtn && !saveLocationBtn.dataset.bound) {
    saveLocationBtn.dataset.bound = "1";
    saveLocationBtn.addEventListener("click", async () => {
      const payload = {
        transport_type: document.getElementById("st-transport").value,
        average_speed_kmh:
          Number(document.getElementById("st-speed").value) || DEFAULT_TRAVEL_SPEED_KMH[document.getElementById("st-transport").value] || 25,
      };

      const { error } = await supabaseClient.from("profiles").update(payload).eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      Object.assign(STATE.me, payload);
      STATE.profiles = await getAllProfiles();
      const statusEl = document.getElementById("st-location-status");
      if (statusEl) statusEl.textContent = "Đã lưu phương tiện & tốc độ di chuyển.";
    });
  }

  const transportEl = document.getElementById("st-transport");
  const speedEl = document.getElementById("st-speed");
  if (transportEl && speedEl && !transportEl.dataset.speedBound) {
    transportEl.dataset.speedBound = "1";
    transportEl.addEventListener("change", () => {
      const defaultSpeed = DEFAULT_TRAVEL_SPEED_KMH[transportEl.value];
      if (defaultSpeed) speedEl.value = defaultSpeed;
    });
  }

  // ---------- Mức độ bận (Status Engine) ----------
  const saveBusyBtn = document.getElementById("save-busy-level");
  if (saveBusyBtn && !saveBusyBtn.dataset.bound) {
    saveBusyBtn.dataset.bound = "1";
    saveBusyBtn.addEventListener("click", async () => {
      const level = Number(document.getElementById("st-busy-level").value) || 0;
      const reason = document.getElementById("st-busy-reason").value.trim() || null;

      // Không ghi đè trạng thái nếu đang Ốm/Đi vắng — 2 trạng thái đó ưu tiên cao hơn.
      if (STATE.me.status === "SICK" || STATE.me.status === "AWAY" || STATE.me.is_away) {
        alert("Bạn đang ở trạng thái Ốm/Đi vắng — hãy tắt trạng thái đó trước nếu muốn đổi mức độ bận.");
        return;
      }

      const { error } = await supabaseClient
        .from("profiles")
        .update({ status: level > 0 ? "BUSY" : "AVAILABLE", busy_level: level, busy_reason: reason })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.status = level > 0 ? "BUSY" : "AVAILABLE";
      STATE.me.busy_level = level;
      STATE.me.busy_reason = reason;
      STATE.profiles = await getAllProfiles();
      alert("Đã lưu mức độ bận.");
    });
  }

  // ---------- Sick Mode ----------
  const sickToggle = document.getElementById("st-sick-toggle");
  const sickDatesWrap = document.getElementById("st-sick-dates");
  if (sickToggle && !sickToggle.dataset.bound) {
    sickToggle.dataset.bound = "1";
    sickToggle.addEventListener("change", () => {
      sickDatesWrap.style.display = sickToggle.checked ? "block" : "none";
      if (sickToggle.checked && !document.getElementById("st-sick-from").value) {
        document.getElementById("st-sick-from").value = todayStr();
      }
    });
  }

  const saveSickBtn = document.getElementById("save-sick-status");
  if (saveSickBtn && !saveSickBtn.dataset.bound) {
    saveSickBtn.dataset.bound = "1";
    saveSickBtn.addEventListener("click", async () => {
      const isSick = document.getElementById("st-sick-toggle").checked;
      const sickFrom = isSick ? (document.getElementById("st-sick-from").value || todayStr()) : null;
      const sickUntil = isSick ? (document.getElementById("st-sick-until").value || null) : null;
      const newStatus = isSick ? "SICK" : (STATE.me.busy_level > 0 ? "BUSY" : "AVAILABLE");

      const { error } = await supabaseClient
        .from("profiles")
        .update({ status: newStatus, sick_from: sickFrom, sick_until: sickUntil })
        .eq("id", STATE.me.id);
      if (error) return alert("Lỗi: " + error.message);

      STATE.me.status = newStatus;
      STATE.me.sick_from = sickFrom;
      STATE.me.sick_until = sickUntil;
      STATE.profiles = await getAllProfiles();

      await logHistory(
        null,
        STATE.me.id,
        isSick ? "bat_dau_om" : "khoi_om",
        isSick
          ? `${STATE.me.name} báo ốm${sickUntil ? ", dự kiến khỏi " + formatDateShort(sickUntil) : ""}.`
          : `${STATE.me.name} đã tắt trạng thái ốm (quay lại làm việc).`
      );

      // Khi báo ốm: đưa việc chưa xong (không tính việc luân phiên) vào hàng chờ
      // để người khác nhận thay, đúng như đề xuất "Không phạt điểm khi ốm".
      if (isSick && typeof reassignTasksForUnavailableUser === "function") {
        await reassignTasksForUnavailableUser(STATE.me.id);
      }

      alert(isSick ? "Đã bật chế độ ốm — việc chưa xong của bạn sẽ không bị phạt và được đưa vào hàng chờ chia lại." : "Đã tắt chế độ ốm, chúc mừng bạn khoẻ lại!");
    });
  }

  const logoutBtn = document.getElementById("st-logout");
  if (!logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "1";
    logoutBtn.addEventListener("click", logout);
  }
}

// Nếu ngày dự kiến khỏi đã qua mà vẫn đang để chế độ Ốm, hỏi lại xem đã khoẻ
// chưa trước khi tự tắt — đúng đề xuất "Sau ngày khỏi hệ thống hỏi bạn đã khoẻ chưa".
async function checkSickRecoveryPrompt() {
  if (STATE.me.status !== "SICK" || !STATE.me.sick_until) return;
  if (STATE.me.sick_until >= todayStr()) return; // chưa tới/qua ngày dự kiến khỏi

  const recovered = confirm(`Đã quá ngày bạn dự kiến khỏi ốm (${formatDateShort(STATE.me.sick_until)}). Bạn đã khoẻ chưa?`);
  if (!recovered) return; // vẫn còn ốm -> giữ nguyên, hỏi lại lần load sau

  const newStatus = STATE.me.busy_level > 0 ? "BUSY" : "AVAILABLE";
  const { error } = await supabaseClient
    .from("profiles")
    .update({ status: newStatus, sick_from: null, sick_until: null })
    .eq("id", STATE.me.id);
  if (error) return alert("Lỗi: " + error.message);

  STATE.me.status = newStatus;
  STATE.me.sick_from = null;
  STATE.me.sick_until = null;
  STATE.profiles = await getAllProfiles();

  await logHistory(null, STATE.me.id, "khoi_om", `${STATE.me.name} xác nhận đã khoẻ, quay lại làm việc.`);

  const sickToggle = document.getElementById("st-sick-toggle");
  if (sickToggle) {
    sickToggle.checked = false;
    document.getElementById("st-sick-dates").style.display = "none";
  }
}

async function loadSettingsSection() {
  document.getElementById("st-name").value = STATE.me.name;
  document.getElementById("st-household").value = STATE.me.household || "Nhà TTBK";
  const universityEl = document.getElementById("st-university");
  if (universityEl) universityEl.value = STATE.me.university || "";
  renderColorPicker();
  renderAvatarPreview();

  const awayToggle = document.getElementById("st-away-toggle");
  if (awayToggle) {
    awayToggle.checked = !!STATE.me.is_away;
    document.getElementById("st-away-dates").style.display = STATE.me.is_away ? "block" : "none";
    document.getElementById("st-away-from").value = STATE.me.away_from || "";
    document.getElementById("st-away-until").value = STATE.me.away_until || "";
  }

  const sickToggle = document.getElementById("st-sick-toggle");
  if (sickToggle) {
    sickToggle.checked = STATE.me.status === "SICK";
    document.getElementById("st-sick-dates").style.display = STATE.me.status === "SICK" ? "block" : "none";
    document.getElementById("st-sick-from").value = STATE.me.sick_from || "";
    document.getElementById("st-sick-until").value = STATE.me.sick_until || "";
  }

  const busyLevelEl = document.getElementById("st-busy-level");
  if (busyLevelEl) busyLevelEl.value = String(STATE.me.busy_level ?? 0);
  const busyReasonEl = document.getElementById("st-busy-reason");
  if (busyReasonEl) busyReasonEl.value = STATE.me.busy_reason || "";

  const transportEl = document.getElementById("st-transport");
  if (transportEl) transportEl.value = STATE.me.transport_type || "motorbike";
  const speedEl = document.getElementById("st-speed");
  if (speedEl) speedEl.value = STATE.me.average_speed_kmh ?? DEFAULT_TRAVEL_SPEED_KMH[transportEl?.value] ?? 25;
  const distanceEl = document.getElementById("st-travel-distance");
  const distance = UNIVERSITY_TRAVEL_DISTANCE_KM[STATE.me.university];
  if (distanceEl) {
    distanceEl.textContent = distance == null
      ? "Chưa chọn trường nên hệ thống dùng thời gian đệm mặc định."
      : `Khoảng cách áp dụng: ${String(distance).replace(".", ",")} km từ nhà đến ${STATE.me.university}.`;
  }

  bindSettingsEvents();
  await checkSickRecoveryPrompt();
}
