// assets/js/buses.js

let buses = [];
let editingBusId = null;
let deletingBusId = null;

// DOM elements
const tableBody = document.getElementById("busesTableBody");
const busModal = document.getElementById("busModal");
const deleteModal = document.getElementById("deleteModal");
const busForm = document.getElementById("busForm");
const modalTitle = document.getElementById("modalTitle");

// Load buses on page load
document.addEventListener("DOMContentLoaded", () => {
  if (!requireAuth()) return;
  loadBuses();
  setupEventListeners();
});

function setupEventListeners() {
  document
    .getElementById("addBusBtn")
    .addEventListener("click", () => openModal());
  document
    .getElementById("closeModal")
    .addEventListener("click", () => closeModal());
  document
    .getElementById("cancelBtn")
    .addEventListener("click", () => closeModal());
  document
    .getElementById("cancelDeleteBtn")
    .addEventListener("click", () => closeDeleteModal());
  document
    .getElementById("confirmDeleteBtn")
    .addEventListener("click", () => deleteBus());
  busForm.addEventListener("submit", (e) => handleSubmit(e));

  busModal.addEventListener("click", (e) => {
    if (e.target === busModal) closeModal();
  });
  deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });
}

// Load buses from API
async function loadBuses() {
  try {
    tableBody.innerHTML =
      '<tr><td colspan="7" class="loading">Loading buses...</td></tr>';
    const res = await apiFetch("/api/buses");
    buses = res.buses || [];
    renderTable();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="loading">Error: ${err.message}</td></tr>`;
  }
}

// Render table

function renderTable() {
  if (buses.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="7" class="loading">No buses found. Add one to get started.</td></tr>';
    return;
  }

  tableBody.innerHTML = buses
    .map(
      (bus) => `
    <tr>
      <td><strong>${bus.registration_number}</strong></td>
      <td>${bus.model || "-"}</td>
      <td>${bus.capacity}</td>
      <td>${bus.gps_device_id || "-"}</td>
      <td>${bus.driver_name || '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
      <td><span class="badge ${bus.status}">${bus.status}</span></td>
      <td>
        <div class="actions">
          <button class="btn-icon edit-btn" data-id="${bus.bid}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
              <path d="M18.5 2.5l3 3L13 14l-4 1l1-4l8.5-8.5z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button class="btn-icon delete delete-btn" data-id="${bus.bid}" data-reg="${bus.registration_number}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  // Attach event listeners after rendering
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      editBus(id);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      const reg = e.currentTarget.dataset.reg;
      openDeleteModal(id, reg);
    });
  });
}
// Open add/edit modal
function openModal(bus = null) {
  editingBusId = bus?.bid || null;
  modalTitle.textContent = bus ? "Edit Bus" : "Add Bus";
  document.getElementById("busId").value = bus?.bid || "";
  document.getElementById("regNumber").value = bus?.registration_number || "";
  document.getElementById("capacity").value = bus?.capacity || "";
  document.getElementById("model").value = bus?.model || "";
  document.getElementById("gpsDeviceId").value = bus?.gps_device_id || "";
  document.getElementById("status").value = bus?.status || "active";
  busModal.classList.add("show");
}

// Close modal
function closeModal() {
  busModal.classList.remove("show");
  busForm.reset();
  editingBusId = null;
}

// Edit bus
function editBus(id) {
  console.log("editBus clicked:", id);
  const bus = buses.find((b) => b.bid === id);
  if (bus) openModal(bus);
}

// Handle form submit
async function handleSubmit(e) {
  e.preventDefault();

  const data = {
    registration_number: document.getElementById("regNumber").value.trim(),
    capacity: parseInt(document.getElementById("capacity").value),
    model: document.getElementById("model").value.trim() || null,
    gps_device_id: document.getElementById("gpsDeviceId").value.trim() || null,
    status: document.getElementById("status").value,
  };

  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    if (editingBusId) {
      await apiFetch(`/api/buses/${editingBusId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } else {
      await apiFetch("/api/buses", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }

    closeModal();
    loadBuses();
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Bus";
  }
}

// Open delete modal
function openDeleteModal(id, regNumber) {
  deletingBusId = id;
  document.getElementById("deleteBusName").textContent = regNumber;
  deleteModal.classList.add("show");
}

// Close delete modal
function closeDeleteModal() {
  deleteModal.classList.remove("show");
  deletingBusId = null;
}

// Delete bus
async function deleteBus() {
  if (!deletingBusId) return;

  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    await apiFetch(`/api/buses/${deletingBusId}`, {
      method: "DELETE",
    });

    closeDeleteModal();
    loadBuses();
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Delete";
  }
}
