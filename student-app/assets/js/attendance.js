/**
 * Attendance Screen Controller
 */
const Attendance = (() => {
  async function load() {
    const container = document.getElementById("attendanceContent");
    if (!container) return;

    try {
      const data = await StudentAPI.getAttendance();
      const records = data.attendance || [];

      if (records.length === 0) {
        container.innerHTML = `
          <div class="notifications-empty">
            <div class="notifications-empty-icon">📋</div>
            <h3>No Attendance Records</h3>
            <p>Your pickup and drop history will appear here.</p>
          </div>`;
        return;
      }

      // Group by date
      const grouped = {};
      records.forEach((r) => {
        const date = new Date(r.timestamp).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(r);
      });

      container.innerHTML = Object.keys(grouped)
        .map(
          (date) => `
        <div class="attendance-date-group">
          <h3 class="attendance-date-header">${date}</h3>
          ${grouped[date]
            .map(
              (r) => `
            <div class="attendance-item">
              <div class="attendance-icon ${r.event_type}">
                ${r.event_type === "pickup" ? "🚌" : "🏠"}
              </div>
              <div class="attendance-info">
                <div class="attendance-type">
                  ${r.event_type === "pickup" ? "Picked Up" : "Dropped Off"}
                </div>
                <div class="attendance-stop">${r.stop_name || "Unknown stop"}</div>
                <div class="attendance-route">${r.route_name || ""}</div>
              </div>
              <div class="attendance-time">
                ${new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `,
        )
        .join("");
    } catch (err) {
      container.innerHTML = `
        <div class="notifications-empty">
          <p style="color:var(--text-muted)">Failed to load attendance</p>
        </div>`;
    }
  }

  return { load };
})();
