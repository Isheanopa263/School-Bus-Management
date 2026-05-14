/**
 * Notifications Screen Controller
 */
const Notifications = (() => {
  function init() {
    load();
  }

  async function load() {
    const container = document.getElementById("notificationsContent");
    if (!container) return;

    try {
      const data = await StudentAPI.getNotifications();
      const notifications = data.notifications || [];
      render(container, notifications);
    } catch (err) {
      container.innerHTML = `
        <div class="notifications-empty">
          <p style="color:var(--text-muted)">Failed to load notifications</p>
        </div>`;
    }
  }

  function render(container, notifications) {
    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="notifications-empty">
          <div class="notifications-empty-icon">🔔</div>
          <h3>No Notifications</h3>
          <p>You're all caught up! Notifications will appear here.</p>
        </div>`;
      return;
    }

    const iconMap = {
      bus_approved: "✅",
      bus_rejected: "❌",
      trip_started: "🚌",
      trip_completed: "🏁",
    };

    container.innerHTML = notifications
      .map(
        (n) => `
      <div class="notification-item">
        <div class="notification-icon ${n.type || "default"}">
          ${iconMap[n.type] || "🔔"}
        </div>
        <div class="notification-content">
          <div class="notification-title">${n.title || "Notification"}</div>
          <div class="notification-message">${n.message || ""}</div>
          <div class="notification-time">
            ${n.sent_at ? new Date(n.sent_at).toLocaleString() : ""}
          </div>
        </div>
      </div>`,
      )
      .join("");
  }

  return { init, load };
})();
