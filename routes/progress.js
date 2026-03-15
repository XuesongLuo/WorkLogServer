const express = require('express');
const router = express.Router();
const { getMongoDb } = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const logger = require('../logger');

function flattenForSet(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(acc, flattenForSet(val, prefix ? `${prefix}.${key}` : key));
    } else {
      acc[prefix ? `${prefix}.${key}` : key] = val;
    }
    return acc;
  }, {});
}

// GET /api/progress?page=1&pageSize=50
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = await getMongoDb();
    const page = parseInt(req.query.page || '1');
    const pageSize = parseInt(req.query.pageSize || '100');
    const skip = (page - 1) * pageSize;
    // 查主表
    const projects = await db.collection('projects').find().toArray();
    const projectMap = Object.fromEntries(projects.map(p => [p._id, p]));
    // 查进度表分页
    const progressRows = await db.collection('progress')
      .find()
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();
    const total = await db.collection('progress').countDocuments();
    const progressArray = progressRows.map(progress => {
      const project = projectMap[progress._id] || {};
      const location = [project.address, project.city, project.state, project.zipcode].filter(Boolean).join(', ');
      return {
        ...progress,
        location,
        year: project.year,
        insurance: project.insurance,
      };
    });
    //logger.info(`【进度分页】查询: page=${page}, pageSize=${pageSize}, by=${req.user && req.user.username}`);
    res.json({ data: progressArray, total });
  } catch (e) {
    logger.error(`【进度分页】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/progress  → 表格一次性加载（管理员可访问）
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = await getMongoDb();
    // 查主表项目数据
    const projects = await db.collection('projects').find().toArray();
    const projectMap = Object.fromEntries(projects.map(p => [p._id, p]));
    // 查进度表
    const progressRows = await db.collection('progress').find().toArray();
    // 合并：为每一行进度加 location/year/insurance 字段
    const progressArray = progressRows.map(progress => {
      const project = projectMap[progress._id] || {};
      const location = [project.address, project.city, project.state, project.zipcode].filter(Boolean).join(', ');
      return {
        ...progress,
        location,
        year: project.year,
        insurance: project.insurance,
      };
    });
    //logger.info(`【进度全量】查询全部项目进度 by=${req.user && req.user.username}`);
    res.json(progressArray);
  } catch (e) {
    logger.error(`【进度全量】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// patch /api/progress/:_id  → 表格字段更新（管理员可访问）
router.patch('/:_id', auth, adminOnly, async (req, res) => {
  const _id = req.params._id;
  const updateFields = { ...req.body };
  if (!Object.keys(updateFields).length) {
    logger.warn(`【进度更新】缺少更新字段: _id=${_id}, by=${req.user && req.user.username}`);
    return res.status(400).json({ error: '无可更新字段' });
  }
  try {
    const db = await getMongoDb();
    // --- 扁平化传入字段 ---
    const setFields = flattenForSet(updateFields);
    // 只更新传入的字段（可嵌套）
    const result = await db.collection('progress').updateOne({ _id }, { $set: setFields });
    if (!result.matchedCount) {
      logger.warn(`【进度更新】未找到: _id=${_id}, by=${req.user && req.user.username}`);
      return res.status(404).json({ error: '进度行不存在，无法修改' });
    }
    const row = await db.collection('progress').findOne({ _id });
    res.json(row);
  } catch (e) {
    logger.error(`【进度更新】异常: ${e.stack || e.message}`);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;