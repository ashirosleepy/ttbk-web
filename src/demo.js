import { createClient } from "@supabase/supabase-js";
import { runLegacy } from "./generated/login-legacy.js";

window.supabase = { createClient };
runLegacy();

document.querySelectorAll(".nav-item[data-section]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-section]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(`section-${button.dataset.section}`)?.classList.add("active");
    document.getElementById("topbar-title").textContent = button.textContent.trim();
  });
});

document.getElementById("btn-menu-toggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("nav-backdrop")?.classList.toggle("show");
});
document.getElementById("nav-backdrop")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("nav-backdrop")?.classList.remove("show");
});

document.querySelectorAll("#demo-filters .filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#demo-filters .filter-chip").forEach((item) => item.classList.remove("on"));
    chip.classList.add("on");
  });
});

document.querySelectorAll(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    document.querySelectorAll(".color-dot").forEach((item) => item.classList.remove("on"));
    dot.classList.add("on");
  });
});

document.querySelectorAll(".task-check:not(.done)").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("done");
    button.textContent = button.classList.contains("done") ? "✓" : "";
  });
});

const grid = document.getElementById("cal-grid-demo");
if (grid) {
  const weekdayHeader = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    .map((day) => `<div class="cal-weekday">${day}</div>`).join("");
  const sample = {
    3: [{ title: "Rửa bát", className: "cal-chip-done" }],
    5: [{ title: "Hút bụi", className: "cal-chip-missed" }],
    9: [{ title: "Nấu ăn tối", className: "cal-chip-done" }, { title: "Đổ rác", className: "cal-chip-todo" }],
    12: [{ title: "Thay bình nước", className: "cal-chip-future" }],
    18: [{ title: "Lau cửa sổ", className: "cal-chip-future" }],
    24: [{ title: "Dọn ban công", className: "cal-chip-future" }],
  };
  let cells = "";
  for (let index = 0; index < 35; index += 1) {
    const day = index;
    const dayNumber = day - 1 + 1;
    const outside = dayNumber < 1 || dayNumber > 30;
    const label = outside ? (dayNumber < 1 ? 31 + dayNumber : dayNumber - 30) : dayNumber;
    const items = (sample[dayNumber] || []).map((item) => `<div class="cal-chip ${item.className}">${item.title}</div>`).join("");
    cells += `<div class="cal-day ${outside ? "outside" : ""} ${dayNumber === 9 ? "today" : ""}"><div class="cal-day-num">${label}</div><div class="cal-day-chips">${items}</div></div>`;
  }
  grid.innerHTML = weekdayHeader + cells;
}
