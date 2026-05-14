/**
 * Bus Service Screen Controller
 */
const Bus = (() => {
  let requestMap = null;
  let selectedLat = null;
  let selectedLng = null;

  function render(profile) {
    const container = document.getElementById("busContent");
    if (!container) return;

    const status = profile.bus_request_status;

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
            <div class="bus-detail-row-icon">🗺️</div>
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

    document
      .getElementById("changeStopBtn")
      .addEventListener("click", () => renderRequest(container, true));
    document
      .getElementById("leaveBusBtn")
      .addEventListener("click", handleLeaveBus);
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

    document
      .getElementById("reapplyBtn")
      .addEventListener("click", () => renderRequest(container));
  }

  // ── Request Form ──────────────────────────────────────────────────────
  function renderRequest(container, isChange = false) {
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
      document
        .getElementById("cancelChangeBtn")
        .addEventListener("click", async () => {
          const data = await StudentAPI.getProfile();
          render(data.profile);
        });
    }

    initRequestMap();

    // Set isChange flag for submit handler
    document
      .getElementById("submitRequestBtn")
      .addEventListener("click", () => {
        handleSubmitRequest(isChange);
      });
  }

  function initRequestMap() {
    const mapEl = document.getElementById("requestMap");
    if (!mapEl) return;

    if (requestMap) {
      requestMap.remove();
      requestMap = null;
    }

    requestMap = L.map("requestMap").setView([17.05, 82.15], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      requestMap,
    );

    let marker = null;
    requestMap.on("click", (e) => {
      selectedLat = e.latlng.lat;
      selectedLng = e.latlng.lng;

      if (marker) requestMap.removeLayer(marker);
      marker = L.marker([selectedLat, selectedLng]).addTo(requestMap);

      document.getElementById("selectedLocationText").textContent =
        `${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
      document.getElementById("selectedLocationText").style.color =
        "var(--text)";
    });

    // Try to get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        requestMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
      });
    }
  }

  async function handleSubmitRequest(isChange = false) {
    if (!selectedLat || !selectedLng) {
      const errEl = document.getElementById("requestError");
      errEl.textContent = "Please select your location on the map";
      errEl.classList.add("visible");
      return;
    }

    const notes = document.getElementById("requestNotes").value.trim();
    const btn = document.getElementById("submitRequestBtn");
    const btnText = document.getElementById("submitRequestText");

    btn.disabled = true;
    btnText.textContent = isChange ? "Processing..." : "Submitting request...";

    try {
      // If changing stop, leave bus first then re-request
      if (isChange) {
        await StudentAPI.leaveBus();
      }

      const homeLocation = `POINT(${selectedLng} ${selectedLat})`;
      await StudentAPI.requestBus(homeLocation, notes || null);

      const container = document.getElementById("busContent");
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
    } catch (err) {
      const errEl = document.getElementById("requestError");
      if (errEl) {
        errEl.textContent =
          err.status === 409
            ? "You already have a pending request"
            : err.message || "Failed to submit request";
        errEl.classList.add("visible");
      }
    } finally {
      btn.disabled = false;
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
      container.innerHTML = `
      <div class="bus-state-card">
        <div class="bus-state-icon">👋</div>
        <div class="bus-state-title">Left Bus Service</div>
        <div class="bus-state-desc">You have been removed from bus service. You can apply again anytime.</div>
        <button class="btn btn-primary" id="reapplyAfterLeave" style="margin-top:12px">Apply Again</button>
      </div>`;

      document
        .getElementById("reapplyAfterLeave")
        .addEventListener("click", () => {
          renderRequest(container);
        });
    } catch (err) {
      alert(err.message || "Failed to leave bus service");
    }
  }
  return { render };
})();
