const { RecoveryTask, RDSInstance, AuditLog, ComplianceReport } = require('../models');
const logger = require('../config/logger');
const { logAudit } = require('../utils/audit');

/**
 * 智能风险评估和预警系统
 * 提供实时风险监控、预测分析和智能预警能力
 */
class IntelligentRiskAssessmentService {
  constructor() {
    this.riskModels = new Map();
    this.alertRules = new Map();
    this.predictionEngine = new PredictionEngine();
    this.riskCalculator = new RiskCalculator();
    this.alertManager = new EnhancedAlertManager();
    this.complianceMonitor = new ComplianceMonitor();
    
    this.initializeRiskModels();
    this.initializeAlertRules();
  }

  /**
   * 初始化风险评估模型
   */
  initializeRiskModels() {
    // 合规风险模型
    this.riskModels.set('compliance_risk', {
      weight: 0.4,
      calculator: this.calculateComplianceRisk.bind(this),
      thresholds: { critical: 80, high: 60, medium: 40, low: 20 }
    });

    // 操作风险模型
    this.riskModels.set('operational_risk', {
      weight: 0.3,
      calculator: this.calculateOperationalRisk.bind(this),
      thresholds: { critical: 75, high: 55, medium: 35, low: 15 }
    });

    // 安全风险模型
    this.riskModels.set('security_risk', {
      weight: 0.2,
      calculator: this.calculateSecurityRisk.bind(this),
      thresholds: { critical: 85, high: 65, medium: 45, low: 25 }
    });

    // 技术风险模型
    this.riskModels.set('technical_risk', {
      weight: 0.1,
      calculator: this.calculateTechnicalRisk.bind(this),
      thresholds: { critical: 70, high: 50, medium: 30, low: 10 }
    });

    logger.info('风险评估模型初始化完成');
  }

  /**
   * 初始化告警规则
   */
  initializeAlertRules() {
    // 合规告警规则
    this.alertRules.set('compliance_violation', {
      condition: (riskData) => riskData.complianceRisk > 60,
      severity: 'high',
      action: 'immediate_notification',
      message: '检测到合规违规风险'
    });

    // 连续失败告警
    this.alertRules.set('consecutive_failures', {
      condition: (riskData) => riskData.consecutiveFailures >= 3,
      severity: 'critical',
      action: 'escalate_to_admin',
      message: '连续任务失败，需要立即处理'
    });

    // 异常行为告警
    this.alertRules.set('abnormal_behavior', {
      condition: (riskData) => riskData.behaviorAnomalyScore > 70,
      severity: 'medium',
      action: 'security_review',
      message: '检测到异常用户行为'
    });

    // 系统健康告警
    this.alertRules.set('system_health', {
      condition: (riskData) => riskData.systemHealthScore < 60,
      severity: 'high',
      action: 'system_check',
      message: '系统健康状况不佳'
    });

    logger.info('告警规则初始化完成');
  }

