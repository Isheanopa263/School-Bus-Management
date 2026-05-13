let schedules = [];
let buses = [];
let routes = [];
let drivers = [];
let selectedCell = null;

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

let resizingSchedule = null;
let startY = 0;
let startHeight = 0;
let startEndTime = "";
let wasDragging = false;

function startResize(e, schedule, block) {
  e.preventDefault();
  e.stopPropagation();

  resizingSchedule = schedule;
  startY = e.clientY;
  startHeight = block.offsetHeight;
  startEndTime = schedule.end_time;
  wasDragging = false;

  block.classList.add("resizing");
  document.body.style.cursor = "ns-resize";

  document.addEventListener("mousemove", doResize);
  document.addEventListener("mouseup", stopResize);
}

function doResize(e) {
  if (!resizingSchedule) return;
  wasDragging = true;
  const block = document.querySelector(
    `.schedule-block[data-id="${resizingSchedule.id}"]`,
  );
  const deltaY = e.clientY - startY;
  const newHeight = Math.max(30, startHeight + deltaY); // Min 30min

  // Snap to 15-min increments
  const snappedHeight = Math.round(newHeight / 15) * 15;
  block.style.height = `${snappedHeight}px`;

  // Update time display live
  const [startH, startM] = resizingSchedule.start_time.split(":").map(Number);
  const durationMins = snappedHeight;
  const newEndMins = startH * 60 + startM + durationMins;
  const endH = Math.floor(newEndMins / 60);
  const endM = newEndMins % 60;
  const newEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const timeEl = block.querySelector(".text-xs");
  timeEl.textContent = `${resizingSchedule.start_time.slice(0, 5)}-${newEndTime}`;
}

