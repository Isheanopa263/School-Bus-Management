/**
 * Complaint Screen Controller
 */
const Complaint = (() => {
  let selectedCategory = null;
  let selectedPriority = "medium";

  function init() {
    render();
  }

  function render() {
    const container = document.getElementById("complaintContent");
    if (!container) return;

    container.innerHTML = `
      <div class="section-title">What is your issue about?</div>
      <div class="category-grid">
        <button class="category-card" data-cat="bus_service">
          <div class="category-card-icon">🚌</div>
          <div class="category-card-label">Bus Service</div>
        </button>
        <button class="category-card" data-cat="driver">
          <div class="category-card-icon">👤</div>
          <div class="category-card-label">Driver Behavior</div>
        </button>
        <button class="category-card" data-cat="route_deviation">
          <div class="category-card-icon">↗️</div>
          <div class="category-card-label">Route Issue</div>
        </button>
        <button class="category-card" data-cat="safety">
          <div class="category-card-icon">⚠️</div>
          <div class="category-card-label">Safety Concern</div>
        </button>
        <button class="category-card" data-cat="breakdown">
          <div class="category-card-icon">🔧</div>
          <div class="category-card-label">Breakdown</div>
        </button>
        <button class="category-card" data-cat="other">
          <div class="category-card-icon">📋</div>
          <div class="category-card-label">Other</div>
        </button>
      </div>

      <div class="section-title">Priority</div>
      <div class="priority-options">
        <button class="priority-btn" data-priority="low">
          <span class="priority-dot low"></span>Low
        </button>
        <button class="priority-btn active" data-priority="medium">
          <span class="priority-dot medium"></span>Medium
        </button>
        <button class="priority-btn" data-priority="high">
          <span class="priority-dot high"></span>High
        </button>
      </div>

      <div class="form-group">
        <label>Description *</label>
        <textarea id="complaintDesc" class="form-textarea no-icon" rows="4" 
          placeholder="Please describe your issue in detail..."></textarea>
      </div>

      <div id="complaintError" class="form-error"></div>

      <button class="btn btn-primary" id="submitComplaintBtn">
        <span id="submitComplaintText">Submit Complaint</span>
      </button>`;

    // Category selection
    document.querySelectorAll(".category-card").forEach((card) => {
      card.addEventListener("click", () => {
        document
          .querySelectorAll(".category-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedCategory = card.dataset.cat;
      });
    });

    // Priority selection
    document.querySelectorAll(".priority-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".priority-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedPriority = btn.dataset.priority;
      });
    });

    document
      .getElementById("submitComplaintBtn")
      .addEventListener("click", handleSubmit);
  }

  async function handleSubmit() {
    const desc = document.getElementById("complaintDesc").value.trim();
    const errEl = document.getElementById("complaintError");
    const btn = document.getElementById("submitComplaintBtn");
    const btnText = document.getElementById("submitComplaintText");

    errEl.classList.remove("visible");

    if (!selectedCategory) {
      errEl.textContent = "Please select a category";
      errEl.classList.add("visible");
      return;
    }

    if (!desc) {
      errEl.textContent = "Please describe your issue";
      errEl.classList.add("visible");
      return;
    }

    btn.disabled = true;
    btnText.textContent = "Submitting...";

    try {
      await StudentAPI.submitComplaint({
        category: selectedCategory,
        description: desc,
        priority: selectedPriority,
      });

      // Show success
      const container = document.getElementById("complaintContent");
      container.innerHTML = `
        <div class="success-message">
          <div class="success-message-icon">✅</div>
          <h3>Complaint Submitted</h3>
          <p>Your complaint has been received. The admin team will review it shortly.</p>
        </div>
        <button class="btn btn-outline" onclick="Complaint.init()" style="margin-top:8px">
          Submit Another
        </button>`;

      // Reset
      selectedCategory = null;
      selectedPriority = "medium";
    } catch (err) {
      errEl.textContent = err.message || "Failed to submit complaint";
      errEl.classList.add("visible");
    } finally {
      btn.disabled = false;
      btnText.textContent = "Submit Complaint";
    }
  }

  return { init, render };
})();
