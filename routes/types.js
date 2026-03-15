// server/routes/type.js
const express = require('express');
const router = express.Router();
const { getMongoDb } = require('../db');
const auth = require('../middleware/auth');
const logger = require('../logger');

// GET /api/types - 获取全部类型
router.get('/', async (req, res) => {
  try {
    const db = await getMongoDb();
    const list = await db.collection('types').find().sort({ name: 1 }).toArray();
    res.json(list);
  } catch (e) {
    logger.error(`【类型列表】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/types - 新增类型（需登录）
router.post('/', auth, async (req, res) => {
  try {
    const db = await getMongoDb();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '缺少类型名称' });
    const exists = await db.collection('types').findOne({ name });
    if (exists) {
      logger.warn(`【类型新增】已存在: name=${name}, by=${req.user && req.user.username}`);
      return res.status(409).json({ error: '类型已存在' });
    }
    const result = await db.collection('types').insertOne({ name });
    logger.info(`【类型新增】name=${name}, by=${req.user && req.user.username}`);
    res.json({ _id: result.insertedId, name });
  } catch (e) {
    logger.error(`【类型新增】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/types/:_id - 修改类型名称（需登录）
router.put('/:_id', auth, async (req, res) => {
  try {
    const db = await getMongoDb();
    const { name } = req.body;
    if (!name) {
      logger.warn(`【类型修改】缺少类型名称, by=${req.user && req.user.username}`);
      return res.status(400).json({ error: '缺少类型名称' });
    }
    const exists = await db.collection('types').findOne({ name, _id: { $ne: req.params._id } });
    if (exists) {
      logger.warn(`【类型修改】已存在: name=${name}, by=${req.user && req.user.username}`);
      return res.status(409).json({ error: '类型已存在' });
    }
    await db.collection('types').updateOne(
      { _id: req.params._id },
      { $set: { name } }
    );
    logger.info(`【类型修改】_id=${req.params._id}, newName=${name}, by=${req.user && req.user.username}`);
    res.json({ _id: req.params._id, name });
  } catch (e) {
    logger.error(`【类型修改】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/types/:_id - 删除类型（需登录）
router.delete('/:_id', auth, async (req, res) => {
  try {
    const db = await getMongoDb();
    await db.collection('types').deleteOne({ _id: req.params._id });
    logger.info(`【类型删除】_id=${req.params._id}, by=${req.user && req.user.username}`);
    res.json({ message: '类型已删除', _id: req.params._id });
  } catch (e) {
    logger.error(`【类型删除】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;