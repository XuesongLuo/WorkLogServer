// middleware/adminOnly.js
const logger = require('../logger');

function adminOnly(req, res, next) {
    // 依赖于前面的 auth，把 req.user 挂载上来了
    if (!req.user || req.user.role !== 'admin') {
      logger.warn(`【权限】非管理员权限访问被拒绝: user=${req.user && req.user.username}, role=${req.user && req.user.role}, ip=${req.ip}, url=${req.originalUrl}`);
      return res.status(403).json({ message: '需要管理员权限' });
    }
    next();
  }
  module.exports = adminOnly;
  