const express = require('express');
const { RDSInstance } = require('../models');
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate, rdsSchemas, commonSchemas } = require('../utils/validation');
const { createAuditMiddleware } = require('../utils/audit');
const rdsService = require('../services/rdsService');
const logger = require('../config/logger');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * @swagger
 * /api/rds/instances:
 *   get:
 *     summary: 获取RDS实例列表
 *     tags: [RDS管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: 每页数量
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 实例状态
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/instances', 
  validate(commonSchemas.pagination, 'query'),
  createAuditMiddleware('查看RDS实例列表', 'RDSInstance', 'Read'),
  async (req, res, next) => {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = req.query;
      
      const offset = (page - 1) * limit;
      const order = sortBy ? [[sortBy, sortOrder]] : [['created_at', 'DESC']];

      // 查询数据库中的RDS实例
      const { rows: instances, count: total } = await RDSInstance.findAndCountAll({
        where: filters,
        offset,
        limit,
        order,
        include: [
          {
            association: 'creator',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      res.json({
        instances,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('获取RDS实例列表失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/rds/instances/{id}:
 *   get:
 *     summary: 获取RDS实例详情
 *     tags: [RDS管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 实例ID
 *     responses:
 *       200:
 *         description: 获取成功
 *       404:
 *         description: 实例不存在
 */
router.get('/instances/:id',
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('查看RDS实例详情', 'RDSInstance', 'Read'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const instance = await RDSInstance.findByPk(id, {
        include: [
          {
            association: 'creator',
            attributes: ['id', 'username', 'real_name']
          },
          {
            association: 'recoveryTasks',
            limit: 10,
            order: [['created_at', 'DESC']],
            attributes: ['id', 'task_name', 'status', 'created_at']
          }
        ]
      });

      if (!instance) {
        return res.status(404).json({
          error: true,
          message: 'RDS实例不存在'
        });
      }

      // 获取阿里云实例的实时状态
      try {
        const cloudInstance = await rdsService.getInstance(instance.instance_id);
        if (cloudInstance) {
          // 更新本地实例状态
          await instance.update({
            status: cloudInstance.dbInstanceStatus,
            connection_string: cloudInstance.connectionString,
            port: cloudInstance.port
          });
        }
      } catch (cloudError) {
        logger.warn('获取云端实例状态失败', {
          instanceId: instance.instance_id,
          error: cloudError.message
        });
      }

      res.json({ instance });
    } catch (error) {
      logger.error('获取RDS实例详情失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/rds/instances:
 *   post:
 *     summary: 添加RDS实例
 *     tags: [RDS管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instanceId
 *               - instanceName
 *               - engine
 *               - engineVersion
 *             properties:
 *               instanceId:
 *                 type: string
 *                 description: 阿里云实例ID
 *               instanceName:
 *                 type: string
 *                 description: 实例名称
 *               engine:
 *                 type: string
 *                 enum: [MySQL, PostgreSQL, SQLServer, PPAS, MariaDB]
 *                 description: 数据库引擎
 *               engineVersion:
 *                 type: string
 *                 description: 引擎版本
 *     responses:
 *       201:
 *         description: 添加成功
 *       409:
 *         description: 实例已存在
 */
router.post('/instances',
  authorize('admin', 'operator'),
  validate(rdsSchemas.create),
  createAuditMiddleware('添加RDS实例', 'RDSInstance', 'Create', 'Medium'),
  async (req, res, next) => {
    try {
      const instanceData = {
        ...req.body,
        instance_id: req.body.instanceId,
        instance_name: req.body.instanceName,
        engine: req.body.engine,
        engine_version: req.body.engineVersion,
        region: req.body.region || 'cn-shenzhen',
        zone: req.body.zone,
        instance_class: req.body.instanceClass,
        storage_type: req.body.storageType,
        storage_size: req.body.storageSize,
        vpc_id: req.body.vpcId,
        vswitch_id: req.body.vswitchId,
        connection_string: req.body.connectionString,
        port: req.body.port,
        backup_retention_period: req.body.backupRetentionPeriod,
        backup_time: req.body.backupTime,
        description: req.body.description,
        created_by: req.user.id
      };

      // 检查实例是否已存在
      const existingInstance = await RDSInstance.findOne({
        where: { instance_id: instanceData.instance_id }
      });

      if (existingInstance) {
        return res.status(409).json({
          error: true,
          message: 'RDS实例已存在'
        });
      }

      // 从阿里云获取实例详情
      try {
        const cloudInstance = await rdsService.getInstance(instanceData.instance_id);
        if (cloudInstance) {
          // 使用云端数据补充实例信息
          instanceData.status = cloudInstance.dbInstanceStatus;
          instanceData.instance_class = cloudInstance.dbInstanceClass;
          instanceData.storage_size = cloudInstance.dbInstanceStorage;
          instanceData.connection_string = cloudInstance.connectionString;
          instanceData.port = cloudInstance.port;
          instanceData.vpc_id = cloudInstance.vpcId;
          instanceData.vswitch_id = cloudInstance.vSwitchId;
        }
      } catch (cloudError) {
        logger.warn('获取云端实例信息失败，使用用户提供的信息', {
          instanceId: instanceData.instance_id,
          error: cloudError.message
        });
      }

      const instance = await RDSInstance.create(instanceData);

      res.status(201).json({
        message: 'RDS实例添加成功',
        instance
      });
    } catch (error) {
      logger.error('添加RDS实例失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/rds/instances/{id}:
 *   put:
 *     summary: 更新RDS实例
 *     tags: [RDS管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 实例ID
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 实例不存在
 */
router.put('/instances/:id',
  authorize('admin', 'operator'),
  validate(commonSchemas.uuid, 'params'),
  validate(rdsSchemas.update),
  createAuditMiddleware('更新RDS实例', 'RDSInstance', 'Update', 'Medium'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const instance = await RDSInstance.findByPk(id);
      if (!instance) {
        return res.status(404).json({
          error: true,
          message: 'RDS实例不存在'
        });
      }

      const oldValues = instance.toJSON();
      
      const updateData = {
        instance_name: req.body.instanceName,
        description: req.body.description,
        backup_retention_period: req.body.backupRetentionPeriod,
        backup_time: req.body.backupTime,
        is_monitored: req.body.isMonitored
      };

      // 过滤undefined值
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await instance.update(updateData);

      // 记录变更详情
      req.auditOldValues = oldValues;
      req.auditNewValues = instance.toJSON();

      res.json({
        message: 'RDS实例更新成功',
        instance
      });
    } catch (error) {
      logger.error('更新RDS实例失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/rds/instances/{id}:
 *   delete:
 *     summary: 删除RDS实例记录
 *     tags: [RDS管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 实例ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 实例不存在
 */
router.delete('/instances/:id',
  authorize('admin'),
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('删除RDS实例记录', 'RDSInstance', 'Delete', 'High'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const instance = await RDSInstance.findByPk(id);
      if (!instance) {
        return res.status(404).json({
          error: true,
          message: 'RDS实例不存在'
        });
      }

      // 检查是否有关联的恢复任务
      const taskCount = await instance.countRecoveryTasks();
      if (taskCount > 0) {
        return res.status(400).json({
          error: true,
          message: '无法删除：存在关联的恢复任务'
        });
      }

      await instance.destroy();

      res.json({
        message: 'RDS实例记录删除成功'
      });
    } catch (error) {
      logger.error('删除RDS实例记录失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/rds/instances/{id}/sync:
 *   post:
 *     summary: 同步RDS实例状态
 *     tags: [RDS管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 实例ID
 *     responses:
 *       200:
 *         description: 同步成功
 */
router.post('/instances/:id/sync',
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('同步RDS实例状态', 'RDSInstance', 'Update'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const instance = await RDSInstance.findByPk(id);
      if (!instance) {
        return res.status(404).json({
          error: true,
          message: 'RDS实例不存在'
        });
      }

      // 从阿里云同步实例信息
      const cloudInstance = await rdsService.getInstance(instance.instance_id);
      
      if (cloudInstance) {
        await instance.update({
          status: cloudInstance.dbInstanceStatus,
          instance_class: cloudInstance.dbInstanceClass,
          storage_size: cloudInstance.dbInstanceStorage,
          connection_string: cloudInstance.connectionString,
          port: cloudInstance.port,
          vpc_id: cloudInstance.vpcId,
          vswitch_id: cloudInstance.vSwitchId
        });
      }

      res.json({
        message: 'RDS实例状态同步成功',
        instance
      });
    } catch (error) {
      logger.error('同步RDS实例状态失败', { error: error.message });
      next(error);
    }
  }
);

module.exports = router;