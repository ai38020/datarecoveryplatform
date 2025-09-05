const express = require('express');
const { AuditLog } = require('../models');
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate, commonSchemas } = require('../utils/validation');
const { createAuditMiddleware } = require('../utils/audit');
const logger = require('../config/logger');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * @swagger
 * /api/audit/logs:
 *   get:
 *     summary: 获取审计日志列表
 *     tags: [审计管理]
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
 *         name: action
 *         schema:
 *           type: string
 *         description: 操作动作
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *         description: 资源类型
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 操作状态
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *         description: 风险级别
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/logs',
  authorize('admin', 'auditor'),
  validate(commonSchemas.pagination, 'query'),
  createAuditMiddleware('查看审计日志', 'AuditLog', 'Read'),
  async (req, res, next) => {
    try {
      const { page, limit, sortBy, sortOrder, startDate, endDate, ...filters } = req.query;
      
      const offset = (page - 1) * limit;
      const order = sortBy ? [[sortBy, sortOrder]] : [['created_at', 'DESC']];

      // 构建查询条件
      const where = {};
      if (filters.action) where.action = { [require('sequelize').Op.like]: `%${filters.action}%` };
      if (filters.resourceType) where.resource_type = filters.resourceType;
      if (filters.status) where.status = filters.status;
      if (filters.riskLevel) where.risk_level = filters.riskLevel;
      if (filters.username) where.username = { [require('sequelize').Op.like]: `%${filters.username}%` };
      if (filters.ipAddress) where.ip_address = filters.ipAddress;

      // 日期范围过滤
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at[require('sequelize').Op.gte] = new Date(startDate);
        if (endDate) where.created_at[require('sequelize').Op.lte] = new Date(endDate + ' 23:59:59');
      }

      const { rows: logs, count: total } = await AuditLog.findAndCountAll({
        where,
        offset,
        limit,
        order,
        include: [
          {
            association: 'user',
            attributes: ['id', 'username', 'real_name'],
            required: false
          }
        ]
      });

      res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('获取审计日志列表失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/audit/logs/{id}:
 *   get:
 *     summary: 获取审计日志详情
 *     tags: [审计管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 日志ID
 *     responses:
 *       200:
 *         description: 获取成功
 *       404:
 *         description: 日志不存在
 */
router.get('/logs/:id',
  authorize('admin', 'auditor'),
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('查看审计日志详情', 'AuditLog', 'Read'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const log = await AuditLog.findByPk(id, {
        include: [
          {
            association: 'user',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      if (!log) {
        return res.status(404).json({
          error: true,
          message: '审计日志不存在'
        });
      }

      res.json({ log });
    } catch (error) {
      logger.error('获取审计日志详情失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/audit/statistics:
 *   get:
 *     summary: 获取审计统计信息
 *     tags: [审计管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/statistics',
  authorize('admin', 'auditor'),
  createAuditMiddleware('查看审计统计', 'AuditLog', 'Read'),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      
      // 构建时间范围条件
      const timeFilter = {};
      if (startDate || endDate) {
        timeFilter.created_at = {};
        if (startDate) timeFilter.created_at[require('sequelize').Op.gte] = new Date(startDate);
        if (endDate) timeFilter.created_at[require('sequelize').Op.lte] = new Date(endDate + ' 23:59:59');
      }

      // 按状态统计
      const statusStats = await AuditLog.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: timeFilter,
        group: ['status'],
        raw: true
      });

      // 按风险级别统计
      const riskLevelStats = await AuditLog.findAll({
        attributes: [
          'risk_level',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: timeFilter,
        group: ['risk_level'],
        raw: true
      });

      // 按资源类型统计
      const resourceTypeStats = await AuditLog.findAll({
        attributes: [
          'resource_type',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: timeFilter,
        group: ['resource_type'],
        raw: true
      });

      // 按操作类型统计
      const operationTypeStats = await AuditLog.findAll({
        attributes: [
          'operation_type',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: timeFilter,
        group: ['operation_type'],
        raw: true
      });

      // 总数统计
      const totalCount = await AuditLog.count({ where: timeFilter });

      // 用户操作排行
      const topUsers = await AuditLog.findAll({
        attributes: [
          'username',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: {
          ...timeFilter,
          username: { [require('sequelize').Op.ne]: null }
        },
        group: ['username'],
        order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
        limit: 10,
        raw: true
      });

      // 高风险操作统计
      const highRiskCount = await AuditLog.count({
        where: {
          ...timeFilter,
          risk_level: 'High'
        }
      });

      // 失败操作统计
      const failedCount = await AuditLog.count({
        where: {
          ...timeFilter,
          status: 'Failed'
        }
      });

      res.json({
        statistics: {
          total: totalCount,
          highRisk: highRiskCount,
          failed: failedCount,
          statusDistribution: statusStats,
          riskLevelDistribution: riskLevelStats,
          resourceTypeDistribution: resourceTypeStats,
          operationTypeDistribution: operationTypeStats,
          topUsers
        }
      });
    } catch (error) {
      logger.error('获取审计统计信息失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/audit/export:
 *   get:
 *     summary: 导出审计日志
 *     tags: [审计管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel]
 *           default: excel
 *         description: 导出格式
 *     responses:
 *       200:
 *         description: 导出成功
 *       400:
 *         description: 参数错误
 */
router.get('/export',
  authorize('admin', 'auditor'),
  createAuditMiddleware('导出审计日志', 'AuditLog', 'Read', 'Medium'),
  async (req, res, next) => {
    try {
      const { startDate, endDate, format = 'excel', ...filters } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: true,
          message: '开始日期和结束日期是必填的'
        });
      }

      // 构建查询条件
      const where = {
        created_at: {
          [require('sequelize').Op.gte]: new Date(startDate),
          [require('sequelize').Op.lte]: new Date(endDate + ' 23:59:59')
        }
      };

      if (filters.action) where.action = { [require('sequelize').Op.like]: `%${filters.action}%` };
      if (filters.resourceType) where.resource_type = filters.resourceType;
      if (filters.status) where.status = filters.status;
      if (filters.riskLevel) where.risk_level = filters.riskLevel;

      const logs = await AuditLog.findAll({
        where,
        order: [['created_at', 'DESC']],
        include: [
          {
            association: 'user',
            attributes: ['username', 'real_name'],
            required: false
          }
        ]
      });

      // 如果请求CSV格式
      if (format === 'csv') {
        const csvData = logs.map(log => ({
          '时间': log.created_at,
          '用户': log.username || '',
          '操作': log.action,
          '资源类型': log.resource_type,
          '操作类型': log.operation_type,
          '状态': log.status,
          '风险级别': log.risk_level,
          'IP地址': log.ip_address || '',
          '描述': log.description || ''
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${startDate}_${endDate}.csv"`);
        
        // 简单的CSV生成（实际项目中建议使用专门的CSV库）
        const headers = Object.keys(csvData[0] || {});
        let csv = headers.join(',') + '\n';
        csvData.forEach(row => {
          csv += headers.map(header => `"${row[header] || ''}"`).join(',') + '\n';
        });
        
        res.send(csv);
      } else {
        // Excel格式（需要实现Excel生成逻辑）
        // 这里返回JSON数据，实际项目中应该生成Excel文件
        res.json({
          message: 'Excel导出功能待实现',
          data: logs.map(log => ({
            时间: log.created_at,
            用户: log.username || '',
            操作: log.action,
            资源类型: log.resource_type,
            操作类型: log.operation_type,
            状态: log.status,
            风险级别: log.risk_level,
            IP地址: log.ip_address || '',
            描述: log.description || ''
          }))
        });
      }
    } catch (error) {
      logger.error('导出审计日志失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/audit/risk-alerts:
 *   get:
 *     summary: 获取高风险操作告警
 *     tags: [审计管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: 返回数量
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/risk-alerts',
  authorize('admin', 'auditor'),
  createAuditMiddleware('查看风险告警', 'AuditLog', 'Read'),
  async (req, res, next) => {
    try {
      const { limit = 20 } = req.query;

      // 获取最近的高风险操作
      const highRiskLogs = await AuditLog.findAll({
        where: {
          risk_level: ['High', 'Critical'],
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
          }
        },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        include: [
          {
            association: 'user',
            attributes: ['username', 'real_name']
          }
        ]
      });

      // 获取失败操作
      const failedLogs = await AuditLog.findAll({
        where: {
          status: 'Failed',
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
          }
        },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        include: [
          {
            association: 'user',
            attributes: ['username', 'real_name']
          }
        ]
      });

      res.json({
        highRiskOperations: highRiskLogs,
        failedOperations: failedLogs,
        summary: {
          highRiskCount: highRiskLogs.length,
          failedCount: failedLogs.length,
          alertTime: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('获取风险告警失败', { error: error.message });
      next(error);
    }
  }
);

module.exports = router;