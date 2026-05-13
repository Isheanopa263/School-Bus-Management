const API_BASE = "http://localhost:3000";
let drivers = [];
let buses = [];

document.addEventListener("DOMContentLoaded", () => {
  loadBuses();
  loadDrivers();
});

async function loadBuses() {
  try {
    const res = await apiFetch("/api/buses");
    buses = res.buses || [];
    const select = document.getElementById("currentBus");
    buses.forEach((bus) => {
      const opt = document.createElement("option");
      opt.value = bus.bid;
      opt.textContent = bus.registration_number;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Load buses error:", err);
  }
}

async function loadDrivers() {
  try {
    const res = await apiFetch("/api/drivers");
    drivers = res.drivers || [];
    renderTable();
  } catch (err) {
    console.error("Load drivers error:", err);
    document.getElementById("driversTableBody").innerHTML =
      `<tr><td colspan="7" class="error">Failed to load: ${err.message}</td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById("driversTableBody");

  if (!drivers || drivers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="loading">No drivers found. Add one to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = drivers
    .map((driver) => {
      const expiryDate = driver.license_expiry
        ? new Date(driver.license_expiry)
        : null;
      const isExpired = expiryDate && expiryDate < new Date();

      return `
    <tr>
      <td><strong>${driver.full_name}</strong><br><small>${driver.email || ""}</small></td>
      <td>${driver.phone}</td>
      <td>${driver.license_number}</td>
      <td class="${isExpired ? "text-danger" : ""}">${expiryDate ? expiryDate.toLocaleDateString() : "-"}</td>
      <td>${driver.bus_number || '<span class="text-muted">Unassigned</span>'}</td>
      <td>
        <span class="badge ${driver.employment_status || "active"}">
          ${(driver.employment_status || "active").replace("_", " ")}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn-icon edit-btn" data-id="${driver.id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5l3 3L13 14l-4 1l1-4l8.5-8.5z"></path>
            </svg>
          </button>
          <button class="btn-icon delete delete-btn" data-id="${driver.id}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `;
    })
    .join("");

  attachEventListeners();
}

function attachEventListeners() {
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      editDriver(e.currentTarget.dataset.id),
    );
  });
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      deleteDriver(e.currentTarget.dataset.id),
    );
  });
}

document
  .getElementById("addDriverBtn")
  ?.addEventListener("click", () => openModal());
document.getElementById("closeModal")?.addEventListener("click", closeModal);
document.getElementById("cancelBtn")?.addEventListener("click", closeModal);

function openModal(driver = null) {
  const modal = document.getElementById("driverModal");
  const form = document.getElementById("driverForm");
  form.reset();

  const isEdit = !!driver;

  // Show/hide password field - only required on create
  document.getElementById("passwordGroup").style.display = isEdit
    ? "none"
    : "block";
  document.getElementById("password").required = !isEdit;
  document.getElementById("statusGroup").style.display = isEdit
    ? "block"
    : "none";
  document.getElementById("accountSectionTitle").textContent = isEdit
    ? "Account Details"
    : "Account Details";

  if (isEdit) {
    document.getElementById("modalTitle").textContent = "Edit Driver";
    document.getElementById("driverId").value = driver.id;
    document.getElementById("fullName").value = driver.full_name;
    document.getElementById("fullName").disabled = true; // Can't edit user name
    document.getElementById("email").value = driver.email || "";
    document.getElementById("email").disabled = true; // Can't edit user email
    document.getElementById("phone").value = driver.phone;
    document.getElementById("phone").disabled = true; // Can't edit user phone
    document.getElementById("licenseNumber").value = driver.license_number;
    document.getElementById("licenseExpiry").value = driver.license_expiry
      ? driver.license_expiry.split("T")[0]
      : "";
    document.getElementById("currentBus").value = driver.current_bus_id || "";
    document.getElementById("employmentStatus").value =
      driver.employment_status || "active";
  } else {
    document.getElementById("modalTitle").textContent = "Add Driver";
    document.getElementById("driverId").value = "";
    document.getElementById("fullName").disabled = false;
    document.getElementById("email").disabled = false;
    document.getElementById("phone").disabled = false;
  }

  modal.classList.add("active");
}

function closeModal() {
  document.getElementById("driverModal").classList.remove("active");
}

function editDriver(id) {
  const driver = drivers.find((d) => d.id == id);
  if (driver) openModal(driver);
}

async function deleteDriver(id) {
  const driver = drivers.find((d) => d.id == id);
  if (!driver) return;

  if (
    !confirm(
      `Delete driver ${driver.full_name}? This will deactivate their account and unassign them from any bus.`,
    )
  )
    return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/drivers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 204) {
      loadDrivers();
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    loadDrivers();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Error: " + err.message);
  }
}

document.getElementById("driverForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("driverId").value;
  const isEdit = !!id;

  try {
    if (isEdit) {
      // PUT - only update driver fields, not user fields
      const data = {
        license_number: document.getElementById("licenseNumber").value,
        license_expiry: document.getElementById("licenseExpiry").value,
        employment_status: document.getElementById("employmentStatus").value,
        current_bus_id: document.getElementById("currentBus").value || null,
      };
      await apiFetch(`/api/drivers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } else {
      // POST - create user + driver
      const data = {
        full_name: document.getElementById("fullName").value,
        email: document.getElementById("email").value || null,
        phone: document.getElementById("phone").value,
        password: document.getElementById("password").value,
        license_number: document.getElementById("licenseNumber").value,
        license_expiry: document.getElementById("licenseExpiry").value,
        current_bus_id: document.getElementById("currentBus").value || null,
      };
      await apiFetch("/api/drivers", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }
    closeModal();
    loadDrivers();
  } catch (err) {
    alert("Error: " + err.message);
  }
});
