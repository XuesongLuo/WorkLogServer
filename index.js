// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const descriptionRoutes = require('./routes/descriptions');
const progressRoutes = require('./routes/progress');
const typeRoutes = require('./routes/types');
const ensureAdminAccount = require('./utils/initAdmin');
const logger = require('./logger');
const morgan = require('morgan');

const app = express();
const PORT = process.env.SERVER_PORT || 4399;

app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

app.use(cors());
app.use(express.json());
// 路由挂载
app.use('/api', userRoutes); 
app.use('/api/tasks', projectRoutes);
app.use('/api/descriptions', descriptionRoutes);
app.use('/api/progress', progressRoutes); 
app.use('/api/types', typeRoutes); 

app.get('/', (req, res) => {
  res.send('WorkLog Server start!');
  logger.info('【Server】根路径被访问');
});

ensureAdminAccount()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`【Server】启动成功: http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    logger.error(`【Server】启动时检测/生成管理员账号失败: ${err.stack || err.message}`);
    process.exit(1);
  });