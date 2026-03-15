// server/routes/projects.js
const express = require('express');
const router = express.Router();
const { getMongoDb } = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const logger = require('../logger');

// 自动生成唯一 ID：yyyyMMdd-时间戳
const generateIdFromStart = (start) => {
    const d = new Date(start);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${Date.now()}`;
};

// GET /api/tasks?page=1&pageSize=100
router.get('/', async (req, res) => {
    try {
        const db = await getMongoDb();
        const page = parseInt(req.query.page || '1');
        const pageSize = parseInt(req.query.pageSize || '100');
        const skip = (page - 1) * pageSize;

        const cursor = db.collection('projects')
                         .find({})
                         .sort({ _id: -1 })   // 默认按开始时间降序
                         .skip(skip)
                         .limit(pageSize);
        const total = await db.collection('projects').countDocuments();
        const data = await cursor.toArray();
        res.json({ data, total });
    } catch (e) {
        logger.error(`【项目列表】异常: ${e.stack || e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/tasks/:_id - 获取单个项目详情（p_id）
router.get('/:_id', async (req, res) => {
    try {
        const db = await getMongoDb();
        const project = await db.collection('projects').findOne({ _id: req.params._id });
        if (!project){
            logger.warn(`【项目详情】获取失败（未找到）: _id=${req.params._id}`);
            return res.status(404).json({ error: '项目未找到' });
        } 
        res.json(project);
    } catch (e) {
        logger.error(`【项目详情】异常: ${e.stack || e.message}`);
        res.status(500).json({ error: e.message });
    }
});


// POST /api/tasks - 创建项目（管理员权限）
router.post('/', auth, adminOnly, async (req, res) => {
    const { start, ...rest } = req.body;
    if (!start) {
        logger.warn(`【项目新增】缺少start字段, by=${req.user && req.user.username}`);
        return res.status(400).json({ error: '缺少 start 字段, 无法生成项目ID' });
    }
    const _id = generateIdFromStart(start);
    try {
        const db = await getMongoDb();
        // 必填字段按你的表结构补全
        await db.collection('projects').insertOne({
            _id: _id,
            address: rest.address || null,
            city: rest.city || null,
            state: rest.state || null,
            zipcode: rest.zipcode || null,
            year: rest.year || null,
            insurance: rest.insurance || null,
            type: rest.type || null,
            company: rest.company || null,
            referrer: rest.referrer || null,
            manager: rest.manager || null,
            start: start ? new Date(start) : null,
            end: rest.end ? new Date(rest.end) : null,
        });
        // 进度表初始化
        await db.collection('progress').insertOne({
            _id : _id,
            arol: false,
            test: false,
            pak: {
                active: false, start_date: null, pout: false, pack: false,
                estimate: {
                    send: { checked: false, amount: 0 },
                    review: { checked: false, amount: 0 },
                    agree: { checked: false, amount: 0 }
                }
            },
            wtr: {
                active: false, start_date: null, ctrc: false, demo: false, itel: false, eq: false, pick: false,
                estimate: {
                    send: { checked: false, amount: 0 },
                    review: { checked: false, amount: 0 },
                    agree: { checked: false, amount: 0 }
                }
            },
            str: {
                active: false, start_date: null, ctrc: false,
                estimate: {
                    send: { checked: false, amount: 0 },
                    review: { checked: false, amount: 0 },
                    agree: { checked: false, amount: 0 }
                }
            },
            payment: 0,
            comments: ""
        });
        //logger.info(`【项目新增】新建: _id=${_id}, by=${req.user && req.user.username}`);
        const project = await db.collection('projects').findOne({ _id: _id });
        res.status(201).json(project);
    } catch (e) {
        logger.error(`【项目新增】异常: ${e.stack || e.message}`);
        res.status(500).json({ error: e.message });
    }
});


// PUT /api/tasks/:_id - 完全更新（管理员权限）
router.put('/:_id', auth, adminOnly, async (req, res) => {
    try {
        const db = await getMongoDb();
        // 这里只做全字段更新（一般业务可先查再改，也可直接update）
        const { address, city, state, zipcode, year, insurance, type, company, referrer, manager, start, end } = req.body;
        const result = await db.collection('projects').updateOne(
            { _id: req.params._id },
            { $set: { address, city, state, zipcode, year, insurance, type, company, referrer, manager, start, end } }
        );
        if (!result.matchedCount) {
            logger.warn(`【项目更新】失败（未找到）: _id=${req.params._id}, by=${req.user && req.user.username}`);
            return res.status(404).json({ error: '项目未找到' });
        }
        //logger.info(`【项目更新】完全更新: _id=${req.params._id}, by=${req.user && req.user.username}`);
        const project = await db.collection('projects').findOne({ _id: req.params._id });
        res.json(project);
    } catch (e) {
        logger.error(`【项目更新】异常: ${e.stack || e.message}`);
        res.status(500).json({ error: e.message });
    }
});


// PATCH /api/tasks/:_id - 部分字段更新（管理员权限）
router.patch('/:_id', auth, adminOnly, async (req, res) => {
    try {
        const db = await getMongoDb();
        // 只更新传入的字段
        const updateFields = { ...req.body };
        const result = await db.collection('projects').updateOne(
            { _id: req.params._id },
            { $set: updateFields }
        );
        if (!result.matchedCount) {
            logger.warn(`【项目字段更新】失败（未找到）: _id=${req.params._id}, by=${req.user && req.user.username}`);
            return res.status(404).json({ error: '项目未找到' });
        }
        //logger.info(`【项目字段更新】_id=${req.params._id}, by=${req.user && req.user.username}, fields=${Object.keys(updateFields).join(',')}`);
        const project = await db.collection('projects').findOne({ _id: req.params._id });
        res.json(project);
    } catch (e) {
        logger.error(`【项目字段更新】异常: ${e.stack || e.message}`);
        res.status(500).json({ error: e.message });
    }
});


// DELETE /api/tasks/:_id - 删除项目（管理员权限）
router.delete('/:_id', auth, adminOnly, async (req, res) => {
    logger.info(`【项目删除】尝试删除: _id=${req.params._id}, by=${req.user && req.user.username}`);
    try {
        const db = await getMongoDb();
        // 1. 删除项目主表
        const result = await db.collection('projects').deleteOne({ _id: req.params._id });
        // 2. 删除进度表相关行
        await db.collection('progress').deleteOne({ _id: req.params._id });
         // 3. 删除描述表相关行
        await db.collection('descriptions').deleteOne({ _id: req.params._id });
        if (!result.deletedCount) {
            logger.warn(`【项目删除】失败（未找到）: _id=${req.params._id}, by=${req.user && req.user.username}`);
            return res.status(404).json({ error: '项目未找到' });
        }
        logger.info(`【项目删除】成功: _id=${req.params._id}, by=${req.user && req.user.username}`);
        res.status(204).end();
    } catch (e) {
        logger.error(`【项目删除】异常: ${e.stack || e.message}`);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;