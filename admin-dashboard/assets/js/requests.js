/**
 * Student Requests Page Controller
 */
(function () {
  let allRequests = [];
  let allRoutes = [];
  let currentFilter = "all";
  let processingId = null;
  let processingStudentId = null;

  init();

  async function init() {
    await Promise.all([loadRequests(), loadRoutes()]);
    setupEvents();
  }

  // ── Load Data ─────────────────────────────────────────────────────────
  async function loadRequests() {
    try {
      const data = await apiFetch("/bus-requests");
      allRequests = data.requests || [];
      updateStats();
      renderTable();
    } catch (err) {
      console.error("Load requests error:", err);
      el("requestsTableBody").innerHTML = `
        <tr><td colspan="7" class="loading">Failed to load requests</td></tr>`;
    }
  }

  async function loadRoutes() {
    try {
      const data = await apiFetch("/routes");
      allRoutes = data.routes || [];
      el("approveRouteSelect").innerHTML =
        `<option value="">Select route...</option>` +
        allRoutes
          .map((r) => `<option value="${r.rid}">${r.name}</option>`)
          .join("");
    } catch (err) {
      console.error("Load routes error:", err);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  function updateStats() {
    el("statPending").textContent = allRequests.filter(
      (r) => r.status === "pending",
    ).length;
    el("statApproved").textContent = allRequests.filter(
      (r) => r.status === "approved",
    ).length;
    el("statRejected").textContent = allRequests.filter(
      (r) => r.status === "rejected",
    ).length;
  }

  // ── Render Table ──────────────────────────────────────────────────────
  function renderTable() {
    const tbody = el("requestsTableBody");

    const filtered =
      currentFilter === "all"
        ? allRequests
        : allRequests.filter((r) => r.status === currentFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="loading">
            ${currentFilter === "all" ? "No requests yet" : `No ${currentFilter} requests`}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (req) => `
      <tr>
        <td>
          <div class="student-cell">
            <div class="student-avatar">${(req.student_name || "?").charAt(0).toUpperCase()}</div>
            <div>
              <div class="student-name">${req.student_name || "-"}</div>
              <div class="student-meta">${req.student_email || "-"}</div>
            </div>
          </div>
        </td>
        <td>${req.roll || "-"}</td>
        <td>${req.student_phone || req.emergency_contact_phone || "-"}</td>
        <td>${
          req.stop_name
            ? `<span style="color:var(--primary);font-weight:600">📍 ${req.stop_name}</span>`
            : `<span style="color:var(--text-muted)">Not assigned</span>`
        }
        </td>
        <td>${req.created_at ? new Date(req.created_at).toLocaleDateString() : "-"}</td>
        <td><span class="badge badge-${req.status}">${req.status}</span></td>
        <td>
          <div class="request-actions">
            ${
              req.status === "pending"
                ? `
              <button class="btn btn-success btn-sm" onclick="openApprove('${req.id}', '${esc(req.student_name)}', '${req.student_id}')">
                Approve
              </button>
              <button class="btn btn-danger btn-sm" onclick="openReject('${req.id}', '${esc(req.student_name)}')">
                Reject
              </button>`
                : `
              <span style="font-size:12px;color:var(--text-muted)">
                ${req.status === "approved" ? "✅ Approved" : "❌ Rejected"}
              </span>`
            }
          </div>
        </td>
      </tr>`,
      )
      .join("");
  }

  // ── Events ────────────────────────────────────────────────────────────
  function setupEvents() {
    // Filter tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderTable();
      });
    });

    // Approve modal
    el("closeApproveModal").addEventListener("click", () =>
      el("approveModal").classList.remove("show"),
    );
    el("cancelApproveBtn").addEventListener("click", () =>
      el("approveModal").classList.remove("show"),
    );
    el("confirmApproveBtn").addEventListener("click", confirmApprove);

    // Route → Stop cascade
    el("approveRouteSelect").addEventListener("change", loadStopsForRoute);

    // Reject modal
    el("closeRejectModal").addEventListener("click", () =>
      el("rejectModal").classList.remove("show"),
    );
    el("cancelRejectBtn").addEventListener("click", () =>
      el("rejectModal").classList.remove("show"),
    );
    el("confirmRejectBtn").addEventListener("click", confirmReject);
  }

  // ── Approve Flow ──────────────────────────────────────────────────────
  window.openApprove = function (requestId, studentName, studentId) {
    processingId = requestId;
    processingStudentId = studentId;

    // Find request details
    const req = allRequests.find((r) => r.id === requestId);

    el("approveStudentInfo").innerHTML = `
      <div class="request-info-row">
        <span class="request-info-label">Student</span>
        <span class="request-info-value">${req.student_name}</span>
      </div>
      <div class="request-info-row">
        <span class="request-info-label">Email</span>
        <span class="request-info-value">${req.student_email || "-"}</span>
      </div>
      <div class="request-info-row">
        <span class="request-info-label">Phone</span>
        <span class="request-info-value">${req.student_phone || "-"}</span>
      </div>
      <div class="request-info-row">
        <span class="request-info-label">Roll No</span>
        <span class="request-info-value">${req.roll || "-"}</span>
      </div>`;

    // Reset selects
    el("approveRouteSelect").value = "";
    el("approveStopSelect").innerHTML =
      `<option value="">Select route first...</option>`;
    el("approveNotes").value = "";

    el("approveModal").classList.add("show");
  };

  async function loadStopsForRoute() {
    const routeId = el("approveRouteSelect").value;
    const stopSelect = el("approveStopSelect");

    if (!routeId) {
      stopSelect.innerHTML = `<option value="">Select route first...</option>`;
      return;
    }

    stopSelect.innerHTML = `<option value="">Loading stops...</option>`;

    try {
      const data = await apiFetch(`/stops?route_id=${routeId}`);
      const stops = data.stops || [];

      if (stops.length === 0) {
        stopSelect.innerHTML = `<option value="">No stops for this route</option>`;
        return;
      }

      stopSelect.innerHTML =
        `<option value="">Select stop...</option>` +
        stops
          .map(
            (s) =>
              `<option value="${s.id}">${s.sequence_number}. ${s.name}</option>`,
          )
          .join("");
    } catch (err) {
      stopSelect.innerHTML = `<option value="">Failed to load stops</option>`;
    }
  }

  async function confirmApprove() {
    const routeId = el("approveRouteSelect").value;
    const stopId = el("approveStopSelect").value;
    const notes = el("approveNotes").value.trim();

    if (!routeId || !stopId) {
      return alert("Please select a route and stop");
    }

    const btn = el("confirmApproveBtn");
    btn.disabled = true;
    btn.textContent = "Approving...";

    try {
      await apiFetch(`/bus-requests/${processingId}/approve`, {
        method: "PUT",
        body: JSON.stringify({
          stop_id: stopId,
          route_id: routeId,
          admin_notes: notes || null,
        }),
      });

      el("approveModal").classList.remove("show");
      await loadRequests();
    } catch (err) {
      alert(err.message || "Failed to approve request");
    } finally {
      btn.disabled = false;
      btn.textContent = "Approve";
    }
  }

  // ── Reject Flow ───────────────────────────────────────────────────────
  window.openReject = function (requestId, studentName) {
    processingId = requestId;
    el("rejectStudentName").textContent = studentName;
    el("rejectNotes").value = "";
    el("rejectModal").classList.add("show");
  };

  async function confirmReject() {
    const notes = el("rejectNotes").value.trim();
    if (!notes) return alert("Please provide a reason for rejection");

    const btn = el("confirmRejectBtn");
    btn.disabled = true;
    btn.textContent = "Rejecting...";

    try {
      await apiFetch(`/bus-requests/${processingId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ admin_notes: notes }),
      });

      el("rejectModal").classList.remove("show");
      await loadRequests();
    } catch (err) {
      alert(err.message || "Failed to reject request");
    } finally {
      btn.disabled = false;
      btn.textContent = "Reject";
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function el(id) {
    return document.getElementById(id);
  }
  function esc(str) {
    return (str || "").replace(/'/g, "\\'");
  }
})();