  /**
   * 执行综合风险评估
   */
  async performComprehensiveRiskAssessment() {
    try {
      logger.info('开始执行综合风险评估...');

      // 1. 收集基础数据
      const baseData = await this.collectBaseData();

      // 2. 计算各维度风险评分
      const riskScores = await this.calculateAllRiskDimensions(baseData);

      // 3. 计算综合风险评分
      const overallRisk = this.calculateOverallRisk(riskScores);

      // 4. 生成风险评估报告
      const riskReport = await this.generateRiskReport(riskScores, overallRisk, baseData);

      // 5. 执行预测分析
      const predictions = await this.predictionEngine.generatePredictions(baseData, riskScores);

      // 6. 检查告警条件
      await this.checkAlertConditions(riskReport, predictions);

      // 7. 更新风险趋势数据
      await this.updateRiskTrends(riskReport);

      logger.info('综合风险评估完成', {
        overallRisk: overallRisk.score,
        riskLevel: overallRisk.level
      });

      return {
        riskReport,
        predictions,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('综合风险评估失败:', error);
      throw error;
    }
  }

  /**
   * 收集基础数据
   */
  async collectBaseData() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // RDS实例数据
      const rdsInstances = await RDSInstance.findAll({
        include: [{
          model: RecoveryTask,
          as: 'recoveryTasks',
          where: {
            created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
          },
          required: false
        }]
      });

      // 恢复任务数据
      const recoveryTasks = await RecoveryTask.findAll({
        where: {
          created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
        },
        include: [{ model: RDSInstance, as: 'rdsInstance' }]
      });

      // 审计日志数据
      const auditLogs = await AuditLog.findAll({
        where: {
          created_at: { [require('sequelize').Op.gte]: sevenDaysAgo }
        },
        order: [['created_at', 'DESC']]
      });

      // 合规报告数据
      const complianceReports = await ComplianceReport.findAll({
        where: {
          created_at: { [require('sequelize').Op.gte]: thirtyDaysAgo }
        }
      });

      // 统计数据
      const stats = {
        totalInstances: rdsInstances.length,
        totalTasks: recoveryTasks.length,
        successfulTasks: recoveryTasks.filter(task => task.status === 'Success').length,
        failedTasks: recoveryTasks.filter(task => task.status === 'Failed').length,
        runningTasks: recoveryTasks.filter(task => task.status === 'Running').length,
        totalAuditLogs: auditLogs.length,
        failedAudits: auditLogs.filter(log => log.status === 'Failed').length,
        highRiskAudits: auditLogs.filter(log => ['High', 'Critical'].includes(log.risk_level)).length
      };

      return {
        rdsInstances,
        recoveryTasks,
        auditLogs,
        complianceReports,
        stats,
        timeRanges: {
          thirtyDaysAgo,
          sevenDaysAgo,
          now
        }
      };

    } catch (error) {
      logger.error('收集基础数据失败:', error);
      throw error;
    }
  }

  /**
   * 计算所有风险维度
   */
  async calculateAllRiskDimensions(baseData) {
    const riskScores = {};

    for (const [riskType, model] of this.riskModels) {
      try {
        riskScores[riskType] = await model.calculator(baseData);
        logger.debug(`${riskType} 风险评分: ${riskScores[riskType].score}`);
      } catch (error) {
        logger.error(`计算 ${riskType} 风险失败:`, error);
        riskScores[riskType] = { score: 50, level: 'Medium', factors: [] };
      }
    }

    return riskScores;
  }

  /**
   * 计算合规风险
   */
  async calculateComplianceRisk(baseData) {
    const { rdsInstances, stats, timeRanges } = baseData;
    let riskScore = 0;
    const riskFactors = [];

    // 1. 年度恢复验证合规性检查
    const currentYear = new Date().getFullYear();
    let unverifiedInstances = 0;

    for (const instance of rdsInstances) {
      const annualTasks = instance.recoveryTasks?.filter(task => 
        task.is_annual_task && 
        task.compliance_year === currentYear &&
        task.status === 'Success'
      ) || [];

      if (annualTasks.length === 0) {
        unverifiedInstances++;
      }
    }

    const unverifiedRatio = stats.totalInstances > 0 ? unverifiedInstances / stats.totalInstances : 0;
    const complianceRisk = unverifiedRatio * 60; // 最高60分
    riskScore += complianceRisk;

    if (unverifiedRatio > 0.5) {
      riskFactors.push(`超过50%的实例未完成年度恢复验证 (${Math.round(unverifiedRatio * 100)}%)`);
    }

    // 2. 任务失败率风险
    const taskFailureRate = stats.totalTasks > 0 ? stats.failedTasks / stats.totalTasks : 0;
    if (taskFailureRate > 0.2) {
      riskScore += taskFailureRate * 30;
      riskFactors.push(`任务失败率过高: ${Math.round(taskFailureRate * 100)}%`);
    }

    // 3. 审计合规风险
    const auditComplianceIssues = baseData.auditLogs.filter(log => 
      log.compliance_status === 'VIOLATION'
    ).length;

    if (auditComplianceIssues > 0) {
      riskScore += Math.min(auditComplianceIssues * 5, 20);
      riskFactors.push(`发现 ${auditComplianceIssues} 个合规违规问题`);
    }

    return {
      score: Math.min(100, Math.round(riskScore)),
      level: this.getRiskLevel(riskScore, this.riskModels.get('compliance_risk').thresholds),
      factors: riskFactors,
      details: {
        unverifiedInstances,
        unverifiedRatio,
        taskFailureRate,
        auditComplianceIssues
      }
    };
  }

  /**
   * 计算操作风险
   */
  async calculateOperationalRisk(baseData) {
    const { stats, recoveryTasks, auditLogs } = baseData;
    let riskScore = 0;
    const riskFactors = [];

    // 1. 任务执行效率风险
    const avgTaskDuration = this.calculateAverageTaskDuration(recoveryTasks);
    if (avgTaskDuration > 7200) { // 超过2小时
      riskScore += 20;
      riskFactors.push(`平均任务执行时间过长: ${Math.round(avgTaskDuration / 60)}分钟`);
    }

    // 2. 系统负载风险
    const runningTasksRatio = stats.totalInstances > 0 ? stats.runningTasks / stats.totalInstances : 0;
    if (runningTasksRatio > 0.3) {
      riskScore += 15;
      riskFactors.push(`同时运行任务过多: ${Math.round(runningTasksRatio * 100)}%`);
    }

    // 3. 操作频率风险
    const operationFrequency = this.calculateOperationFrequency(auditLogs);
    if (operationFrequency.isHigh) {
      riskScore += 10;
      riskFactors.push('操作频率异常升高');
    }

    // 4. 错误率风险
    const errorRate = stats.totalAuditLogs > 0 ? stats.failedAudits / stats.totalAuditLogs : 0;
    if (errorRate > 0.1) {
      riskScore += 15;
      riskFactors.push(`操作错误率过高: ${Math.round(errorRate * 100)}%`);
    }

    return {
      score: Math.min(100, Math.round(riskScore)),
      level: this.getRiskLevel(riskScore, this.riskModels.get('operational_risk').thresholds),
      factors: riskFactors,
      details: {
        avgTaskDuration,
        runningTasksRatio,
        operationFrequency,
        errorRate
      }
    };
  }

  /**
   * 计算安全风险
   */
  async calculateSecurityRisk(baseData) {
    const { auditLogs, stats } = baseData;
    let riskScore = 0;
    const riskFactors = [];

    // 1. 高风险操作比例
    const highRiskRatio = stats.totalAuditLogs > 0 ? stats.highRiskAudits / stats.totalAuditLogs : 0;
    if (highRiskRatio > 0.1) {
      riskScore += 25;
      riskFactors.push(`高风险操作比例过高: ${Math.round(highRiskRatio * 100)}%`);
    }

    // 2. 异常行为检测
    const anomalousLogs = auditLogs.filter(log => log.is_anomaly).length;
    if (anomalousLogs > 0) {
      riskScore += Math.min(anomalousLogs * 3, 20);
      riskFactors.push(`检测到 ${anomalousLogs} 个异常行为`);
    }

    // 3. 权限使用模式分析
    const privilegeAbuse = this.detectPrivilegeAbuse(auditLogs);
    if (privilegeAbuse.detected) {
      riskScore += 15;
      riskFactors.push('检测到权限滥用迹象');
    }

    // 4. 非工作时间操作
    const afterHoursOps = this.countAfterHoursOperations(auditLogs);
    if (afterHoursOps.ratio > 0.2) {
      riskScore += 10;
      riskFactors.push(`非工作时间操作过多: ${Math.round(afterHoursOps.ratio * 100)}%`);
    }

    return {
      score: Math.min(100, Math.round(riskScore)),
      level: this.getRiskLevel(riskScore, this.riskModels.get('security_risk').thresholds),
      factors: riskFactors,
      details: {
        highRiskRatio,
        anomalousLogs,
        privilegeAbuse,
        afterHoursOps
      }
    };
  }

  /**
   * 计算技术风险
   */
  async calculateTechnicalRisk(baseData) {
    const { rdsInstances, recoveryTasks } = baseData;
    let riskScore = 0;
    const riskFactors = [];

    // 1. 实例版本风险
    const versionRisk = this.assessVersionRisk(rdsInstances);
    if (versionRisk.score > 0) {
      riskScore += versionRisk.score;
      riskFactors.push(...versionRisk.factors);
    }

    // 2. 技术债务风险
    const technicalDebt = this.assessTechnicalDebt(recoveryTasks);
    if (technicalDebt.score > 0) {
      riskScore += technicalDebt.score;
      riskFactors.push(...technicalDebt.factors);
    }

    // 3. 性能风险
    const performanceRisk = this.assessPerformanceRisk(recoveryTasks);
    if (performanceRisk.score > 0) {
      riskScore += performanceRisk.score;
      riskFactors.push(...performanceRisk.factors);
    }

    return {
      score: Math.min(100, Math.round(riskScore)),
      level: this.getRiskLevel(riskScore, this.riskModels.get('technical_risk').thresholds),
      factors: riskFactors,
      details: {
        versionRisk,
        technicalDebt,
        performanceRisk
      }
    };
  }

  /**
   * 计算综合风险评分
   */
  calculateOverallRisk(riskScores) {
    let weightedScore = 0;

    for (const [riskType, model] of this.riskModels) {
      const riskData = riskScores[riskType];
      weightedScore += riskData.score * model.weight;
    }

    const overallScore = Math.round(weightedScore);
    const overallLevel = this.getOverallRiskLevel(overallScore);

    return {
      score: overallScore,
      level: overallLevel,
      breakdown: riskScores
    };
  }

  /**
   * 生成风险评估报告
   */
  async generateRiskReport(riskScores, overallRisk, baseData) {
    const report = {
      id: `risk_${Date.now()}`,
      timestamp: new Date(),
      overallRisk,
      riskBreakdown: riskScores,
      summary: {
        totalInstances: baseData.stats.totalInstances,
        healthyInstances: this.countHealthyInstances(baseData.rdsInstances),
        criticalIssues: this.identifyCriticalIssues(riskScores),
        recommendations: this.generateRecommendations(riskScores, overallRisk)
      },
      trends: await this.calculateRiskTrends(),
      predictions: await this.predictionEngine.generateShortTermPredictions(baseData)
    };

    // 记录风险评估
    await logAudit({
      action: '执行风险评估',
      resourceType: 'System',
      operationType: 'Read',
      status: 'Success',
      description: `综合风险评分: ${overallRisk.score}，风险等级: ${overallRisk.level}`,
      riskLevel: 'Low'
    });

    return report;
  }

  /**
   * 检查告警条件
   */
  async checkAlertConditions(riskReport, predictions) {
    const triggeredAlerts = [];

    for (const [ruleName, rule] of this.alertRules) {
      try {
        if (rule.condition(riskReport)) {
          const alert = await this.alertManager.createAlert({
            rule: ruleName,
            severity: rule.severity,
            message: rule.message,
            data: riskReport,
            predictions
          });

          triggeredAlerts.push(alert);

          // 执行告警动作
          await this.executeAlertAction(rule.action, alert);
        }
      } catch (error) {
        logger.error(`检查告警规则 ${ruleName} 失败:`, error);
      }
    }

    if (triggeredAlerts.length > 0) {
      logger.warn(`触发 ${triggeredAlerts.length} 个告警`, {
        alerts: triggeredAlerts.map(alert => ({
          rule: alert.rule,
          severity: alert.severity
        }))
      });
    }

    return triggeredAlerts;
  }

  /**
   * 获取风险等级
   */
  getRiskLevel(score, thresholds) {
    if (score >= thresholds.critical) return 'Critical';
    if (score >= thresholds.high) return 'High';
    if (score >= thresholds.medium) return 'Medium';
    return 'Low';
  }

  /**
   * 获取综合风险等级
   */
  getOverallRiskLevel(score) {
    if (score >= 75) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    if (score >= 20) return 'Low';
    return 'Minimal';
  }

  // 辅助方法
  calculateAverageTaskDuration(tasks) {
    const completedTasks = tasks.filter(task => task.duration_seconds);
    if (completedTasks.length === 0) return 0;
    
    return completedTasks.reduce((sum, task) => sum + task.duration_seconds, 0) / completedTasks.length;
  }

  calculateOperationFrequency(auditLogs) {
    const hourlyOps = new Array(24).fill(0);
    auditLogs.forEach(log => {
      const hour = new Date(log.created_at).getHours();
      hourlyOps[hour]++;
    });

    const avgOpsPerHour = auditLogs.length / 24;
    const peakOps = Math.max(...hourlyOps);
    
    return {
      isHigh: peakOps > avgOpsPerHour * 3,
      peak: peakOps,
      average: avgOpsPerHour
    };
  }

  detectPrivilegeAbuse(auditLogs) {
    // 简化的权限滥用检测逻辑
    const privilegeOps = auditLogs.filter(log => 
      ['Delete', 'Execute'].includes(log.operation_type)
    );
    
    return {
      detected: privilegeOps.length > auditLogs.length * 0.3,
      count: privilegeOps.length,
      ratio: privilegeOps.length / auditLogs.length
    };
  }

  countAfterHoursOperations(auditLogs) {
    const afterHours = auditLogs.filter(log => {
      const hour = new Date(log.created_at).getHours();
      return hour < 8 || hour > 18;
    });

    return {
      count: afterHours.length,
      ratio: afterHours.length / auditLogs.length
    };
  }

  assessVersionRisk(instances) {
    // 简化的版本风险评估
    return { score: 0, factors: [] };
  }

  assessTechnicalDebt(tasks) {
    // 简化的技术债务评估
    return { score: 0, factors: [] };
  }

  assessPerformanceRisk(tasks) {
    // 简化的性能风险评估
    return { score: 0, factors: [] };
  }

  countHealthyInstances(instances) {
    return instances.filter(instance => 
      instance.status === 'Running' && instance.is_monitored
    ).length;
  }

  identifyCriticalIssues(riskScores) {
    const criticalIssues = [];
    
    for (const [riskType, riskData] of Object.entries(riskScores)) {
      if (riskData.level === 'Critical') {
        criticalIssues.push({
          type: riskType,
          score: riskData.score,
          factors: riskData.factors
        });
      }
    }

    return criticalIssues;
  }

  generateRecommendations(riskScores, overallRisk) {
    const recommendations = [];

    if (overallRisk.score > 70) {
      recommendations.push('立即采取措施降低整体风险等级');
    }

    for (const [riskType, riskData] of Object.entries(riskScores)) {
      if (riskData.score > 60) {
        switch (riskType) {
          case 'compliance_risk':
            recommendations.push('加强合规性管理，完成年度恢复验证');
            break;
          case 'operational_risk':
            recommendations.push('优化操作流程，提高任务执行效率');
            break;
          case 'security_risk':
            recommendations.push('加强安全监控，审查用户权限');
            break;
          case 'technical_risk':
            recommendations.push('升级技术组件，解决技术债务');
            break;
        }
      }
    }

    return recommendations;
  }

  async calculateRiskTrends() {
    // 简化的趋势计算
    return {
      trend: 'stable',
      change: 0
    };
  }

  async updateRiskTrends(riskReport) {
    // 更新风险趋势数据
    logger.debug('更新风险趋势数据');
  }

  async executeAlertAction(action, alert) {
    switch (action) {
      case 'immediate_notification':
        await this.alertManager.sendImmediateNotification(alert);
        break;
      case 'escalate_to_admin':
        await this.alertManager.escalateToAdmin(alert);
        break;
      case 'security_review':
        await this.alertManager.triggerSecurityReview(alert);
        break;
      case 'system_check':
        await this.alertManager.triggerSystemCheck(alert);
        break;
    }
  }
}

