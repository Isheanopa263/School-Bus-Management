const API_BASE = "http://localhost:3000";
let requests = [];
let routes = [];
let stops = [];
let currentFilter = "pending";

document.addEventListener("DOMContentLoaded", () => {
  loadRoutes();
  loadRequests();
  setupTabs();
});

async function loadRoutes() {
  try {
    const res = await apiFetch("/api/routes");
    routes = res.routes || [];
  } catch (err) {
    console.error("Load routes error:", err);
  }
}

async function loadRequests(status = currentFilter) {
  try {
    const url = status
      ? `/api/bus-requests?status=${status}`
      : "/api/bus-requests";
    const res = await apiFetch(url);
    requests = res.requests || [];
    renderTable();
  } catch (err) {
    console.error("Load requests error:", err);
    document.getElementById("requestsTableBody").innerHTML =
      `<tr><td colspan="7" class="error">Failed to load: ${err.message}</td></tr>`;
  }
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.status;
      loadRequests(currentFilter);
    });
  });
}

function renderTable() {
  const tbody = document.getElementById("requestsTableBody");

  if (!requests || requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading">No ${currentFilter || ""} requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = requests
    .map(
      (req) => `
    <tr>
      <td>
        <strong>${req.student_name}</strong><br>
        <small>${req.roll || "No roll"}</small>
      </td>
      <td>${req.student_phone || "-"}</td>
      <td>
        ${
          req.home_lat && req.home_lng
            ? `<a href="https://maps.google.com/?q=${req.home_lat},${req.home_lng}" target="_blank">View Map</a>`
            : "No location"
        }
      </td>
      <td>${req.route_name || '<span class="text-muted">Not assigned</span>'}</td>
      <td>${req.emergency_contact_phone || req.student_email || "-"}</td>
      <td>
        <span class="badge ${req.status}">
          ${req.status}
        </span>
      </td>
      <td>
        ${
          req.status === "pending"
            ? `
          <div class="actions">
            <button class="btn-icon review-btn" data-id="${req.id}" title="Review">
              <svg width="16" height="16" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        `
            : `<small>${req.admin_notes || "-"}</small>`
        }
      </td>
    </tr>
  `,
    )
    .join("");

  attachEventListeners();
}

function attachEventListeners() {
  document.querySelectorAll(".review-btn").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      reviewRequest(e.currentTarget.dataset.id),
    );
  });
}

async function loadStopsForRoute(routeId) {
  try {
    const res = await apiFetch(`/api/routes/${routeId}`);
    const routeStops = res.route.stops || [];
    const select = document.getElementById("assignStop");
    select.innerHTML = '<option value="">Select stop...</option>';
    routeStops.forEach((stop) => {
      const opt = document.createElement("option");
      opt.value = stop.id;
      opt.textContent = stop.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Load stops error:", err);
  }
}

async function reviewRequest(id) {
  const req = requests.find((r) => r.id == id);
  if (!req) return;

  document.getElementById("requestId").value = id;
  document.getElementById("requestDetails").innerHTML = `
    <div class="detail-row"><strong>Student:</strong> ${req.student_name} (${req.grade || "N/A"})</div>
    <div class="detail-row"><strong>Parent:</strong> ${req.parent_name} - ${req.parent_phone}</div>
    <div class="detail-row"><strong>Home:</strong>
      <a href="https://maps.google.com/?q=${req.home_lat},${req.home_lng}" target="_blank">
        ${req.home_lat}, ${req.home_lng}
      </a>
    </div>
    <div class="detail-row"><strong>Notes:</strong> ${req.notes || "None"}</div>
    <div class="detail-row"><strong>Requested:</strong> ${new Date(req.created_at).toLocaleString()}</div>
  `;

  // Populate routes dropdown
  const routeSelect = document.getElementById("assignRoute");
  routeSelect.innerHTML = '<option value="">Select route...</option>';
  routes.forEach((route) => {
    const opt = document.createElement("option");
    opt.value = route.rid;
    opt.textContent = `${route.route_number} - ${route.name}`;
    routeSelect.appendChild(opt);
  });

  routeSelect.onchange = (e) => {
    if (e.target.value) loadStopsForRoute(e.target.value);
  };

  document.getElementById("reviewModal").classList.add("active");
}

document.getElementById("closeModal")?.addEventListener("click", () => {
  document.getElementById("reviewModal").classList.remove("active");
});

document.getElementById("reviewForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("requestId").value;
  const route_id = document.getElementById("assignRoute").value;
  const stop_id = document.getElementById("assignStop").value;
  const admin_notes = document.getElementById("adminNotes").value;

  if (!route_id || !stop_id) {
    alert("Please select both route and stop");
    return;
  }

  try {
    await apiFetch(`/api/bus-requests/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ route_id, stop_id, admin_notes }),
    });
    document.getElementById("reviewModal").classList.remove("active");
    loadRequests();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

document.getElementById("rejectBtn")?.addEventListener("click", async () => {
  const id = document.getElementById("requestId").value;
  const admin_notes = document.getElementById("adminNotes").value;

  if (!confirm("Reject this request?")) return;

  try {
    await apiFetch(`/api/bus-requests/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ admin_notes }),
    });
    document.getElementById("reviewModal").classList.remove("active");
    loadRequests();
  } catch (err) {
    alert("Error: " + err.message);
  }
});
