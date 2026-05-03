const crypto = require("crypto");

const sessions = new Map();

function publicUser(row) {
  return {
    user_id: row.user_id,
    username: row.username,
    role: row.role,
  };
}

function createAuthResponse(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const safeUser = publicUser(user);
  sessions.set(token, safeUser);
  return { ...safeUser, token };
}

function authToken(req) {
  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return req.query.token;
}

function getSession(token) {
  return sessions.get(token);
}

function deleteSession(token) {
  sessions.delete(token);
}

module.exports = { authToken, createAuthResponse, deleteSession, getSession };
