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

// ---- Lưới chọn tiết học trong tuần (theo trường đã chọn ở "Trường học") ----

async function renderClassScheduleBlock() {
  const wrap = document.getElementById("st-class-schedule-wrap");
  const gridEl = document.getElementById("st-class-grid");
  const statusEl = document.getElementById("st-class-status");
  if (!wrap || !gridEl) return;
  if (statusEl) statusEl.textContent = "";

  const university = document.getElementById("st-university").value;
  if (!university) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  gridEl.innerHTML = `<p class="empty-state">Đang tải khung tiết...</p>`;

  const periods = await fetchClassPeriods(university);
  if (periods.length === 0) {
    gridEl.innerHTML = `<p class="empty-state">Chưa có dữ liệu khung tiết cho trường này.</p>`;
    return;
  }

  const existingRows = await fetchUserClassSchedule(STATE.me.id, { fresh: true });
  const ticks = new Set(
    existingRows
      .filter((r) => r.university === university)
      .map((r) => `${r.day_of_week}-${r.period_number}`)
  );

  const header = `<tr><th style="text-align:left;padding:4px 8px;">Tiết</th>${CLASS_GRID_DAYS.map(
    (d) => `<th style="padding:4px 8px;">${CLASS_WEEKDAY_SHORT[d]}</th>`
  ).join("")}</tr>`;

  const rows = periods
    .map((p) => {
      const timeLabel = `${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)}`;
      const cells = CLASS_GRID_DAYS.map((d) => {
        const key = `${d}-${p.period_number}`;
        const checked = ticks.has(key) ? "checked" : "";
        return `<td style="text-align:center;padding:4px 8px;"><input type="checkbox" data-day="${d}" data-period="${p.period_number}" ${checked} /></td>`;
      }).join("");
      return `<tr><td style="padding:4px 8px;white-space:nowrap;">Tiết ${p.period_number}<br><span style="font-size:11px;color:var(--ink-faint);">${timeLabel}</span></td>${cells}</tr>`;
    })
    .join("");

  gridEl.innerHTML = `<table class="class-schedule-table" style="width:100%;border-collapse:collapse;font-size:13px;">${header}${rows}</table>`;
}

async function saveClassSchedule() {
  const university = document.getElementById("st-university").value;
  const statusEl = document.getElementById("st-class-status");
  const saveBtn = document.getElementById("st-class-save");
  if (!university) return;

  const ticked = Array.from(
    document.querySelectorAll("#st-class-grid input[type=checkbox]:checked")
  ).map((cb) => ({
    user_id: STATE.me.id,
    day_of_week: Number(cb.dataset.day),
    period_number: Number(cb.dataset.period),
    university,
  }));

  if (saveBtn) saveBtn.disabled = true;
  if (statusEl) statusEl.textContent = "Đang lưu...";

  // Xoá hết lịch cũ của trường này rồi ghi lại toàn bộ — đơn giản, tránh phải diff từng ô.
  const { error: delErr } = await supabaseClient
    .from("user_class_schedule")
    .delete()
    .eq("user_id", STATE.me.id)
    .eq("university", university);
  if (delErr) {
    if (saveBtn) saveBtn.disabled = false;
    if (statusEl) statusEl.textContent = "";
    return alert("Lỗi: " + delErr.message);
  }

  if (ticked.length > 0) {
    const { error: insErr } = await supabaseClient.from("user_class_schedule").insert(ticked);
    if (insErr) {
      if (saveBtn) saveBtn.disabled = false;
      if (statusEl) statusEl.textContent = "";
      return alert("Lỗi: " + insErr.message);
    }
  }

  invalidateUserClassScheduleCache(STATE.me.id);
  if (saveBtn) saveBtn.disabled = false;
  if (statusEl) statusEl.textContent = "Đã lưu lịch học.";
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

  const universitySel = document.getElementById("st-university");
  if (universitySel && !universitySel.dataset.bound) {
    universitySel.dataset.bound = "1";
    universitySel.addEventListener("change", renderClassScheduleBlock);
  }

  const classSaveBtn = document.getElementById("st-class-save");
  if (classSaveBtn && !classSaveBtn.dataset.bound) {
    classSaveBtn.dataset.bound = "1";
    classSaveBtn.addEventListener("click", saveClassSchedule);
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
  const universityEl = document.getElementById("st-university");
  if (universityEl) universityEl.value = STATE.me.university || "";
  await renderClassScheduleBlock();
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
