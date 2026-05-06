const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * PUT /api/notifications/token
 * User updates their FCM token from mobile app
 */
router.put("/token", requireAuth, async (req, res) => {
  const { fcm_token } = req.body;

  if (!fcm_token) {
    return res.status(400).json({ error: "fcm_token required" });
  }

  try {
    await db.query("UPDATE users SET fcm_token = $1 WHERE userid = $2", [
      fcm_token,
      req.user.userid,
    ]);
    res.json({ message: "FCM token updated" });
  } catch (err) {
    console.error("Update FCM token error:", err);
    res.status(500).json({ error: "Failed to update token" });
  }
});

module.exports = router;
