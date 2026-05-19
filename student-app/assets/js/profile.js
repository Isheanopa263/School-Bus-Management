/**
 * Profile Screen Controller
 */
const Profile = (() => {
  let isEditing = false;

  function render(profile) {
    if (!profile) return;

    // Reset edit state every time profile tab is rendered
    isEditing = false;

    const editContainer = document.getElementById("personalInfoEdit");
    const viewContainer = document.getElementById("personalInfoView");

    if (editContainer) {
      editContainer.classList.add("hidden");
      editContainer.innerHTML = "";
    }
    if (viewContainer) {
      viewContainer.classList.remove("hidden");
    }

    // Header
    const avatar = document.getElementById("profileAvatar");
    const name = document.getElementById("profileName");
    const roll = document.getElementById("profileRoll");
    const status = document.getElementById("profileStatus");

    if (avatar)
      avatar.textContent = (profile.full_name || "S").charAt(0).toUpperCase();
    if (name) name.textContent = profile.full_name || "Student";
    if (roll) roll.textContent = profile.roll ? `Roll: ${profile.roll}` : "";
    if (status) {
      const s = profile.bus_request_status || "none";
      status.textContent =
        s === "approved"
          ? "Bus Assigned"
          : s === "pending"
            ? "Pending"
            : s === "rejected"
              ? "Rejected"
              : "No Bus";
      status.className = `status-pill ${s || "none"}`;
    }

    renderPersonalView(profile);
    renderBusAssignment(profile);
    setupEvents(profile);
  }

  function renderPersonalView(profile) {
    const container = document.getElementById("personalInfoView");
    if (!container) return;

    container.innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">Full Name</span>
        <span class="profile-info-value">${profile.full_name || "-"}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Email</span>
        <span class="profile-info-value">${profile.email || "Not set"}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Phone</span>
        <span class="profile-info-value">${profile.phone || "-"}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Roll Number</span>
        <span class="profile-info-value">${profile.roll || "Not set"}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Emergency Contact</span>
        <span class="profile-info-value">${profile.emergency_contact_phone || "Not set"}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Joined</span>
        <span class="profile-info-value">${profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</span>
      </div>`;
  }

  function closeEditMode() {
    isEditing = false;

    const editBtn = document.getElementById("editPersonalBtn");
    const editContainer = document.getElementById("personalInfoEdit");
    const viewContainer = document.getElementById("personalInfoView");

    if (editBtn) editBtn.textContent = "Edit";
    if (editContainer) {
      editContainer.classList.add("hidden");
      editContainer.innerHTML = "";
    }
    if (viewContainer) viewContainer.classList.remove("hidden");
  }

  function renderEditForm(profile) {
    const editContainer = document.getElementById("personalInfoEdit");
    const viewContainer = document.getElementById("personalInfoView");
    if (!editContainer) return;

    viewContainer.classList.add("hidden");
    editContainer.classList.remove("hidden");

    editContainer.innerHTML = `
    <div class="profile-edit-form">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="editName" class="form-input no-icon" value="${profile.full_name || ""}" />
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" id="editPhone" class="form-input no-icon" value="${profile.phone || ""}" />
      </div>
      <div class="form-group">
        <label>Roll Number</label>
        <input type="text" id="editRoll" class="form-input no-icon" value="${profile.roll || ""}" />
      </div>
      <div class="form-group">
        <label>Emergency Contact</label>
        <input type="tel" id="editEmergency" class="form-input no-icon" value="${profile.emergency_contact_phone || ""}" />
      </div>
      <div id="editError" class="form-error"></div>
      <div class="profile-edit-actions">
        <button class="btn btn-secondary" id="cancelEditBtn">Cancel</button>
        <button class="btn btn-primary" id="saveEditBtn">
          <span id="saveEditText">Save Changes</span>
        </button>
      </div>
    </div>`;

    document.getElementById("cancelEditBtn").onclick = closeEditMode;
    document.getElementById("saveEditBtn").onclick = handleSaveProfile;
  }

  function renderBusAssignment(profile) {
    const container = document.getElementById("busAssignmentInfo");
    if (!container) return;

    if (profile.bus_request_status === "approved" && profile.stop_name) {
      container.innerHTML = `
        <div class="bus-assignment-row">
          <div class="bus-assignment-icon">🚌</div>
          <div><div class="bus-assignment-label">Bus</div><div class="bus-assignment-value">${profile.bus_number || "N/A"}</div></div>
        </div>
        <div class="bus-assignment-row">
          <div class="bus-assignment-icon">📍</div>
          <div><div class="bus-assignment-label">Stop</div><div class="bus-assignment-value">${profile.stop_name}</div></div>
        </div>
        <div class="bus-assignment-row">
          <div class="bus-assignment-icon">🗺️</div>
          <div><div class="bus-assignment-label">Route</div><div class="bus-assignment-value">${profile.route_name || "N/A"}</div></div>
        </div>
        <div class="bus-assignment-row">
          <div class="bus-assignment-icon">👤</div>
          <div><div class="bus-assignment-label">Driver</div><div class="bus-assignment-value">${profile.driver_name || "N/A"}</div></div>
        </div>`;
    } else {
      container.innerHTML = `
        <div style="padding:20px 18px;text-align:center;color:var(--text-muted);font-size:14px">
          No bus assigned. Go to Bus Service to request one.
        </div>`;
    }
  }

  function setupEvents(profile) {
    // Edit personal info
    const editBtn = document.getElementById("editPersonalBtn");
    if (editBtn) {
      editBtn.onclick = () => {
        if (!isEditing) {
          isEditing = true;
          editBtn.textContent = "Cancel";
          renderEditForm(profile);
        } else {
          closeEditMode();
        }
      };
    }

    // Change password
    const pwdBtn = document.getElementById("changePasswordBtn");
    if (pwdBtn) {
      pwdBtn.onclick = handleChangePassword;
    }

    // Leave bus
    const leaveBtn = document.getElementById("profileLeaveBusBtn");
    if (leaveBtn) {
      if (profile.bus_request_status !== "approved") {
        leaveBtn.disabled = true;
        leaveBtn.textContent = "No Bus Assigned";
        leaveBtn.onclick = null;
      } else {
        leaveBtn.disabled = false;
        leaveBtn.textContent = "Leave Bus Service";
        leaveBtn.onclick = handleLeaveBus;
      }
    }

    // Logout
    const logoutBtn = document.getElementById("profileLogoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = () => App.logout();
    }
  }

  async function handleSaveProfile() {
    const name = document.getElementById("editName").value.trim();
    const phone = document.getElementById("editPhone").value.trim();
    const roll = document.getElementById("editRoll").value.trim();
    const emergency = document.getElementById("editEmergency").value.trim();
    const errorEl = document.getElementById("editError");
    const btn = document.getElementById("saveEditBtn");
    const btnText = document.getElementById("saveEditText");

    if (!name || !phone) {
      errorEl.textContent = "Name and phone are required";
      errorEl.classList.add("visible");
      return;
    }

    btn.disabled = true;
    btnText.textContent = "Saving...";
    errorEl.classList.remove("visible");

    try {
      await StudentAPI.updateProfile({
        full_name: name,
        phone,
        roll: roll || null,
        emergency_contact_phone: emergency || null,
      });

      // Reload profile
      const data = await StudentAPI.getProfile();
      const profile = data.profile;

      // Update stored info
      sessionStorage.setItem(
        "student_info",
        JSON.stringify({
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
        }),
      );

      closeEditMode();

      renderPersonalView(profile);
      document.getElementById("profileName").textContent = profile.full_name;
      document.getElementById("profileAvatar").textContent = profile.full_name
        .charAt(0)
        .toUpperCase();
      document.getElementById("headerAvatar").textContent = profile.full_name
        .charAt(0)
        .toUpperCase();
      document.getElementById("greetingName").textContent =
        `Hello, ${profile.full_name.split(" ")[0]} 👋`;
    } catch (err) {
      errorEl.textContent = err.message || "Failed to save";
      errorEl.classList.add("visible");
    } finally {
      btn.disabled = false;
      btnText.textContent = "Save Changes";
    }
  }

  async function handleChangePassword() {
    const current = document.getElementById("currentPassword").value;
    const newPwd = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    const errorEl = document.getElementById("passwordError");
    const successEl = document.getElementById("passwordSuccess");
    const btn = document.getElementById("changePasswordBtn");
    const btnText = document.getElementById("changePasswordText");

    errorEl.classList.remove("visible");
    successEl.classList.add("hidden");

    if (!current || !newPwd || !confirm) {
      errorEl.textContent = "All password fields are required";
      errorEl.classList.add("visible");
      return;
    }

    if (newPwd.length < 6) {
      errorEl.textContent = "New password must be at least 6 characters";
      errorEl.classList.add("visible");
      return;
    }

    if (newPwd !== confirm) {
      errorEl.textContent = "New passwords do not match";
      errorEl.classList.add("visible");
      return;
    }

    btn.disabled = true;
    btnText.textContent = "Updating...";

    try {
      await StudentAPI.changePassword(current, newPwd);

      // Clear fields
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";

      successEl.textContent = "✅ Password changed successfully";
      successEl.classList.remove("hidden");

      setTimeout(() => successEl.classList.add("hidden"), 5000);
    } catch (err) {
      errorEl.textContent =
        err.status === 401
          ? "Current password is incorrect"
          : err.message || "Failed to change password";
      errorEl.classList.add("visible");
    } finally {
      btn.disabled = false;
      btnText.textContent = "Update Password";
    }
  }

  async function handleLeaveBus() {
    if (!confirm("Are you sure? You will need to re-apply for bus service."))
      return;

    try {
      await StudentAPI.leaveBus();
      alert("Successfully removed from bus service");

      // Reload profile
      const data = await StudentAPI.getProfile();
      render(data.profile);
    } catch (err) {
      alert(err.message || "Failed to leave bus service");
    }
  }

  return { render };
})();
