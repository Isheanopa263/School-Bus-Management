/**
 * Complaints Page Controller
 */
(function () {
  let allComplaints = [];
  let currentFilter = "all";
  let processingId = null;

  init();

  async function init() {
    await loadComplaints();
    setupEvents();
  }

  // ── Load Data ─────────────────────────────────────────────────────────
  async function loadComplaints() {
    try {
      const data = await apiFetch("/complaints");
      allComplaints = data.complaints || [];
      updateStats();
      renderTable();
    } catch (err) {
      console.error("Load complaints error:", err);
      el("complaintsTableBody").innerHTML = `
        <tr><td colspan="7" class="loading">Failed to load complaints</td></tr>`;
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  function updateStats() {
    el("statOpen").textContent = allComplaints.filter(
      (c) => c.status === "open",
    ).length;
    el("statProgress").textContent = allComplaints.filter(
      (c) => c.status === "in_progress",
    ).length;
    el("statResolved").textContent = allComplaints.filter(
      (c) => c.status === "resolved",
    ).length;
    el("statClosed").textContent = allComplaints.filter(
      (c) => c.status === "closed",
    ).length;
  }

  // ── Render Table ──────────────────────────────────────────────────────
  function renderTable() {
    const tbody = el("complaintsTableBody");

    const filtered =
      currentFilter === "all"
        ? allComplaints
        : allComplaints.filter((c) => c.status === currentFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7" class="loading">
          ${currentFilter === "all" ? "No complaints" : `No ${currentFilter.replace("_", " ")} complaints`}
        </td></tr>`;
      return;
    }

    const categoryIcons = {
      sos: "🚨",
      breakdown: "🔧",
      route_deviation: "↗️",
      harsh_braking: "⚠️",
      overspeeding: "💨",
    };

    tbody.innerHTML = filtered
      .map(
        (c) => `
      <tr>
        <td>
          <div class="student-cell">
            <div class="student-avatar">${(c.raised_by_name || "?").charAt(0).toUpperCase()}</div>
            <div>
              <div class="student-name">${c.raised_by_name || "Unknown"}</div>
              <div class="student-meta">${c.raised_by_role || "-"}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="category-badge category-${c.category || "other"}">
            ${categoryIcons[c.category] || "📋"} ${(c.category || "other").replace("_", " ")}
          </span>
        </td>
        <td><div class="desc-cell">${c.description || "-"}</div></td>
        <td>
          <div class="priority-indicator">
            <span class="priority-dot ${c.priority || "medium"}"></span>
            ${c.priority || "medium"}
          </div>
        </td>
        <td>${c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</td>
        <td><span class="badge badge-${c.status}">${(c.status || "open").replace("_", " ")}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openResolve('${c.id}')">
            ${c.status === "resolved" || c.status === "closed" ? "View" : "Manage"}
          </button>
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

    // Resolve modal
    el("closeResolveModal").addEventListener("click", closeResolve);
    el("cancelResolveBtn").addEventListener("click", closeResolve);
    el("confirmResolveBtn").addEventListener("click", confirmResolve);
  }

  // ── Resolve Flow ──────────────────────────────────────────────────────
  window.openResolve = function (id) {
    processingId = id;
    const c = allComplaints.find((x) => x.id === id);
    if (!c) return;

    // Fill detail box
    el("complaintDetail").innerHTML = `
      <div class="complaint-detail-row">
        <span class="complaint-detail-label">Raised By</span>
        <span class="complaint-detail-value">${c.raised_by_name || "-"} (${c.raised_by_role || "-"})</span>
      </div>
      <div class="complaint-detail-row">
        <span class="complaint-detail-label">Category</span>
        <span class="complaint-detail-value">${(c.category || "other").replace("_", " ")}</span>
      </div>
      <div class="complaint-detail-row">
        <span class="complaint-detail-label">Bus</span>
        <span class="complaint-detail-value">${c.bus_number || "N/A"}</span>
      </div>
      <div class="complaint-detail-row">
        <span class="complaint-detail-label">Driver</span>
        <span class="complaint-detail-value">${c.driver_license || "N/A"}</span>
      </div>
      <div class="complaint-detail-row">
        <span class="complaint-detail-label">Trip Date</span>
        <span class="complaint-detail-value">${c.trip_date ? new Date(c.trip_date).toLocaleDateString() : "N/A"}</span>
      </div>
      <div class="complaint-detail-row">
        <span class="complaint-detail-label">Created</span>
        <span class="complaint-detail-value">${c.created_at ? new Date(c.created_at).toLocaleString() : "-"}</span>
      </div>`;

    el("complaintDescription").textContent =
      c.description || "No description provided";

    // Set current values
    el("resolveStatus").value = c.status || "open";
    el("resolvePriority").value = c.priority || "medium";
    el("resolveNotes").value = c.resolution_notes || "";

    el("resolveModal").classList.add("show");
  };

  function closeResolve() {
    el("resolveModal").classList.remove("show");
    processingId = null;
  }

  async function confirmResolve() {
    if (!processingId) return;

    const status = el("resolveStatus").value;
    const priority = el("resolvePriority").value;
    const notes = el("resolveNotes").value.trim();

    const btn = el("confirmResolveBtn");
    btn.disabled = true;
    btn.textContent = "Updating...";

    try {
      await apiFetch(`/complaints/${processingId}/resolve`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          priority,
          resolution_notes: notes || null,
        }),
      });

      closeResolve();
      await loadComplaints();
    } catch (err) {
      alert(err.message || "Failed to update complaint");
    } finally {
      btn.disabled = false;
      btn.textContent = "Update Complaint";
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function el(id) {
    return document.getElementById(id);
  }
})();
