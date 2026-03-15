// server/routes/descriptions.js
const express = require('express');
const router = express.Router();
const getMongoDb = require('../db/mongo');
const auth = require('../middleware/auth');
const logger = require('../logger');

// GET /api/descriptions/:_id - 查找描述内容
router.get('/:_id', async (req, res) => {
  try {
    const db = await getMongoDb();
    const doc = await db.collection('descriptions').findOne({ _id: req.params._id });
    if (!doc) {
      logger.warn(`【描述查找】未找到: _id=${req.params._id}`);
      return res.status(404).json({ error: '描述未找到' });
    }
    res.json({ description: doc.description, user_id: doc.user_id });
  } catch (e) {
    logger.error(`【描述查找】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/descriptions/:_id - 更新或新建描述（需登录）
router.put('/:_id', auth, async (req, res) => {
  try {
    const db = await getMongoDb();
    const { description } = req.body;
    if (description === undefined) {
      logger.warn(`【描述更新】缺少描述内容: _id=${req.params._id}, by=${req.user && req.user.username}`);
      return res.status(400).json({ error: '缺少描述内容' });
    }
    await db.collection('descriptions').updateOne(
      { _id: req.params._id },
      { $set: { description, user_id: req.user.id, updated_at: new Date() } },
      { upsert: true }
    );
    res.json({ message: '描述已保存', _id: req.params._id, user_id: req.user.id });
  } catch (e) {
    logger.error(`【描述更新】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;