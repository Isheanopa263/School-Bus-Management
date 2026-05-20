const admin = require("firebase-admin");
const path = require("path");

let app;
try {
  const serviceAccount = require(
    path.join(__dirname, "../../config/serviceAccountKey.json"),
  );
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  if (process.env.NODE_ENV !== "test") {
    console.log("Firebase Admin initialized");
  }
} catch (err) {
  console.warn("Firebase not configured. Notifications disabled.");
}

/**
 * Send push notification to single token
 */
async function sendToToken(token, title, body, data = {}) {
  if (!app || !token) return null;

  const message = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    ),
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    return response;
  } catch (err) {
    console.error("FCM send error:", err.code);
    return null;
  }
}

/**
 * Send to multiple tokens
 */
async function sendToTokens(tokens, title, body, data = {}) {
  if (!app || !tokens.length) return null;

  const message = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    ),
    tokens: tokens.filter(Boolean),
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return response;
  } catch (err) {
    console.error("FCM multicast error:", err);
    return null;
  }
}

module.exports = { sendToToken, sendToTokens };
