# 数据恢复验证平台

一个专为阿里金融云RDS数据库设计的年度备份恢复验证平台，满足合规要求并提供完整的审计追踪。

## 项目概述

### 核心功能
- **自动化恢复验证**：支持阿里云RDS的自动化备份恢复测试
- **合规报告生成**：自动生成年度合规验证报告
- **审计日志追踪**：完整记录所有操作的审计日志
- **风险评估分析**：提供风险评估和改进建议
- **多租户支持**：支持多用户角色权限管理

### 技术架构
- **后端**：Node.js + Express + Sequelize + MySQL
- **前端**：React + TypeScript + Ant Design + Vite  
- **云服务**：阿里云RDS SDK
- **文档**：Swagger/OpenAPI 3.0

## 快速开始

### 环境要求
- Node.js 18+
- MySQL 8.0+
- 阿里云账号和RDS实例

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd data-recovery-platform
```

2. **安装后端依赖**
```bash
cd backend
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和阿里云信息
```

4. **初始化数据库**
```bash
npm run db:migrate
npm run db:seed
```

5. **启动后端服务**
```bash
npm run dev
```

6. **安装前端依赖**
```bash
cd ../frontend
npm install
```

7. **启动前端服务**
```bash
npm run dev
```

### 环境变量配置

后端 `.env` 配置：
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=data_recovery_platform
DB_USER=root
DB_PASSWORD=your_password

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# 阿里云配置
ALICLOUD_ACCESS_KEY_ID=your_access_key_id
ALICLOUD_ACCESS_KEY_SECRET=your_access_key_secret
ALICLOUD_REGION=cn-shenzhen
```

## 功能模块

### 1. 用户管理
- 用户注册/登录
- 角色权限控制（管理员/操作员/审计员）
- 用户信息管理

### 2. RDS实例管理
- 添加/编辑RDS实例信息
- 同步阿里云实例状态
- 实例监控状态管理

### 3. 恢复任务管理
- 创建恢复验证任务
- 自动化执行恢复流程
- 任务进度跟踪
- 批量创建年度合规任务

### 4. 审计日志
- 完整的操作审计追踪
- 风险等级分类
- 审计日志查询和导出
- 高风险操作告警

### 5. 合规报告
- 自动生成年度合规报告
- Excel格式报告导出
- 报告审批流程
- 统计分析和风险评估

## API文档

启动服务后访问：`http://localhost:3000/api-docs`

### 主要API端点

- **认证**: `/api/auth`
  - POST `/login` - 用户登录
  - POST `/register` - 用户注册
  - POST `/logout` - 用户登出

- **RDS管理**: `/api/rds`
  - GET `/instances` - 获取实例列表
  - POST `/instances` - 添加实例
  - PUT `/instances/:id` - 更新实例
  - POST `/instances/:id/sync` - 同步实例状态

- **恢复任务**: `/api/recovery`
  - GET `/tasks` - 获取任务列表
  - POST `/tasks` - 创建任务
  - POST `/tasks/:id/execute` - 执行任务
  - POST `/annual-tasks` - 批量创建年度任务

- **审计日志**: `/api/audit`
  - GET `/logs` - 获取审计日志
  - GET `/statistics` - 获取审计统计
  - GET `/export` - 导出审计日志

- **报告管理**: `/api/report`
  - GET `/compliance` - 获取报告列表
  - POST `/compliance` - 生成报告
  - GET `/compliance/:id/download` - 下载报告

## 数据库设计

### 核心表结构

1. **users** - 用户表
2. **rds_instances** - RDS实例表
3. **recovery_tasks** - 恢复任务表
4. **audit_logs** - 审计日志表
5. **compliance_reports** - 合规报告表

详细字段说明请参考 `/backend/src/models/` 目录下的模型文件。

## 部署指南

### Docker部署

1. **构建镜像**
```bash
docker build -t data-recovery-platform .
```

2. **运行容器**
```bash
docker-compose up -d
```

### 生产环境配置

1. **环境变量设置**
```bash
export NODE_ENV=production
export JWT_SECRET=your_production_secret
```

2. **数据库优化**
- 配置连接池
- 设置索引优化
- 配置备份策略

3. **安全配置**
- 配置HTTPS
- 设置防火墙规则
- 启用日志监控

## 监控和维护

### 日志管理
- 应用日志：`/logs/combined.log`
- 错误日志：`/logs/error.log`
- 审计日志：存储在数据库中

### 性能监控
- API响应时间监控
- 数据库查询性能
- 恢复任务执行时间

### 备份策略
- 数据库定期备份
- 报告文件备份
- 配置文件备份

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库服务状态
   - 验证连接配置
   - 检查网络连通性

2. **阿里云API调用失败**
   - 验证AccessKey配置
   - 检查API权限
   - 确认地域设置

3. **任务执行失败**
   - 查看错误日志
   - 检查实例状态
   - 验证备份可用性

### 调试模式

启用详细日志：
```bash
export LOG_LEVEL=debug
npm run dev
```

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License

## 联系支持

如有问题或建议，请联系项目维护团队。