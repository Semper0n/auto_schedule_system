const { authToken, getSession } = require("../services/auth");

function requireAuth(req, res, next) {
  if (req.path.startsWith("/auth/") || req.originalUrl.startsWith("/api/auth/")) {
    return next();
  }

  const token = authToken(req);
  const user = token ? getSession(token) : null;
  if (!user) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }

  req.user = user;
  return next();
}

module.exports = { requireAuth };
