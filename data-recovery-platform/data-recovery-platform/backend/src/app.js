const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// 加载环境变量
dotenv.config();

// 导入路由
const authRoutes = require('./routes/auth');
const rdsRoutes = require('./routes/rds');
const recoveryRoutes = require('./routes/recovery');
const auditRoutes = require('./routes/audit');
const reportRoutes = require('./routes/report');
const agentRoutes = require('./routes/agent');

// 导入中间件
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

// 导入数据库
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger配置
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '数据恢复验证平台 API',
      version: '1.0.0',
      description: '阿里云RDS数据恢复验证平台的API文档',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: '开发环境',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // API文档的路径
};

const specs = swaggerJsdoc(swaggerOptions);

// 中间件配置
app.use(helmet()); // 安全头
app.use(cors()); // 跨域
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true })); // URL编码解析
app.use(logger); // 日志中间件

// API文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/rds', rdsRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/agent', agentRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: '数据恢复验证平台 API',
    version: '1.0.0',
    docs: '/api-docs'
  });
});

// 错误处理中间件
app.use(errorHandler);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'API接口不存在',
    path: req.originalUrl
  });
});

// 数据库连接和服务启动
async function startServer() {
  try {
    // 测试数据库连接
    await db.authenticate();
    console.log('数据库连接成功');
    
    // 同步数据库模型
    await db.sync({ alter: true });
    console.log('数据库模型同步完成');
    
    // 启动服务
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`API文档地址: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，正在关闭服务...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到SIGINT信号，正在关闭服务...');
  await db.close();
  process.exit(0);
});

// 启动服务器
if (require.main === module) {
  startServer();
}

module.exports = app;