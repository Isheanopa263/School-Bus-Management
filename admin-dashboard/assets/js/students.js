/**
 * Students Page Controller
 * CRUD operations for student management
 */
(function () {
  let allStudents = [];
  let allStops = [];
  let currentFilter = "all";
  let editingStudentId = null;
  let deletingStudentId = null;

  init();

  async function init() {
    await Promise.all([loadStudents(), loadStops()]);
    setupEventListeners();
  }

  // ── Load Students ─────────────────────────────────────────────────────
  async function loadStudents() {
    const tbody = document.getElementById("studentsTableBody");

    try {
      const data = await apiFetch("/students");
      allStudents = data.students || data || [];
      renderStudents();
    } catch (err) {
      console.error("Failed to load students:", err);
      tbody.innerHTML = `<tr><td colspan="7" class="loading">Failed to load students</td></tr>`;
    }
  }

  // ── Load Stops ────────────────────────────────────────────────────────
  async function loadStops() {
    try {
      // Get all routes first, then collect their stops
      const routesData = await apiFetch("/routes");
      const routes = routesData.routes || [];

      allStops = [];
      for (const route of routes) {
        try {
          const stopsData = await apiFetch(`/stops?route_id=${route.rid}`);
          const stops = stopsData.stops || [];
          stops.forEach((stop) => {
            allStops.push({
              id: stop.id,
              name: stop.name,
              route_name: route.name,
              sequence: stop.sequence_number,
            });
          });
        } catch (e) {
          console.warn(`Failed to load stops for route ${route.name}`);
        }
      }
    } catch (err) {
      console.error("Failed to load stops:", err);
      allStops = [];
    }
  }

  // ── Render Students ───────────────────────────────────────────────────
  function renderStudents() {
    const tbody = document.getElementById("studentsTableBody");

    const filtered =
      currentFilter === "all"
        ? allStudents
        : allStudents.filter((s) => s.bus_request_status === currentFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="loading">
            ${currentFilter === "all" ? "No students found. Add your first student." : `No ${currentFilter} students.`}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (student) => `
        <tr>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar">${(student.full_name || "?").charAt(0).toUpperCase()}</div>
              <div>
                <div class="student-name">${student.full_name || "-"}</div>
                <div class="student-email">${student.email || "-"}</div>
              </div>
            </div>
          </td>
          <td>${student.roll || "-"}</td>
          <td class="contact-cell">${student.phone || "-"}</td>
          <td class="contact-cell">${student.emergency_contact_phone || "-"}</td>
          <td>
            <span class="badge badge-${student.bus_request_status || "inactive"}">
              ${(student.bus_request_status || "inactive").replace("_", " ")}
            </span>
          </td>
          <td>
            ${
              student.stop_name
                ? `<span class="stop-badge">📍 ${student.stop_name}</span>`
                : `<span class="no-stop">No stop</span>`
            }
          </td>
          <td>
            <div class="actions">
              <button class="btn-icon" onclick="editStudent('${student.sid}')" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon delete" onclick="deleteStudent('${student.sid}', '${student.full_name}')" title="Delete">
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
        renderStudents();
      });
    });

    // Add student
    document
      .getElementById("addStudentBtn")
      .addEventListener("click", () => openModal());

    // Close modal
    document
      .getElementById("closeStudentModal")
      .addEventListener("click", closeModal);
    document
      .getElementById("cancelStudentBtn")
      .addEventListener("click", closeModal);

    // Save student
    document
      .getElementById("saveStudentBtn")
      .addEventListener("click", handleSave);

    // Modal backdrop
    document.getElementById("studentModal").addEventListener("click", (e) => {
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
  function openModal(student = null) {
    editingStudentId = student ? student.sid : null;

    document.getElementById("studentModalTitle").textContent = student
      ? "Edit Student"
      : "Add Student";
    document.getElementById("studentId").value = student ? student.sid : "";
    document.getElementById("fullName").value = student
      ? student.full_name || ""
      : "";
    document.getElementById("email").value = student ? student.email || "" : "";
    document.getElementById("phone").value = student ? student.phone || "" : "";
    document.getElementById("password").value = "";
    document.getElementById("roll").value = student ? student.roll || "" : "";
    document.getElementById("emergencyContact").value = student
      ? student.emergency_contact_phone || ""
      : "";
    document.getElementById("busStatus").value = student
      ? student.bus_request_status || "inactive"
      : "inactive";

    // Password hint
    const hint = document.getElementById("passwordHint");
    const passwordInput = document.getElementById("password");
    if (student) {
      hint.textContent = "Leave blank to keep current password";
      passwordInput.removeAttribute("required");
    } else {
      hint.textContent = "Required for new students";
      passwordInput.setAttribute("required", "true");
    }

    // Populate stops dropdown
    const stopSelect = document.getElementById("assignedStop");
    stopSelect.innerHTML =
      `<option value="">No stop assigned</option>` +
      allStops
        .map(
          (s) =>
            `<option value="${s.id}" ${student && student.assigned_stop_id === s.id ? "selected" : ""}>${s.route_name} - ${s.sequence}. ${s.name}</option>`,
        )
        .join("");

    document.getElementById("studentModal").classList.add("show");
  }

  function closeModal() {
    document.getElementById("studentModal").classList.remove("show");
    editingStudentId = null;
  }

  // ── Save Student ──────────────────────────────────────────────────────
  async function handleSave() {
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const roll = document.getElementById("roll").value.trim();
    const emergencyContact = document
      .getElementById("emergencyContact")
      .value.trim();
    const assignedStop = document.getElementById("assignedStop").value;
    const status = document.getElementById("busStatus").value;

    if (!fullName || !phone) {
      alert("Full name and phone are required.");
      return;
    }

    if (!editingStudentId && (!password || password.length < 6)) {
      alert("Password must be at least 6 characters for new students.");
      return;
    }

    const saveBtn = document.getElementById("saveStudentBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      if (editingStudentId) {
        // Update existing student
        const body = {
          full_name: fullName,
          email: email || null,
          phone,
          roll: roll || null,
          emergency_contact_phone: emergencyContact || null,
          assigned_stop_id: assignedStop || null,
          bus_request_status: status,
        };

        await apiFetch(`/students/${editingStudentId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        // Create new student
        const body = {
          full_name: fullName,
          email: email || null,
          phone,
          password,
          roll: roll || null,
          emergency_contact_phone: emergencyContact || null,
          assigned_stop_id: assignedStop || null,
        };

        await apiFetch("/students", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      closeModal();
      await loadStudents();
    } catch (err) {
      alert(err.message || "Failed to save student");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Student";
    }
  }

  // ── Edit Student ──────────────────────────────────────────────────────
  window.editStudent = function (studentId) {
    const student = allStudents.find((s) => s.sid === studentId);
    if (student) openModal(student);
  };

  // ── Delete Student ────────────────────────────────────────────────────
  window.deleteStudent = function (studentId, name) {
    deletingStudentId = studentId;
    document.getElementById("deleteStudentName").textContent = name;
    document.getElementById("deleteModal").classList.add("show");
  };

  function closeDeleteModal() {
    document.getElementById("deleteModal").classList.remove("show");
    deletingStudentId = null;
  }

  async function handleDelete() {
    if (!deletingStudentId) return;

    const confirmBtn = document.getElementById("confirmDeleteBtn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting...";

    try {
      await apiFetch(`/students/${deletingStudentId}`, {
        method: "DELETE",
      });

      closeDeleteModal();
      await loadStudents();
    } catch (err) {
      alert(err.message || "Failed to delete student");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Delete";
    }
  }
})();
