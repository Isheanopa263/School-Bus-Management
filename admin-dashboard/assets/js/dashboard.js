const API_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  if (!requireAuth()) return;
  setDate();
  await Promise.all([
    loadStats(),
    loadRecentRequests(),
    loadRecentComplaints(),
  ]);
}

function setDate() {
  document.getElementById("currentDate").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
}

async function loadStats() {
  try {
    const res = await apiFetch("/api/stats");
    const s = res.stats || {};

    document.getElementById("totalBuses").textContent = s.total_buses || 0;
    document.getElementById("activeBuses").textContent =
      `${s.active_buses || 0} active`;
    document.getElementById("totalDrivers").textContent = s.total_drivers || 0;
    document.getElementById("activeDrivers").textContent =
      `${s.active_drivers || 0} active`;
    document.getElementById("pendingRequests").textContent =
      s.pending_requests || 0;
    document.getElementById("openComplaints").textContent =
      s.open_complaints || 0;
  } catch (err) {
    console.error("Load stats error:", err);
  }
}

async function loadRecentRequests() {
  try {
    const res = await apiFetch("/api/bus-requests?limit=5");
    const requests = res.requests || [];
    const container = document.getElementById("recentRequests");

    if (!requests.length) {
      container.innerHTML = '<div class="empty">No recent requests</div>';
      return;
    }

    container.innerHTML = requests
      .map(
        (r) => `
      <div class="activity-item">
        <div class="activity-main">
          <strong>${r.student_name}</strong>
          <span class="badge ${r.status}">${r.status}</span>
        </div>
        <div class="activity-meta">${r.pickup_location} • ${formatDate(r.created_at)}</div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    document.getElementById("recentRequests").innerHTML =
      '<div class="error">Failed to load</div>';
  }
}

async function loadRecentComplaints() {
  try {
    const res = await apiFetch("/api/complaints?status=open&limit=5");
    const complaints = res.complaints || [];
    const container = document.getElementById("recentComplaints");

    if (!complaints.length) {
      container.innerHTML = '<div class="empty">No open complaints</div>';
      return;
    }

    container.innerHTML = complaints
      .map(
        (c) => `
      <div class="activity-item">
        <div class="activity-main">
          <strong>${c.category}</strong>
          <span class="badge ${c.priority}">${c.priority}</span>
        </div>
        <div class="activity-meta">${truncate(c.description, 40)} • ${formatDate(c.created_at)}</div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    document.getElementById("recentComplaints").innerHTML =
      '<div class="error">Failed to load</div>';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.substring(0, len) + "..." : str;
}
