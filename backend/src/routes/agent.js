const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { createAuditMiddleware } = require('../utils/audit');
const intelligentAgentService = require('../services/intelligentAgentService');
const intelligentAuditService = require('../services/intelligentAuditService');
const intelligentRiskService = require('../services/intelligentRiskService');
const intelligentDecisionService = require('../services/intelligentDecisionService');
const intelligentReportService = require('../services/intelligentReportService');
const logger = require('../config/logger');

const router = express.Router();
router.use(authenticateToken);

/**
 * @swagger
 * /api/agent/status:
 *   get:
 *     summary: 获取智能代理状态
 *     tags: [智能代理]
 */
router.get('/status',
  createAuditMiddleware('查看智能代理状态', 'System', 'Read'),
  async (req, res, next) => {
    try {
      const agentStatus = intelligentAgentService.getAgentStatus();
      res.json({ status: agentStatus });
    } catch (error) {
      logger.error('获取智能代理状态失败:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/agent/risk-assessment:
 *   post:
 *     summary: 执行综合风险评估
 *     tags: [智能代理]
 */
router.post('/risk-assessment',
  authorize('admin', 'auditor'),
  createAuditMiddleware('执行智能风险评估', 'System', 'Execute', 'Medium'),
  async (req, res, next) => {
    try {
      const assessment = await intelligentRiskService.performComprehensiveRiskAssessment();
      res.json({ assessment });
    } catch (error) {
      logger.error('智能风险评估失败:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/agent/decision:
 *   post:
 *     summary: 处理智能决策请求
 *     tags: [智能代理]
 */
router.post('/decision',
  authorize('admin', 'operator'),
  createAuditMiddleware('智能决策处理', 'System', 'Execute', 'High'),
  async (req, res, next) => {
    try {
      const decisionRequest = {
        ...req.body,
        user: req.user
      };
      
      const result = await intelligentDecisionService.processDecisionRequest(decisionRequest);
      res.json({ result });
    } catch (error) {
      logger.error('智能决策处理失败:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/agent/report-analysis/{reportId}:
 *   post:
 *     summary: 智能分析报表
 *     tags: [智能代理]
 */
router.post('/report-analysis/:reportId',
  createAuditMiddleware('智能报表分析', 'Report', 'Read'),
  async (req, res, next) => {
    try {
      const { reportId } = req.params;
      const analysis = await intelligentReportService.analyzeReport(reportId);
      res.json({ analysis });
    } catch (error) {
      logger.error('智能报表分析失败:', error);
      next(error);
    }
  }
);

module.exports = router;