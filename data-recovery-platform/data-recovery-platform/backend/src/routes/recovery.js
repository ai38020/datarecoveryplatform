const express = require('express');
const { RecoveryTask, RDSInstance } = require('../models');
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate, recoverySchemas, commonSchemas } = require('../utils/validation');
const { createAuditMiddleware } = require('../utils/audit');
const recoveryService = require('../services/recoveryService');
const logger = require('../config/logger');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * @swagger
 * /api/recovery/tasks:
 *   get:
 *     summary: 获取恢复任务列表
 *     tags: [恢复任务]
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
 *         description: 任务状态
 *       - in: query
 *         name: taskType
 *         schema:
 *           type: string
 *         description: 任务类型
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/tasks',
  validate(commonSchemas.pagination, 'query'),
  createAuditMiddleware('查看恢复任务列表', 'RecoveryTask', 'Read'),
  async (req, res, next) => {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = req.query;
      
      const offset = (page - 1) * limit;
      const order = sortBy ? [[sortBy, sortOrder]] : [['created_at', 'DESC']];

      // 构建查询条件
      const where = {};
      if (filters.status) where.status = filters.status;
      if (filters.taskType) where.task_type = filters.taskType;
      if (filters.complianceYear) where.compliance_year = filters.complianceYear;
      if (filters.isAnnualTask !== undefined) where.is_annual_task = filters.isAnnualTask;

      const { rows: tasks, count: total } = await RecoveryTask.findAndCountAll({
        where,
        offset,
        limit,
        order,
        include: [
          {
            association: 'rdsInstance',
            attributes: ['id', 'instance_name', 'instance_id', 'engine']
          },
          {
            association: 'creator',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      res.json({
        tasks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('获取恢复任务列表失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/tasks/{id}:
 *   get:
 *     summary: 获取恢复任务详情
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 获取成功
 *       404:
 *         description: 任务不存在
 */
router.get('/tasks/:id',
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('查看恢复任务详情', 'RecoveryTask', 'Read'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const task = await RecoveryTask.findByPk(id, {
        include: [
          {
            association: 'rdsInstance',
            attributes: ['id', 'instance_name', 'instance_id', 'engine', 'region']
          },
          {
            association: 'creator',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      if (!task) {
        return res.status(404).json({
          error: true,
          message: '恢复任务不存在'
        });
      }

      res.json({ task });
    } catch (error) {
      logger.error('获取恢复任务详情失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/tasks:
 *   post:
 *     summary: 创建恢复任务
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskName
 *               - rdsInstanceId
 *               - sourceInstanceId
 *               - targetInstanceName
 *             properties:
 *               taskName:
 *                 type: string
 *                 description: 任务名称
 *               rdsInstanceId:
 *                 type: string
 *                 description: RDS实例ID
 *               sourceInstanceId:
 *                 type: string
 *                 description: 源实例ID
 *               targetInstanceName:
 *                 type: string
 *                 description: 目标实例名称
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 */
router.post('/tasks',
  authorize('admin', 'operator'),
  validate(recoverySchemas.create),
  createAuditMiddleware('创建恢复任务', 'RecoveryTask', 'Create', 'Medium'),
  async (req, res, next) => {
    try {
      const task = await recoveryService.createTask(req.body, req.user);

      res.status(201).json({
        message: '恢复任务创建成功',
        task
      });
    } catch (error) {
      logger.error('创建恢复任务失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/tasks/{id}:
 *   put:
 *     summary: 更新恢复任务
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 任务不存在
 */
router.put('/tasks/:id',
  authorize('admin', 'operator'),
  validate(commonSchemas.uuid, 'params'),
  validate(recoverySchemas.update),
  createAuditMiddleware('更新恢复任务', 'RecoveryTask', 'Update', 'Medium'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const task = await RecoveryTask.findByPk(id);
      if (!task) {
        return res.status(404).json({
          error: true,
          message: '恢复任务不存在'
        });
      }

      // 检查任务状态，只允许更新特定状态的任务
      if (!['Pending', 'Failed'].includes(task.status)) {
        return res.status(400).json({
          error: true,
          message: '只能更新待执行或失败的任务'
        });
      }

      const oldValues = task.toJSON();
      
      const updateData = {
        task_name: req.body.taskName,
        priority: req.body.priority,
        scheduled_at: req.body.scheduledAt,
        config: req.body.config
      };

      // 过滤undefined值
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await task.update(updateData);

      // 记录变更详情
      req.auditOldValues = oldValues;
      req.auditNewValues = task.toJSON();

      res.json({
        message: '恢复任务更新成功',
        task
      });
    } catch (error) {
      logger.error('更新恢复任务失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/tasks/{id}/execute:
 *   post:
 *     summary: 执行恢复任务
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 执行成功
 *       400:
 *         description: 任务状态不允许执行
 *       404:
 *         description: 任务不存在
 */
router.post('/tasks/:id/execute',
  authorize('admin', 'operator'),
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('执行恢复任务', 'RecoveryTask', 'Execute', 'High'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await recoveryService.executeTask(id, req.user);

      res.json(result);
    } catch (error) {
      logger.error('执行恢复任务失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/tasks/{id}/cancel:
 *   post:
 *     summary: 取消恢复任务
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 取消成功
 *       400:
 *         description: 任务状态不允许取消
 *       404:
 *         description: 任务不存在
 */
router.post('/tasks/:id/cancel',
  authorize('admin', 'operator'),
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('取消恢复任务', 'RecoveryTask', 'Update', 'Medium'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const task = await recoveryService.cancelTask(id, req.user);

      res.json({
        message: '恢复任务已取消',
        task
      });
    } catch (error) {
      logger.error('取消恢复任务失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/tasks/{id}:
 *   delete:
 *     summary: 删除恢复任务
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       400:
 *         description: 任务状态不允许删除
 *       404:
 *         description: 任务不存在
 */
router.delete('/tasks/:id',
  authorize('admin'),
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('删除恢复任务', 'RecoveryTask', 'Delete', 'High'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const task = await RecoveryTask.findByPk(id);
      if (!task) {
        return res.status(404).json({
          error: true,
          message: '恢复任务不存在'
        });
      }

      // 检查任务状态，不允许删除运行中的任务
      if (task.status === 'Running') {
        return res.status(400).json({
          error: true,
          message: '无法删除正在运行的任务'
        });
      }

      await task.destroy();

      res.json({
        message: '恢复任务删除成功'
      });
    } catch (error) {
      logger.error('删除恢复任务失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/statistics:
 *   get:
 *     summary: 获取恢复任务统计信息
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: 统计年份
 *       - in: query
 *         name: taskType
 *         schema:
 *           type: string
 *         description: 任务类型
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/statistics',
  createAuditMiddleware('查看恢复任务统计', 'RecoveryTask', 'Read'),
  async (req, res, next) => {
    try {
      const { year, taskType } = req.query;
      
      const filters = {};
      if (year) {
        filters.compliance_year = year;
      }
      if (taskType) {
        filters.task_type = taskType;
      }

      const statistics = await recoveryService.getTaskStatistics(filters);

      res.json({ statistics });
    } catch (error) {
      logger.error('获取恢复任务统计信息失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/recovery/annual-tasks:
 *   post:
 *     summary: 批量创建年度合规任务
 *     tags: [恢复任务]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - year
 *               - instanceIds
 *             properties:
 *               year:
 *                 type: integer
 *                 description: 合规年度
 *               instanceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: RDS实例ID列表
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.post('/annual-tasks',
  authorize('admin', 'operator'),
  createAuditMiddleware('批量创建年度合规任务', 'RecoveryTask', 'Create', 'Medium'),
  async (req, res, next) => {
    try {
      const { year, instanceIds } = req.body;

      if (!year || !Array.isArray(instanceIds) || instanceIds.length === 0) {
        return res.status(400).json({
          error: true,
          message: '年份和实例ID列表是必填的'
        });
      }

      const createdTasks = [];
      const errors = [];

      for (const instanceId of instanceIds) {
        try {
          // 获取实例信息
          const instance = await RDSInstance.findByPk(instanceId);
          if (!instance) {
            errors.push(`实例 ${instanceId} 不存在`);
            continue;
          }

          // 创建年度任务
          const taskData = {
            taskName: `${year}年度合规恢复任务 - ${instance.instance_name}`,
            rdsInstanceId: instanceId,
            sourceInstanceId: instance.instance_id,
            targetInstanceName: `${instance.instance_name}-compliance-${year}`,
            taskType: 'Annual',
            priority: 'Normal',
            complianceYear: year,
            isAnnualTask: true,
            restoreType: 'BackupSet',
            backupType: 'FullBackup'
          };

          const task = await recoveryService.createTask(taskData, req.user);
          createdTasks.push(task);

        } catch (error) {
          errors.push(`创建实例 ${instanceId} 的年度任务失败: ${error.message}`);
        }
      }

      res.status(201).json({
        message: `批量创建年度合规任务完成，成功 ${createdTasks.length} 个，失败 ${errors.length} 个`,
        createdTasks,
        errors
      });
    } catch (error) {
      logger.error('批量创建年度合规任务失败', { error: error.message });
      next(error);
    }
  }
);

module.exports = router;