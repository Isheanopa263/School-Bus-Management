/**
 * Buses Page Controller
 * CRUD operations for bus fleet management
 */
(function () {
  let allBuses = [];
  let currentFilter = "all";
  let editingBusId = null;
  let deletingBusId = null;

  // ── Init ──────────────────────────────────────────────────────────────
  init();

  async function init() {
    await loadBuses();
    setupEventListeners();
  }

  // ── Load Buses ────────────────────────────────────────────────────────
  async function loadBuses() {
    const tbody = document.getElementById("busesTableBody");

    try {
      const data = await apiFetch("/buses");
      allBuses = data.buses || data || [];
      renderBuses();
    } catch (err) {
      console.error("Failed to load buses:", err);
      tbody.innerHTML = `<tr><td colspan="7" class="loading">Failed to load buses</td></tr>`;
    }
  }

  // ── Render Buses ──────────────────────────────────────────────────────
  function renderBuses() {
    const tbody = document.getElementById("busesTableBody");

    const filtered =
      currentFilter === "all"
        ? allBuses
        : allBuses.filter((b) => b.status === currentFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="loading">
            ${currentFilter === "all" ? "No buses found. Add your first bus." : `No ${currentFilter} buses found.`}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (bus) => `
      <tr>
        <td><strong>${bus.registration_number}</strong></td>
        <td>${bus.model || "-"}</td>
        <td>
          <div class="capacity-cell">
            <span class="capacity-value">${bus.capacity}</span>
            seats
          </div>
        </td>
        <td>
          ${
            bus.gps_device_id
              ? `<span class="gps-cell">${bus.gps_device_id}</span>`
              : `<span class="no-gps">Not assigned</span>`
          }
        </td>
        <td>
          ${
            bus.driver_name || bus.full_name
              ? `<div class="driver-cell">
                  <div class="driver-avatar-sm">${(bus.driver_name || bus.full_name).charAt(0)}</div>
                  ${bus.driver_name || bus.full_name}
                </div>`
              : `<span class="no-driver">Unassigned</span>`
          }
        </td>
        <td>
          <span class="badge badge-${bus.status}">${bus.status}</span>
        </td>
        <td>
          <div class="actions">
            <button class="btn-icon" onclick="editBus('${bus.bid}')" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon delete" onclick="deleteBus('${bus.bid}', '${bus.registration_number}')" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`,
      )
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
        renderBuses();
      });
    });

    // Add bus button
    document.getElementById("addBusBtn").addEventListener("click", () => {
      openModal();
    });

    // Close modal
    document
      .getElementById("closeBusModal")
      .addEventListener("click", closeModal);
    document
      .getElementById("cancelBusBtn")
      .addEventListener("click", closeModal);

    // Save bus
    document.getElementById("saveBusBtn").addEventListener("click", handleSave);

    // Modal backdrop
    document.getElementById("busModal").addEventListener("click", (e) => {
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
  function openModal(bus = null) {
    editingBusId = bus ? bus.bid : null;

    document.getElementById("busModalTitle").textContent = bus
      ? "Edit Bus"
      : "Add Bus";
    document.getElementById("busId").value = bus ? bus.bid : "";
    document.getElementById("regNumber").value = bus
      ? bus.registration_number
      : "";
    document.getElementById("capacity").value = bus ? bus.capacity : "";
    document.getElementById("model").value = bus ? bus.model || "" : "";
    document.getElementById("gpsDeviceId").value = bus
      ? bus.gps_device_id || ""
      : "";
    document.getElementById("busStatus").value = bus ? bus.status : "active";

    document.getElementById("busModal").classList.add("show");
  }

  function closeModal() {
    document.getElementById("busModal").classList.remove("show");
    editingBusId = null;
  }

  // ── Save Bus ──────────────────────────────────────────────────────────
  async function handleSave() {
    const regNumber = document.getElementById("regNumber").value.trim();
    const capacity = document.getElementById("capacity").value;
    const model = document.getElementById("model").value.trim();
    const gpsDeviceId = document.getElementById("gpsDeviceId").value.trim();
    const status = document.getElementById("busStatus").value;

    if (!regNumber || !capacity) {
      alert("Registration number and capacity are required.");
      return;
    }

    const saveBtn = document.getElementById("saveBusBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const body = {
      registration_number: regNumber,
      capacity: parseInt(capacity),
      model: model || null,
      gps_device_id: gpsDeviceId || null,
      status,
    };

    try {
      if (editingBusId) {
        await apiFetch(`/buses/${editingBusId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/buses", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      closeModal();
      await loadBuses();
    } catch (err) {
      alert(err.message || "Failed to save bus");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Bus";
    }
  }

  // ── Edit Bus ──────────────────────────────────────────────────────────
  window.editBus = function (busId) {
    const bus = allBuses.find((b) => b.bid === busId);
    if (bus) openModal(bus);
  };

  // ── Delete Bus ────────────────────────────────────────────────────────
  window.deleteBus = function (busId, regNumber) {
    deletingBusId = busId;
    document.getElementById("deleteBusName").textContent = regNumber;
    document.getElementById("deleteModal").classList.add("show");
  };

  function closeDeleteModal() {
    document.getElementById("deleteModal").classList.remove("show");
    deletingBusId = null;
  }

  async function handleDelete() {
    if (!deletingBusId) return;

    const confirmBtn = document.getElementById("confirmDeleteBtn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting...";

    try {
      await apiFetch(`/buses/${deletingBusId}`, {
        method: "DELETE",
      });

      closeDeleteModal();
      await loadBuses();
    } catch (err) {
      alert(err.message || "Failed to delete bus");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Delete";
    }
  }
})();
