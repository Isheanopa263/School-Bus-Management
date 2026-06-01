/**
 * Bus Service Screen Controller
 */
const Bus = (() => {
  let requestMap = null;
  let marker = null; // FIX: Hoisted to module scope to prevent leaks
  let selectedLat = null;
  let selectedLng = null;

  // FIX: Added destroy method for cleanup on unmount
  function destroy() {
    if (marker && requestMap) {
      requestMap.removeLayer(marker);
      marker = null;
    }
    if (requestMap) {
      requestMap.remove();
      requestMap = null;
    }
    selectedLat = null;
    selectedLng = null;
  }

  function render(profile) {
    const container = document.getElementById("busContent");
    if (!container) return;

    const status = profile?.bus_request_status;

    if (status === "approved" && profile.stop_name) {
      renderApproved(container, profile);
    } else if (status === "pending") {
      renderPending(container);
    } else if (status === "rejected") {
      renderRejected(container);
    } else {
      renderRequest(container);
    }
  }

  // ── Approved State ────────────────────────────────────────────────────
  function renderApproved(container, profile) {
    container.innerHTML = `
      <div class="bus-detail-card">
        <div class="bus-detail-header">
          <div class="bus-detail-header-icon">🚌</div>
          <div class="bus-detail-header-title">Bus Assigned</div>
        </div>
        <div class="bus-detail-body">
          <div class="bus-detail-row">
            <div class="bus-detail-row-icon">🚌</div>
            <div>
              <div class="bus-detail-row-label">Bus Number</div>
              <div class="bus-detail-row-value">${profile.bus_number || "N/A"}</div>
            </div>
          </div>
          <div class="bus-detail-row">
            <div class="bus-detail-row-icon">📍</div>
            <div>
              <div class="bus-detail-row-label">My Stop</div>
              <div class="bus-detail-row-value">${profile.stop_name}</div>
            </div>
          </div>
          <div class="bus-detail-row">
            <div class="bus-detail-row-icon">🗺</div>
            <div>
              <div class="bus-detail-row-label">Route</div>
              <div class="bus-detail-row-value">${profile.route_name || "N/A"}</div>
            </div>
          </div>
          <div class="bus-detail-row">
            <div class="bus-detail-row-icon">⏰</div>
            <div>
              <div class="bus-detail-row-label">Scheduled Arrival</div>
              <div class="bus-detail-row-value">${profile.scheduled_arrival_time || "N/A"}</div>
            </div>
          </div>
          <div class="bus-detail-row">
            <div class="bus-detail-row-icon">👤</div>
            <div>
              <div class="bus-detail-row-label">Driver</div>
              <div class="bus-detail-row-value">${profile.driver_name || "N/A"}</div>
            </div>
          </div>
          <div class="bus-detail-row">
            <div class="bus-detail-row-icon">📞</div>
            <div>
              <div class="bus-detail-row-label">Driver Contact</div>
              <div class="bus-detail-row-value">${profile.driver_phone || "N/A"}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bus-action-buttons">
        <button class="btn btn-outline" id="changeStopBtn">
          🔄 Change My Stop
        </button>
        <button class="btn btn-danger" id="leaveBusBtn">
          🚪 Leave Bus Service
        </button>
      </div>`;

    // FIX: Added null guards
    const changeBtn = document.getElementById("changeStopBtn");
    if (changeBtn) changeBtn.onclick = () => renderRequest(container, true);

    const leaveBtn = document.getElementById("leaveBusBtn");
    if (leaveBtn) leaveBtn.onclick = handleLeaveBus;
  }

  // ── Pending State ─────────────────────────────────────────────────────
  function renderPending(container) {
    container.innerHTML = `
      <div class="bus-state-card">
        <div class="bus-state-icon">⏳</div>
        <div class="bus-state-title">Request Pending</div>
        <div class="bus-state-desc">
          Your bus service request has been submitted and is waiting for admin approval.
          You will be notified once a decision is made.
        </div>
        <span class="status-pill pending" style="display:inline-block">Under Review</span>
      </div>`;
  }

  // ── Rejected State ────────────────────────────────────────────────────
  function renderRejected(container) {
    container.innerHTML = `
      <div class="bus-state-card">
        <div class="bus-state-icon">❌</div>
        <div class="bus-state-title">Request Rejected</div>
        <div class="bus-state-desc">
          Your bus service request was not approved. This may be due to capacity 
          or distance. You can try applying again.
        </div>
        <button class="btn btn-primary" id="reapplyBtn">Apply Again</button>
      </div>`;

    const reapplyBtn = document.getElementById("reapplyBtn");
    if (reapplyBtn) reapplyBtn.onclick = () => renderRequest(container);
  }

  // ── Request Form ──────────────────────────────────────────────────────
  function renderRequest(container, isChange = false) {
    // FIX: Clean up existing map before rendering new one
    destroy();

    container.innerHTML = `
    <div class="card">
      <h3 class="section-title">${isChange ? "Change My Stop" : "Request Bus Service"}</h3>
      <p style="font-size:14px;color:var(--text-muted);margin-bottom:16px">
        ${
          isChange
            ? "Select your new pickup location on the map. Your current assignment will be removed."
            : "Select your home location on the map. We will find the nearest stop and available bus for you."
        }
      </p>

      <div id="requestMap" class="request-map"></div>

      <div class="form-group">
        <label>Selected Location</label>
        <div style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text-muted)" id="selectedLocationText">
          Click on map to select location
        </div>
      </div>

      <div class="form-group">
        <label>Additional Notes</label>
        <textarea id="requestNotes" class="form-textarea no-icon" rows="2" placeholder="Any special requirements..."></textarea>
      </div>

      <div id="requestError" class="form-error"></div>

      <div style="display:flex;gap:10px;margin-top:8px">
        ${isChange ? `<button class="btn btn-secondary" id="cancelChangeBtn">Cancel</button>` : ""}
        <button class="btn btn-primary" id="submitRequestBtn">
          <span id="submitRequestText">${isChange ? "Change Stop" : "Request Bus"}</span>
        </button>
      </div>
    </div>`;

    // Cancel button
    if (isChange) {
      const cancelBtn = document.getElementById("cancelChangeBtn");
      if (cancelBtn) {
        cancelBtn.onclick = async () => {
          container.innerHTML = `<div class="loading">Loading...</div>`;
          try {
            const data = await StudentAPI.getProfile();
            render(data.profile);
          } catch (err) {
            container.innerHTML = `<div class="form-error visible">Failed to load profile</div>`;
          }
        };
      }
    }

    // FIX: Only one event listener now, removed the addEventListener below
    const submitBtn = document.getElementById("submitRequestBtn");
    if (submitBtn) submitBtn.onclick = () => handleSubmitRequest(isChange);

    initRequestMap();
  }

  function initRequestMap() {
    const mapEl = document.getElementById("requestMap");
    if (!mapEl) return;

    // FIX: Cleanup handled by destroy() now, but keep as safety
    if (requestMap) {
      requestMap.remove();
      requestMap = null;
    }
    if (marker) marker = null;

    requestMap = L.map("requestMap").setView([17.05, 82.15], 12);
    // FIX: Added attribution + maxZoom for OSM compliance
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(requestMap);

    requestMap.on("click", (e) => {
      selectedLat = e.latlng.lat;
      selectedLng = e.latlng.lng;

      if (marker) requestMap.removeLayer(marker);
      marker = L.marker([selectedLat, selectedLng]).addTo(requestMap);

      const locText = document.getElementById("selectedLocationText");
      if (locText) {
        locText.textContent = `${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
        locText.style.color = "var(--text)";
      }
    });

    // Try to get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (requestMap) {
            requestMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
          }
        },
        () => {}, // Silently fail if user denies location
      );
    }
  }

  async function handleSubmitRequest(isChange = false) {
    const errEl = document.getElementById("requestError");
    const btn = document.getElementById("submitRequestBtn");
    const btnText = document.getElementById("submitRequestText");

    // FIX: Disable immediately to prevent race condition
    if (btn) btn.disabled = true;

    if (!selectedLat || !selectedLng) {
      if (errEl) {
        errEl.textContent = "Please select your location on the map";
        errEl.classList.add("visible");
      }
      if (btn) btn.disabled = false;
      return;
    }

    const notesEl = document.getElementById("requestNotes");
    const notes = notesEl ? notesEl.value.trim() : "";

    if (btnText)
      btnText.textContent = isChange
        ? "Processing..."
        : "Submitting request...";

    try {
      // If changing stop, leave bus first then re-request
      if (isChange) {
        await StudentAPI.leaveBus();
      }

      const homeLocation = `POINT(${selectedLng} ${selectedLat})`;
      await StudentAPI.requestBus(homeLocation, notes || null);

      const container = document.getElementById("busContent");
      if (container) {
        container.innerHTML = `
        <div class="bus-state-card" style="background:var(--success-light);border:1px solid rgba(16,185,129,0.3)">
          <div class="bus-state-icon">✅</div>
          <div class="bus-state-title">${isChange ? "Change Request Submitted!" : "Request Submitted!"}</div>
          <div class="bus-state-desc">
            ${
              isChange
                ? "Your stop change request has been submitted. Admin will review and assign you a new stop."
                : "Your bus service request has been submitted. Admin will review and assign you shortly."
            }
          </div>
          <span class="status-pill pending" style="display:inline-block">Pending Review</span>
        </div>`;
      }
    } catch (err) {
      // FIX: Better error handling with fallbacks
      if (errEl) {
        let msg = "Request failed. Try again.";
        if (err.status === 409) msg = "You already have a pending request";
        else if (err.status === 400) msg = "Invalid location selected";
        else if (err.message) msg = err.message;

        errEl.textContent = msg;
        errEl.classList.add("visible");
      }
      if (btn) btn.disabled = false;
      if (btnText)
        btnText.textContent = isChange ? "Change Stop" : "Request Bus";
    }
  }

  // ── Leave Bus ─────────────────────────────────────────────────────────
  async function handleLeaveBus() {
    if (
      !confirm(
        "Are you sure you want to leave bus service? You will need to re-apply to get a bus again.",
      )
    )
      return;

    try {
      await StudentAPI.leaveBus();

      const container = document.getElementById("busContent");
      if (container) {
        container.innerHTML = `
        <div class="bus-state-card">
          <div class="bus-state-icon">👋</div>
          <div class="bus-state-title">Left Bus Service</div>
          <div class="bus-state-desc">You have been removed from bus service. You can apply again anytime.</div>
          <button class="btn btn-primary" id="reapplyAfterLeave" style="margin-top:12px">Apply Again</button>
        </div>`;

        const reapplyBtn = document.getElementById("reapplyAfterLeave");
        if (reapplyBtn) {
          reapplyBtn.onclick = () => renderRequest(container);
        }
      }
    } catch (err) {
      alert(err.message || "Failed to leave bus service");
    }
  }

  // FIX: Export destroy so parent can call it on route change/unmount
  return { render, destroy };
})();
