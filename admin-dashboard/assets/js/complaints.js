let complaints = [];
let currentFilter = "open";
let currentComplaintId = null;

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  if (!requireAuth()) return;
  setupEventListeners();
  await loadComplaints();
}

function setupEventListeners() {
  // Filter tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.status;
      await loadComplaints(currentFilter);
    });
  });

  // Modal controls
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document
    .getElementById("resolveForm")
    .addEventListener("submit", handleResolve);

  // Close modal on outside click
  document.getElementById("resolveModal").addEventListener("click", (e) => {
    if (e.target.id === "resolveModal") closeModal();
  });
}

async function loadComplaints(status = currentFilter) {
  try {
    const url = status ? `/api/complaints?status=${status}` : "/api/complaints";
    const res = await apiFetch(url);
    complaints = res.complaints || [];
    renderTable();
  } catch (err) {
    console.error("Load complaints error:", err);
    document.getElementById("complaintsTableBody").innerHTML =
      `<tr><td colspan="7" class="error">Failed to load: ${err.message}</td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById("complaintsTableBody");

  if (!complaints || complaints.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading">No ${currentFilter || ""} complaints found.</td></tr>`;
    return;
  }

  tbody.innerHTML = complaints
    .map(
      (c) => `
    <tr>
      <td>
        <strong>${c.raised_by_name || "Unknown"}</strong><br>
        <small class="text-muted">${c.raised_by_role || "user"}</small>
      </td>
      <td>${c.category || "General"}</td>
      <td>
        ${c.bus_number ? `Bus: ${c.bus_number}<br>` : ""}
        ${c.driver_license ? `<small>Driver: ${c.driver_license}</small>` : "-"}
      </td>
      <td>
        <span class="badge ${c.priority || "medium"}">
          ${c.priority || "medium"}
        </span>
      </td>
      <td class="description-cell">
        ${truncate(c.description, 60)}
      </td>
      <td>
        <span class="badge ${c.status}">
          ${c.status.replace("_", " ")}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn-icon resolve-btn" data-id="${c.id}" title="View/Update">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  attachEventListeners();
}

function attachEventListeners() {
  document.querySelectorAll(".resolve-btn").forEach((btn) => {
    btn.addEventListener("click", () => openResolveModal(btn.dataset.id));
  });
}

function openResolveModal(complaintId) {
  const complaint = complaints.find((c) => c.id === complaintId);
  if (!complaint) return;

  currentComplaintId = complaintId;

  const detailsDiv = document.getElementById("complaintDetails");
  detailsDiv.innerHTML = `
    <div class="detail-row"><strong>Raised by:</strong> ${complaint.raised_by_name || "Unknown"} (${complaint.raised_by_role || "user"})</div>
    <div class="detail-row"><strong>Category:</strong> ${complaint.category || "General"}</div>
    <div class="detail-row"><strong>Created:</strong> ${formatDate(complaint.created_at)}</div>
    ${complaint.bus_number ? `<div class="detail-row"><strong>Bus:</strong> ${complaint.bus_number}</div>` : ""}
    ${complaint.driver_license ? `<div class="detail-row"><strong>Driver:</strong> ${complaint.driver_license}</div>` : ""}
    ${complaint.trip_date ? `<div class="detail-row"><strong>Trip:</strong> ${complaint.trip_date} - ${complaint.trip_type}</div>` : ""}
    <div class="detail-row"><strong>Description:</strong></div>
    <div class="detail-box">${complaint.description}</div>
  `;

  document.getElementById("complaintStatus").value = complaint.status;
  document.getElementById("complaintPriority").value =
    complaint.priority || "medium";
  document.getElementById("resolutionNotes").value =
    complaint.resolution_notes || "";

  document.getElementById("resolveModal").classList.add("active");
}

function closeModal() {
  document.getElementById("resolveModal").classList.remove("active");
  currentComplaintId = null;
}

async function handleResolve(e) {
  e.preventDefault();

  const status = document.getElementById("complaintStatus").value;
  const priority = document.getElementById("complaintPriority").value;
  const resolution_notes = document.getElementById("resolutionNotes").value;

  try {
    await apiFetch(`/api/complaints/${currentComplaintId}/resolve`, {
      method: "PUT",
      body: JSON.stringify({
        status,
        priority,
        resolution_notes,
      }),
    });

    closeModal();
    await loadComplaints();
  } catch (err) {
    console.error("Resolve error:", err);
    alert("Failed to update: " + err.message);
  }
}

function truncate(str, len) {
  if (!str) return "-";
  return str.length > len ? str.substring(0, len) + "..." : str;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
