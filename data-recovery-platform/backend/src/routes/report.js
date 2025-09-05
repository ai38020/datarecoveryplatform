const express = require('express');
const path = require('path');
const { ComplianceReport } = require('../models');
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate, commonSchemas } = require('../utils/validation');
const { createAuditMiddleware } = require('../utils/audit');
const reportService = require('../services/reportService');
const logger = require('../config/logger');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * @swagger
 * /api/report/compliance:
 *   get:
 *     summary: 获取合规报告列表
 *     tags: [报告管理]
 */
router.get('/compliance',
  validate(commonSchemas.pagination, 'query'),
  createAuditMiddleware('查看合规报告列表', 'Report', 'Read'),
  async (req, res, next) => {
    try {
      const { page, limit, ...filters } = req.query;
      const offset = (page - 1) * limit;

      const { rows: reports, count: total } = await ComplianceReport.findAndCountAll({
        where: filters,
        offset,
        limit,
        order: [['created_at', 'DESC']],
        include: [
          {
            association: 'generator',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      res.json({
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('获取合规报告列表失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/report/compliance:
 *   post:
 *     summary: 生成合规报告
 *     tags: [报告管理]
 */
router.post('/compliance',
  authorize('admin', 'auditor'),
  createAuditMiddleware('生成合规报告', 'Report', 'Create', 'Medium'),
  async (req, res, next) => {
    try {
      const {
        reportName,
        reportType,
        complianceYear,
        periodStart,
        periodEnd,
        includeDetails
      } = req.body;

      if (!reportName || !reportType || !complianceYear || !periodStart || !periodEnd) {
        return res.status(400).json({
          error: true,
          message: '报告名称、类型、年度和时间周期是必填的'
        });
      }

      const report = await reportService.generateComplianceReport({
        reportName,
        reportType,
        complianceYear,
        periodStart,
        periodEnd,
        includeDetails
      }, req.user);

      res.status(201).json({
        message: '合规报告生成任务已启动',
        report
      });
    } catch (error) {
      logger.error('生成合规报告失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/report/compliance/{id}:
 *   get:
 *     summary: 获取合规报告详情
 *     tags: [报告管理]
 */
router.get('/compliance/:id',
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('查看合规报告详情', 'Report', 'Read'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const report = await ComplianceReport.findByPk(id, {
        include: [
          {
            association: 'generator',
            attributes: ['id', 'username', 'real_name']
          },
          {
            association: 'approver',
            attributes: ['id', 'username', 'real_name']
          }
        ]
      });

      if (!report) {
        return res.status(404).json({
          error: true,
          message: '合规报告不存在'
        });
      }

      res.json({ report });
    } catch (error) {
      logger.error('获取合规报告详情失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/report/compliance/{id}/download:
 *   get:
 *     summary: 下载合规报告
 *     tags: [报告管理]
 */
router.get('/compliance/:id/download',
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('下载合规报告', 'Report', 'Read', 'Medium'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const report = await ComplianceReport.findByPk(id);
      if (!report) {
        return res.status(404).json({
          error: true,
          message: '合规报告不存在'
        });
      }

      if (report.status !== 'Completed') {
        return res.status(400).json({
          error: true,
          message: '报告尚未生成完成'
        });
      }

      if (!report.file_path) {
        return res.status(404).json({
          error: true,
          message: '报告文件不存在'
        });
      }

      // 检查文件是否存在
      const fs = require('fs');
      if (!fs.existsSync(report.file_path)) {
        return res.status(404).json({
          error: true,
          message: '报告文件已被删除'
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${report.file_name}"`);
      res.sendFile(path.resolve(report.file_path));
    } catch (error) {
      logger.error('下载合规报告失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/report/compliance/{id}/approve:
 *   post:
 *     summary: 审批合规报告
 *     tags: [报告管理]
 */
router.post('/compliance/:id/approve',
  authorize('admin'),
  validate(commonSchemas.uuid, 'params'),
  createAuditMiddleware('审批合规报告', 'Report', 'Update', 'Medium'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const report = await ComplianceReport.findByPk(id);
      if (!report) {
        return res.status(404).json({
          error: true,
          message: '合规报告不存在'
        });
      }

      if (report.status !== 'Completed') {
        return res.status(400).json({
          error: true,
          message: '只能审批已完成的报告'
        });
      }

      await report.update({
        approved_by: req.user.id,
        approved_at: new Date(),
        is_final: true
      });

      res.json({
        message: '合规报告审批成功',
        report
      });
    } catch (error) {
      logger.error('审批合规报告失败', { error: error.message });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/report/statistics:
 *   get:
 *     summary: 获取报告统计信息
 *     tags: [报告管理]
 */
router.get('/statistics',
  createAuditMiddleware('查看报告统计', 'Report', 'Read'),
  async (req, res, next) => {
    try {
      const { year } = req.query;
      
      const where = {};
      if (year) {
        where.compliance_year = year;
      }

      // 按状态统计
      const statusStats = await ComplianceReport.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where,
        group: ['status'],
        raw: true
      });

      // 按类型统计
      const typeStats = await ComplianceReport.findAll({
        attributes: [
          'report_type',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where,
        group: ['report_type'],
        raw: true
      });

      // 总数统计
      const total = await ComplianceReport.count({ where });

      res.json({
        statistics: {
          total,
          statusDistribution: statusStats,
          typeDistribution: typeStats
        }
      });
    } catch (error) {
      logger.error('获取报告统计信息失败', { error: error.message });
      next(error);
    }
  }
);

module.exports = router;