async function stopResize(e) {
  if (!resizingSchedule) return;

  document.removeEventListener("mousemove", doResize);
  document.removeEventListener("mouseup", stopResize);
  document.body.style.cursor = "";

  const block = document.querySelector(
    `.schedule-block[data-id="${resizingSchedule.id}"]`,
  );
  block.classList.remove("resizing");

  const newHeightPx = block.offsetHeight;
  const [startH, startM] = resizingSchedule.start_time.split(":").map(Number);
  const newEndMins = startH * 60 + startM + newHeightPx;

  if (newEndMins > 24 * 60) {
    showToast("Schedule cannot extend past midnight", "error");
    await loadSchedules();
    resizingSchedule = null;
    return;
  }

  const endH = Math.floor(newEndMins / 60);
  const endM = newEndMins % 60;
  const newEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

  // Check conflict before saving
  try {
    const conflictRes = await apiFetch("/api/schedules/check-conflict", {
      method: "POST",
      body: JSON.stringify({
        bus_id: resizingSchedule.bus_id,
        driver_id: resizingSchedule.driver_id,
        day_of_week: resizingSchedule.day_of_week,
        start_time: resizingSchedule.start_time,
        end_time: newEndTime,
        exclude_id: resizingSchedule.id,
      }),
    });

    if (conflictRes.hasConflict) {
      showToast(conflictRes.message, "error");
      await loadSchedules(); // Revert
      resizingSchedule = null;
      return;
    }

    // Save new end time
    await apiFetch(`/api/schedules/${resizingSchedule.id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...resizingSchedule,
        end_time: newEndTime,
      }),
    });

    showToast("Schedule resized");
    await loadSchedules();
  } catch (err) {
    showToast(err.message, "error");
    await loadSchedules();
  }

  resizingSchedule = null;
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  // Add Schedule button
  const addBtn = document.getElementById("addScheduleBtn");
  if (addBtn) {
    addBtn.onclick = () => openCreateModal();
  }

  // FIX: Cancel button
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.onclick = closeModal;
  }

  // Close modal on backdrop click
  const modal = document.getElementById("scheduleModal");
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem("token");
      window.location.href = "./index.html";
    };
  }

  // Wire up live checking
  document.getElementById("busSelect").onchange = checkConflictLive;
  document.getElementById("driverSelect").onchange = checkConflictLive;
  document.getElementById("daySelect").onchange = checkConflictLive;
  document.getElementById("startTime").onchange = checkConflictLive;
  document.getElementById("endTime").onchange = checkConflictLive;
  document.getElementById("busFilter").onchange = filterSchedules;
  document.getElementById("driverFilter").onchange = filterSchedules;

  await init();
});

async function init() {
  renderTimeLabels();
  renderGrid();
  await Promise.all([
    loadBuses(),
    loadRoutes(),
    loadDrivers(),
    loadSchedules(),
  ]);
  populateFilters();
}

function renderTimeLabels() {
  const container = document.getElementById("timeLabels");
  container.innerHTML = '<div class="day-header"></div>';
  HOURS.forEach((hour) => {
    const div = document.createElement("div");
    div.className = "time-slot";
    div.textContent = `${hour}:00`;
    container.appendChild(div);
  });
}

function renderGrid() {
  const grid = document.getElementById("scheduleGrid");
  grid.innerHTML = "";

  for (let day = 0; day < 7; day++) {
    const col = document.createElement("div");
    col.className = "day-column";
    col.dataset.day = day;

    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = DAYS[day];
    col.appendChild(header);

    const content = document.createElement("div");
    content.className = "day-content";
    content.style.height = `${HOURS.length * 60}px`;
    content.onclick = (e) => handleGridClick(e, day);
    col.appendChild(content);

    grid.appendChild(col);
  }
}

async function loadSchedules() {
  try {
    const res = await apiFetch("/api/schedules");
    schedules = res.schedules || [];
    renderSchedules();
  } catch (err) {
    console.error("Load schedules error:", err);
  }
}

async function loadBuses() {
  const res = await apiFetch("/api/buses");
  buses = res.buses || [];
}

async function loadRoutes() {
  const res = await apiFetch("/api/routes");
  routes = res.routes || [];
}

async function loadDrivers() {
  const res = await apiFetch("/api/drivers");
  drivers = res.drivers || [];
}

function populateFilters() {
  const busFilter = document.getElementById("busFilter");
  buses.forEach((b) => {
    busFilter.innerHTML += `<option value="${b.bid}">${b.registration_number}</option>`;
  });

  const driverFilter = document.getElementById("driverFilter");
  drivers.forEach((d) => {
    driverFilter.innerHTML += `<option value="${d.id}">${d.full_name}</option>`;
  });

  const busSelect = document.getElementById("busSelect");
  busSelect.innerHTML = buses
    .map((b) => `<option value="${b.bid}">${b.registration_number}</option>`)
    .join("");

  const routeSelect = document.getElementById("routeSelect");
  routeSelect.innerHTML = routes
    .map((r) => `<option value="${r.rid}">${r.name}</option>`)
    .join("");

  const driverSelect = document.getElementById("driverSelect");
  driverSelect.innerHTML = drivers
    .map((d) => `<option value="${d.id}">${d.full_name}</option>`)
    .join("");
}

// Real-time conflict checking
let checkTimeout;
async function checkConflictLive() {
  const id = document.getElementById("scheduleId").value;
  const bus_id = document.getElementById("busSelect").value;
  const driver_id = document.getElementById("driverSelect").value;
  const day_of_week = parseInt(document.getElementById("daySelect").value);
  const start_time = document.getElementById("startTime").value;
  const end_time = document.getElementById("endTime").value;

  if (!bus_id || !driver_id || !start_time || !end_time) return;

  clearTimeout(checkTimeout);
  checkTimeout = setTimeout(async () => {
    try {
      const res = await apiFetch("/api/schedules/check-conflict", {
        method: "POST",
        body: JSON.stringify({
          bus_id,
          driver_id,
          day_of_week,
          start_time,
          end_time,
          exclude_id: id || null,
        }),
      });

      const errorEl = document.getElementById("conflictError");
      if (res.hasConflict) {
        errorEl.textContent = res.message || "Schedule conflict detected";
        errorEl.style.color = "#ef4444";
      } else {
        errorEl.textContent = "✓ No conflicts";
        errorEl.style.color = "#10b981";
      }
    } catch (err) {
      console.error("Conflict check failed:", err);
    }
  }, 300); // Debounce 300ms
}

function renderSchedules() {
  document.querySelectorAll(".schedule-block").forEach((el) => el.remove());

  const busFilter = document.getElementById("busFilter").value;
  const driverFilter = document.getElementById("driverFilter").value;

  const filtered = schedules
    .filter((s) => !busFilter || s.bus_id === busFilter)
    .filter((s) => !driverFilter || s.driver_id === driverFilter);

  // Group by day to calculate overlaps
  const byDay = {};
  filtered.forEach((s) => {
    if (!byDay[s.day_of_week]) byDay[s.day_of_week] = [];
    byDay[s.day_of_week].push(s);
  });

  Object.keys(byDay).forEach((day) => {
    const daySchedules = byDay[day];
    const dayCol = document.querySelector(
      `.day-column[data-day="${day}"] .day-content`,
    );
    if (!dayCol) return;

    // Calculate overlap columns for each schedule
    daySchedules.forEach((schedule, i) => {
      const [startH, startM] = schedule.start_time.split(":").map(Number);
      const [endH, endM] = schedule.end_time.split(":").map(Number);
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      // Find which column this schedule should be in
      let column = 0;
      for (let j = 0; j < i; j++) {
        const other = daySchedules[j];
        const [oStartH, oStartM] = other.start_time.split(":").map(Number);
        const [oEndH, oEndM] = other.end_time.split(":").map(Number);
        const oStartMins = oStartH * 60 + oStartM;
        const oEndMins = oEndH * 60 + oEndM;

        // If overlaps and same column, bump column
        if (
          startMins < oEndMins &&
          endMins > oStartMins &&
          other._column === column
        ) {
          column++;
        }
      }
      schedule._column = column;

      const topPx = startMins;
      const heightPx = endMins - startMins;

      // Count total columns needed for this time slot
      const overlapping = daySchedules.filter((s) => {
        if (s.id === schedule.id) return false;
        const [sH, sM] = s.start_time.split(":").map(Number);
        const [eH, eM] = s.end_time.split(":").map(Number);
        const sMins = sH * 60 + sM;
        const eMins = eH * 60 + eM;
        return startMins < eMins && endMins > sMins;
      });

      const totalCols = Math.max(
        column + 1,
        ...overlapping.map((s) => (s._column || 0) + 1),
      );
      const widthPercent = 100 / totalCols;
      const leftPercent = column * widthPercent;

      const block = document.createElement("div");
      block.className = "schedule-block";
      block.dataset.id = schedule.id;
      block.style.top = `${topPx}px`;
      block.style.height = `${heightPx}px`;
      block.style.left = `calc(${leftPercent}% + 4px)`;
      block.style.width = `calc(${widthPercent}% - 8px)`;
      block.style.right = "auto";
      block.innerHTML = `
        <div class="bus-num">${schedule.bus_registration || schedule.registration_number || "N/A"}</div>
        <div>${schedule.route_name || "N/A"}</div>
        <div>${schedule.driver_name || "N/A"}</div>
        <div class="text-xs">${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}</div>
        <div class="resize-handle"></div>
        <button class="delete-btn" onclick="deleteSchedule('${schedule.id}', event)">×</button>
      `;

      block.onclick = (e) => {
        if (
          e.target.classList.contains("resize-handle") ||
          e.target.classList.contains("delete-btn")
        )
          return;
        if (wasDragging) {
          wasDragging = false;
          return;
        }
        e.stopPropagation();
        editSchedule(schedule);
      };

      const handle = block.querySelector(".resize-handle");
      handle.onmousedown = (e) => startResize(e, schedule, block);

      dayCol.appendChild(block);
    });
  });
}

function handleGridClick(e, day) {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const hour = Math.floor(y / 60);

  document.getElementById("daySelect").value = day;
  document.getElementById("startTime").value =
    `${String(hour).padStart(2, "0")}:00`;
  document.getElementById("endTime").value =
    `${String(hour + 1).padStart(2, "0")}:00`;

  openCreateModal();
}

function openCreateModal() {
  document.getElementById("modalTitle").textContent = "Create Schedule";
  document.getElementById("scheduleId").value = "";
  document.getElementById("scheduleForm").reset();
  document.getElementById("conflictError").textContent = "";
  document.getElementById("scheduleModal").classList.add("active");
}

function editSchedule(schedule) {
  document.getElementById("modalTitle").textContent = "Edit Schedule";
  document.getElementById("scheduleId").value = schedule.id;
  document.getElementById("busSelect").value = schedule.bus_id;
  document.getElementById("routeSelect").value = schedule.route_id;
  document.getElementById("driverSelect").value = schedule.driver_id;
  document.getElementById("daySelect").value = schedule.day_of_week;
  document.getElementById("startTime").value = schedule.start_time.slice(0, 5);
  document.getElementById("endTime").value = schedule.end_time.slice(0, 5);
  document.getElementById("scheduleModal").classList.add("active");
}

function closeModal() {
  document.getElementById("scheduleModal").classList.remove("active");
}

document.getElementById("scheduleForm").onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById("scheduleId").value;
  const data = {
    bus_id: document.getElementById("busSelect").value,
    route_id: document.getElementById("routeSelect").value,
    driver_id: document.getElementById("driverSelect").value,
    day_of_week: parseInt(document.getElementById("daySelect").value),
    start_time: document.getElementById("startTime").value,
    end_time: document.getElementById("endTime").value,
  };

  try {
    const conflictRes = await apiFetch("/api/schedules/check-conflict", {
      method: "POST",
      body: JSON.stringify({ ...data, exclude_id: id || null }),
    });

    if (conflictRes.hasConflict) {
      let msg = "Conflict detected: ";
      if (conflictRes.busConflict) msg += "Bus already scheduled. ";
      if (conflictRes.driverConflict) msg += "Driver already scheduled.";
      document.getElementById("conflictError").textContent = msg;
      return;
    }
  } catch (err) {
    document.getElementById("conflictError").textContent =
      "Failed to check conflicts";
    return;
  }

  try {
    if (id) {
      await apiFetch(`/api/schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } else {
      await apiFetch("/api/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }
    closeModal();
    await loadSchedules();
  } catch (err) {
    document.getElementById("conflictError").textContent = err.message;
  }
};

async function deleteSchedule(id, e) {
  e.stopPropagation();
  if (!confirm("Delete this schedule?")) return;
  try {
    await apiFetch(`/api/schedules/${id}`, { method: "DELETE" });
    await loadSchedules();
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }
}

function filterSchedules() {
  renderSchedules();
}
