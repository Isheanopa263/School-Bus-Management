/**
 * Notification Helper
 * Sends push notifications to users by role
 */
const db = require("../db");
const { sendToToken, sendToTokens } = require("./fcm");

/**
 * Notify all admins
 */
async function notifyAdmins(title, body, data = {}) {
  try {
    const { rows } = await db.query(
      "SELECT userid, fcm_token FROM users WHERE role = 'admin' AND fcm_token IS NOT NULL AND is_active = true",
    );

    if (rows.length === 0) return;

    const tokens = rows.map((r) => r.fcm_token).filter(Boolean);
    if (tokens.length === 0) return;

    // Save to notifications table for each admin
    for (const row of rows) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, $2, $3, $4)`,
        [row.userid, data.type || "admin_alert", title, body],
      );
    }

    // Send FCM push
    if (tokens.length === 1) {
      await sendToToken(tokens[0], title, body, data);
    } else {
      await sendToTokens(tokens, title, body, data);
    }

    console.log(`[NOTIFY] Sent to ${tokens.length} admins: ${title}`);
  } catch (err) {
    console.warn("[NOTIFY] notifyAdmins failed:", err.message);
  }
}

/**
 * Notify a specific driver
 */
async function notifyDriver(driverId, title, body, data = {}) {
  try {
    const { rows } = await db.query(
      `SELECT u.userid, u.fcm_token
       FROM drivers d
       JOIN users u ON d.userid = u.userid
       WHERE d.id = $1 AND u.fcm_token IS NOT NULL`,
      [driverId],
    );

    if (rows.length === 0) return;

    const user = rows[0];

    // Save to notifications table
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [user.userid, data.type || "driver_alert", title, body],
    );

    // Send FCM push
    await sendToToken(user.fcm_token, title, body, data);
    console.log(`[NOTIFY] Sent to driver: ${title}`);
  } catch (err) {
    console.warn("[NOTIFY] notifyDriver failed:", err.message);
  }
}

/**
 * Notify a specific student
 */
async function notifyStudent(studentSid, title, body, data = {}) {
  try {
    const { rows } = await db.query(
      `SELECT u.userid, u.fcm_token
       FROM students s
       JOIN users u ON s.userid = u.userid
       WHERE s.sid = $1 AND u.fcm_token IS NOT NULL`,
      [studentSid],
    );

    if (rows.length === 0) return;

    const user = rows[0];

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [user.userid, data.type || "student_alert", title, body],
    );

    await sendToToken(user.fcm_token, title, body, data);
    console.log(`[NOTIFY] Sent to student: ${title}`);
  } catch (err) {
    console.warn("[NOTIFY] notifyStudent failed:", err.message);
  }
}

module.exports = { notifyAdmins, notifyDriver, notifyStudent };
