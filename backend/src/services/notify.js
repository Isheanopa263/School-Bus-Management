const db = require("../db");
const { sendToToken, sendToTokens } = require("./fcm");

async function notifyAdmins(title, body, data = {}) {
  try {
    // Find ALL active admins, not just those with FCM tokens
    const { rows } = await db.query(
      "SELECT userid, fcm_token FROM users WHERE role = 'admin' AND is_active = true",
    );

    if (rows.length === 0) return;

    // Save notification to DB for EVERY admin
    for (const row of rows) {
      try {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message)
           VALUES ($1, $2, $3, $4)`,
          [row.userid, data.type || "admin_alert", title, body],
        );
      } catch (dbErr) {
        console.warn("[NOTIFY] DB insert failed:", dbErr.message);
      }
    }

    // Send FCM only to admins WITH tokens
    const tokens = rows.map((r) => r.fcm_token).filter(Boolean);
    if (tokens.length > 0) {
      try {
        if (tokens.length === 1) {
          await sendToToken(tokens[0], title, body, data);
        } else {
          await sendToTokens(tokens, title, body, data);
        }
      } catch (fcmErr) {
        console.warn("[NOTIFY] FCM send failed:", fcmErr.message);
      }
    }

    if (process.env.NODE_ENV !== "test") {
      console.log(`[NOTIFY] Sent to ${rows.length} admins: ${title}`);
    }
  } catch (err) {
    console.warn("[NOTIFY] notifyAdmins failed:", err.message);
  }
}

async function notifyDriver(driverId, title, body, data = {}) {
  try {
    const { rows } = await db.query(
      `SELECT u.userid, u.fcm_token
       FROM drivers d
       JOIN users u ON d.userid = u.userid
       WHERE d.id = $1`,
      [driverId],
    );

    if (rows.length === 0) return;
    const user = rows[0];

    // DB insert first
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, $2, $3, $4)`,
        [user.userid, data.type || "driver_alert", title, body],
      );
    } catch (dbErr) {
      console.warn("[NOTIFY] DB insert failed:", dbErr.message);
    }

    // FCM second (only if token exists)
    if (user.fcm_token) {
      try {
        await sendToToken(user.fcm_token, title, body, data);
      } catch (fcmErr) {
        console.warn("[NOTIFY] FCM failed:", fcmErr.message);
      }
    }

    if (process.env.NODE_ENV !== "test") {
      console.log(`[NOTIFY] Sent to driver: ${title}`);
    }
  } catch (err) {
    console.warn("[NOTIFY] notifyDriver failed:", err.message);
  }
}

async function notifyStudent(studentSid, title, body, data = {}) {
  try {
    const { rows } = await db.query(
      `SELECT u.userid, u.fcm_token
       FROM students s
       JOIN users u ON s.userid = u.userid
       WHERE s.sid = $1`,
      [studentSid],
    );

    if (rows.length === 0) return;
    const user = rows[0];

    // DB insert first
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, $2, $3, $4)`,
        [user.userid, data.type || "student_alert", title, body],
      );
    } catch (dbErr) {
      console.warn("[NOTIFY] DB insert failed:", dbErr.message);
    }

    // FCM second
    if (user.fcm_token) {
      try {
        await sendToToken(user.fcm_token, title, body, data);
      } catch (fcmErr) {
        console.warn("[NOTIFY] FCM failed:", fcmErr.message);
      }
    }

    if (process.env.NODE_ENV !== "test") {
      console.log(`[NOTIFY] Sent to student: ${title}`);
    }
  } catch (err) {
    console.warn("[NOTIFY] notifyStudent failed:", err.message);
  }
}

module.exports = { notifyAdmins, notifyDriver, notifyStudent };
