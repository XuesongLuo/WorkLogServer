// middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
const logger = require('../logger');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    logger.warn(`【鉴权】未登录: ip=${req.ip}, url=${req.originalUrl}`);
    return res.status(401).json({ message: '未登录' });
  }
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.user = payload; // { id, username, role }
    next();
  } catch (err) {
    logger.warn(`【鉴权】token无效: ip=${req.ip}, url=${req.originalUrl}, error=${err.message}`);
    return res.status(401).json({ message: '无效token' });
  }
}

module.exports = authMiddleware;
