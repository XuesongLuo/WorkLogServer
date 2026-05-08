// server/routes/projects.js
const express = require('express');
const router = express.Router();
const { getMongoDb } = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const logger = require('../logger');

const CONTRACT_STATUSES = new Set(['signed', 'unsigned']);

// 自动生成唯一 ID：yyyyMMdd-时间戳
const generateIdFromStart = (start) => {
    const d = new Date(start);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${Date.now()}`;
};

function normalizeContractStatus(value) {
    return CONTRACT_STATUSES.has(value) ? value : 'unsigned';
}

function normalizeProjectPayload(input = {}) {
    const {
        address,
        city,
        state,
        zipcode,
        year,
        insurance,
        type,
        company,
        referrer,
        manager,
        start,
        end,
        contractStatus,
    } = input;

    return {
        address: address || null,
        city: city || null,
        state: state || null,
        zipcode: zipcode || null,
        year: year || null,
        insurance: insurance || null,
        type: type || null,
        company: company || null,
        referrer: referrer || null,
        manager: manager || null,
        contractStatus: normalizeContractStatus(contractStatus),
        start: start ? new Date(start) : null,
        end: end ? new Date(end) : null,
    };
}

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
        const data = (await cursor.toArray()).map(project => ({
            ...project,
            contractStatus: normalizeContractStatus(project.contractStatus),
        }));
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
        res.json({
            ...project,
            contractStatus: normalizeContractStatus(project.contractStatus),
        });
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
            ...normalizeProjectPayload({ start, ...rest }),
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
        res.status(201).json({
            ...project,
            contractStatus: normalizeContractStatus(project.contractStatus),
        });
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
        const projectPayload = normalizeProjectPayload(req.body);
        const result = await db.collection('projects').updateOne(
            { _id: req.params._id },
            { $set: projectPayload }
        );
        if (!result.matchedCount) {
            logger.warn(`【项目更新】失败（未找到）: _id=${req.params._id}, by=${req.user && req.user.username}`);
            return res.status(404).json({ error: '项目未找到' });
        }
        //logger.info(`【项目更新】完全更新: _id=${req.params._id}, by=${req.user && req.user.username}`);
        const project = await db.collection('projects').findOne({ _id: req.params._id });
        res.json({
            ...project,
            contractStatus: normalizeContractStatus(project.contractStatus),
        });
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
        if (Object.prototype.hasOwnProperty.call(updateFields, 'contractStatus')) {
            updateFields.contractStatus = normalizeContractStatus(updateFields.contractStatus);
        }
        if (Object.prototype.hasOwnProperty.call(updateFields, 'start')) {
            updateFields.start = updateFields.start ? new Date(updateFields.start) : null;
        }
        if (Object.prototype.hasOwnProperty.call(updateFields, 'end')) {
            updateFields.end = updateFields.end ? new Date(updateFields.end) : null;
        }
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
        res.json({
            ...project,
            contractStatus: normalizeContractStatus(project.contractStatus),
        });
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
