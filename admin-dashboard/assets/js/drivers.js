/**
 * Drivers Page Controller
 * CRUD operations for driver management
 */
(function () {
  let allDrivers = [];
  let allBuses = [];
  let currentFilter = "all";
  let editingDriverId = null;
  let deletingDriverId = null;

  // ── Init ──────────────────────────────────────────────────────────────
  init();

  async function init() {
    await Promise.all([loadDrivers(), loadBuses()]);
    setupEventListeners();
  }

  // ── Load Drivers ──────────────────────────────────────────────────────
  async function loadDrivers() {
    const tbody = document.getElementById("driversTableBody");

    try {
      const data = await apiFetch("/drivers");
      allDrivers = data.drivers || data || [];
      renderDrivers();
    } catch (err) {
      console.error("Failed to load drivers:", err);
      tbody.innerHTML = `<tr><td colspan="7" class="loading">Failed to load drivers</td></tr>`;
    }
  }

  // ── Load Buses (for assignment dropdown) ───────────────────────────────
  async function loadBuses() {
    try {
      const data = await apiFetch("/buses");
      allBuses = (data.buses || data || []).filter(
        (b) => b.status === "active",
      );
    } catch (err) {
      console.error("Failed to load buses:", err);
      allBuses = [];
    }
  }

  // ── Render Drivers ────────────────────────────────────────────────────
  function renderDrivers() {
    const tbody = document.getElementById("driversTableBody");

    const filtered =
      currentFilter === "all"
        ? allDrivers
        : allDrivers.filter((d) => d.employment_status === currentFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="loading">
            ${currentFilter === "all" ? "No drivers found. Add your first driver." : `No ${currentFilter.replace("_", " ")} drivers.`}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((driver) => {
        const expiryClass = getExpiryClass(driver.license_expiry);

        return `
        <tr>
          <td>
            <div class="driver-name-cell">
              <div class="driver-avatar">${(driver.full_name || "?").charAt(0).toUpperCase()}</div>
              <div>
                <div class="driver-name">${driver.full_name || "-"}</div>
                <div class="driver-email">${driver.email || "-"}</div>
              </div>
            </div>
          </td>
          <td class="contact-cell">${driver.phone || "-"}</td>
          <td class="license-cell">${driver.license_number || "-"}</td>
          <td class="${expiryClass}">${driver.license_expiry ? formatDate(driver.license_expiry) : "-"}</td>
          <td>
            ${
              driver.bus_number
                ? `<span class="bus-badge">🚌 ${driver.bus_number}</span>`
                : `<span class="no-bus">Unassigned</span>`
            }
          </td>
          <td>
            <span class="badge badge-${driver.employment_status || "active"}">
              ${(driver.employment_status || "active").replace("_", " ")}
            </span>
          </td>
          <td>
            <div class="actions">
              <button class="btn-icon" onclick="editDriver('${driver.id}')" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon delete" onclick="deleteDriver('${driver.id}', '${driver.full_name}')" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }

  // ── Event Listeners ───────────────────────────────────────────────────
  function setupEventListeners() {
    // Filter tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderDrivers();
      });
    });

    // Add driver
    document
      .getElementById("addDriverBtn")
      .addEventListener("click", () => openModal());

    // Close modal
    document
      .getElementById("closeDriverModal")
      .addEventListener("click", closeModal);
    document
      .getElementById("cancelDriverBtn")
      .addEventListener("click", closeModal);

    // Save driver
    document
      .getElementById("saveDriverBtn")
      .addEventListener("click", handleSave);

    // Modal backdrop
    document.getElementById("driverModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Delete modal
    document
      .getElementById("closeDeleteModal")
      .addEventListener("click", closeDeleteModal);
    document
      .getElementById("cancelDeleteBtn")
      .addEventListener("click", closeDeleteModal);
    document
      .getElementById("confirmDeleteBtn")
      .addEventListener("click", handleDelete);

    document.getElementById("deleteModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeDeleteModal();
    });
  }

  // ── Open Modal ────────────────────────────────────────────────────────
  function openModal(driver = null) {
    editingDriverId = driver ? driver.id : null;

    document.getElementById("driverModalTitle").textContent = driver
      ? "Edit Driver"
      : "Add Driver";
    document.getElementById("driverId").value = driver ? driver.id : "";
    document.getElementById("fullName").value = driver
      ? driver.full_name || ""
      : "";
    document.getElementById("email").value = driver ? driver.email || "" : "";
    document.getElementById("phone").value = driver ? driver.phone || "" : "";
    document.getElementById("password").value = "";
    document.getElementById("licenseNumber").value = driver
      ? driver.license_number || ""
      : "";
    document.getElementById("licenseExpiry").value = driver
      ? formatDateInput(driver.license_expiry)
      : "";
    document.getElementById("employmentStatus").value = driver
      ? driver.employment_status || "active"
      : "active";

    // Password hint
    const hint = document.getElementById("passwordHint");
    if (driver) {
      hint.textContent = "Leave blank to keep current password";
      document.getElementById("password").removeAttribute("required");
    } else {
      hint.textContent = "Required for new drivers";
      document.getElementById("password").setAttribute("required", "true");
    }

    // Populate bus dropdown
    const busSelect = document.getElementById("assignedBus");
    busSelect.innerHTML =
      `<option value="">No bus assigned</option>` +
      allBuses
        .map(
          (b) =>
            `<option value="${b.bid}" ${driver && driver.current_bus_id === b.bid ? "selected" : ""}>${b.registration_number}</option>`,
        )
        .join("");

    document.getElementById("driverModal").classList.add("show");
  }

  function closeModal() {
    document.getElementById("driverModal").classList.remove("show");
    editingDriverId = null;
  }

  // ── Save Driver ───────────────────────────────────────────────────────
  async function handleSave() {
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const licenseNumber = document.getElementById("licenseNumber").value.trim();
    const licenseExpiry = document.getElementById("licenseExpiry").value;
    const assignedBus = document.getElementById("assignedBus").value;
    const status = document.getElementById("employmentStatus").value;

    if (!fullName || !phone || !licenseNumber || !licenseExpiry) {
      alert("Please fill all required fields.");
      return;
    }

    if (!editingDriverId && (!password || password.length < 6)) {
      alert("Password must be at least 6 characters for new drivers.");
      return;
    }

    const saveBtn = document.getElementById("saveDriverBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      if (editingDriverId) {
        // Update driver record
        const body = {
          license_number: licenseNumber,
          license_expiry: licenseExpiry,
          employment_status: status,
          current_bus_id: assignedBus || null,
        };
        console.log("Saving driver payload:", body);
        await apiFetch(`/drivers/${editingDriverId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        // Create new driver (creates user + driver)
        const body = {
          full_name: fullName,
          email: email || null,
          phone,
          password,
          license_number: licenseNumber,
          license_expiry: licenseExpiry,
          current_bus_id: assignedBus || null,
        };

        await apiFetch("/drivers", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      closeModal();
      await loadDrivers();
    } catch (err) {
      alert(err.message || "Failed to save driver");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Driver";
    }
  }

  // ── Edit Driver ───────────────────────────────────────────────────────
  window.editDriver = function (driverId) {
    const driver = allDrivers.find((d) => d.id === driverId);
    if (driver) openModal(driver);
  };

  // ── Delete Driver ─────────────────────────────────────────────────────
  window.deleteDriver = function (driverId, name) {
    deletingDriverId = driverId;
    document.getElementById("deleteDriverName").textContent = name;
    document.getElementById("deleteModal").classList.add("show");
  };

  function closeDeleteModal() {
    document.getElementById("deleteModal").classList.remove("show");
    deletingDriverId = null;
  }

  async function handleDelete() {
    if (!deletingDriverId) return;

    const confirmBtn = document.getElementById("confirmDeleteBtn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting...";

    try {
      await apiFetch(`/drivers/${deletingDriverId}`, {
        method: "DELETE",
      });

      closeDeleteModal();
      await loadDrivers();
    } catch (err) {
      alert(err.message || "Failed to delete driver");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Delete";
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function getExpiryClass(expiryDate) {
    if (!expiryDate) return "expiry-ok";
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "expiry-danger";
    if (diffDays < 30) return "expiry-warning";
    return "expiry-ok";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateInput(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toISOString().split("T")[0];
  }
})();