/**
 * 预测引擎
 */
class PredictionEngine {
  async generatePredictions(baseData, riskScores) {
    // 简化的预测逻辑
    return {
      nextWeekRisk: 'Medium',
      nextMonthRisk: 'Medium',
      recommendations: []
    };
  }

  async generateShortTermPredictions(baseData) {
    return {
      next24Hours: 'Low',
      next7Days: 'Medium'
    };
  }
}

/**
 * 风险计算器
 */
class RiskCalculator {
  calculateRisk(factors, weights) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(weights)) {
      if (factors[factor] !== undefined) {
        totalScore += factors[factor] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}

/**
 * 增强告警管理器
 */
class EnhancedAlertManager {
  async createAlert(alertData) {
    const alert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date(),
      ...alertData
    };

    logger.warn('创建告警', alert);
    return alert;
  }

  async sendImmediateNotification(alert) {
    logger.warn('发送即时通知', { alertId: alert.id });
  }

  async escalateToAdmin(alert) {
    logger.warn('升级至管理员', { alertId: alert.id });
  }

  async triggerSecurityReview(alert) {
    logger.warn('触发安全审查', { alertId: alert.id });
  }

  async triggerSystemCheck(alert) {
    logger.warn('触发系统检查', { alertId: alert.id });
  }
}

/**
 * 合规监控器
 */
class ComplianceMonitor {
  async checkComplianceStatus() {
    // 合规状态检查逻辑
    return {
      status: 'compliant',
      issues: []
    };
  }
}

module.exports = new IntelligentRiskAssessmentService();