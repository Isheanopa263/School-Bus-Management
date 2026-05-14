/**
 * Schedule Builder - Route Assignment Management
 */
(function () {
  let allAssignments = [];
  let currentFilter = "all";
  let deletingId = null;

  init();

  async function init() {
    await Promise.all([loadAssignments(), loadDropdowns()]);
    setupEvents();
  }

  // ── Load Assignments ──────────────────────────────────────────────────
  async function loadAssignments() {
    try {
      const data = await apiFetch("/route-assignments");
      allAssignments = data.assignments || [];
      renderAssignments();
    } catch (err) {
      console.error("Load assignments error:", err);
      el("assignmentsGrid").innerHTML = `
        <div class="schedule-empty">
          <div class="schedule-empty-icon">⚠️</div>
          <h3>Failed to load</h3>
        </div>`;
    }
  }

  // ── Render Cards ──────────────────────────────────────────────────────
  function renderAssignments() {
    const grid = el("assignmentsGrid");
    const filtered =
      currentFilter === "all"
        ? allAssignments
        : allAssignments.filter((a) => a.shift === currentFilter);

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="schedule-empty">
          <div class="schedule-empty-icon">📅</div>
          <h3>No Assignments</h3>
          <p>${currentFilter === "all" ? "Create your first assignment" : `No ${currentFilter} assignments`}</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered
      .map(
        (a) => `
      <div class="assignment-card">
        <div class="assignment-card-header">
          <div class="assignment-route">📍 ${a.route_name}</div>
          <span class="assignment-shift shift-${a.shift}">${a.shift}</span>
        </div>
        <div class="assignment-details">
          <div class="assignment-detail">
            <div class="assignment-detail-icon bus">🚌</div>
            <div>
              <div class="assignment-detail-label">Bus</div>
              <div class="assignment-detail-value">${a.bus_number}</div>
            </div>
          </div>
          <div class="assignment-detail">
            <div class="assignment-detail-icon driver">👤</div>
            <div>
              <div class="assignment-detail-label">Driver</div>
              <div class="assignment-detail-value">${a.driver_name}</div>
            </div>
          </div>
          <div class="assignment-detail">
            <div class="assignment-detail-icon date">📅</div>
            <div>
              <div class="assignment-detail-label">Period</div>
              <div class="assignment-detail-value">
                ${formatDate(a.effective_date)}${a.end_date ? ` → ${formatDate(a.end_date)}` : " → Ongoing"}
              </div>
            </div>
          </div>
        </div>
        <div class="assignment-card-footer">
          <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${a.id}', '${esc(a.route_name)}')">Delete</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // ── Load Dropdowns ────────────────────────────────────────────────────
  async function loadDropdowns() {
    try {
      const [routesData, busesData, driversData] = await Promise.all([
        apiFetch("/routes"),
        apiFetch("/buses"),
        apiFetch("/drivers"),
      ]);

      const routes = routesData.routes || [];
      const buses = (busesData.buses || []).filter(
        (b) => b.status === "active",
      );
      const drivers = (driversData.drivers || []).filter(
        (d) => d.employment_status === "active",
      );

      el("routeSelect").innerHTML =
        `<option value="">Select route...</option>` +
        routes
          .map((r) => `<option value="${r.rid}">${r.name}</option>`)
          .join("");

      el("busSelect").innerHTML =
        `<option value="">Select bus...</option>` +
        buses
          .map(
            (b) =>
              `<option value="${b.bid}">${b.registration_number} (${b.capacity} seats)</option>`,
          )
          .join("");

      el("driverSelect").innerHTML =
        `<option value="">Select driver...</option>` +
        drivers
          .map((d) => `<option value="${d.id}">${d.full_name}</option>`)
          .join("");

      // Default date to today
      el("effectiveDate").value = new Date().toISOString().split("T")[0];
    } catch (err) {
      console.error("Load dropdowns error:", err);
    }
  }

  // ── Events ────────────────────────────────────────────────────────────
  function setupEvents() {
    el("addAssignmentBtn").addEventListener("click", () =>
      el("assignmentModal").classList.add("show"),
    );
    el("closeAssignmentModal").addEventListener("click", closeModal);
    el("cancelAssignmentBtn").addEventListener("click", closeModal);
    el("saveAssignmentBtn").addEventListener("click", saveAssignment);

    el("closeDeleteModal").addEventListener("click", () =>
      el("deleteModal").classList.remove("show"),
    );
    el("cancelDeleteBtn").addEventListener("click", () =>
      el("deleteModal").classList.remove("show"),
    );
    el("confirmDeleteBtn").addEventListener("click", confirmDelete);

    // Filter tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderAssignments();
      });
    });
  }

  function closeModal() {
    el("assignmentModal").classList.remove("show");
  }

  // ── Save Assignment ───────────────────────────────────────────────────
  async function saveAssignment() {
    const routeId = el("routeSelect").value;
    const busId = el("busSelect").value;
    const driverId = el("driverSelect").value;
    const shift = el("shiftSelect").value;
    const effectiveDate = el("effectiveDate").value;
    const endDate = el("endDate").value;

    if (!routeId || !busId || !driverId || !shift || !effectiveDate) {
      return alert("Please fill all required fields");
    }

    const btn = el("saveAssignmentBtn");
    btn.disabled = true;
    btn.textContent = "Creating...";

    try {
      await apiFetch("/route-assignments", {
        method: "POST",
        body: JSON.stringify({
          route_id: routeId,
          bus_id: busId,
          driver_id: driverId,
          shift,
          effective_date: effectiveDate,
          end_date: endDate || null,
        }),
      });

      closeModal();
      await loadAssignments();
    } catch (err) {
      alert(err.message || "Failed to create assignment");
    } finally {
      btn.disabled = false;
      btn.textContent = "Create Assignment";
    }
  }

  // ── Delete Assignment ─────────────────────────────────────────────────
  window.deleteAssignment = function (id, name) {
    deletingId = id;
    el("deleteAssignmentName").textContent = name;
    el("deleteModal").classList.add("show");
  };

  async function confirmDelete() {
    if (!deletingId) return;

    const btn = el("confirmDeleteBtn");
    btn.disabled = true;
    btn.textContent = "Deleting...";

    try {
      await apiFetch(`/route-assignments/${deletingId}`, {
        method: "DELETE",
      });
      el("deleteModal").classList.remove("show");
      await loadAssignments();
    } catch (err) {
      alert(err.message || "Failed to delete");
    } finally {
      btn.disabled = false;
      btn.textContent = "Delete";
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function el(id) {
    return document.getElementById(id);
  }

  function esc(str) {
    return (str || "").replace(/'/g, "\\'");
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
})();
