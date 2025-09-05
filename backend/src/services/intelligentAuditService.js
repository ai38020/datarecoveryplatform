const { AuditLog, RecoveryTask, RDSInstance, User } = require('../models');
const { logAudit } = require('../utils/audit');
const logger = require('../config/logger');

/**
 * 智能审计留痕服务
 * 提供自动化和智能化的审计追踪能力
 */
class IntelligentAuditService {
  constructor() {
    this.behaviorPatterns = new Map();
    this.riskScorer = new RiskScorer();
    this.anomalyDetector = new AnomalyDetector();
    this.complianceChecker = new ComplianceChecker();
    this.alertManager = new AlertManager();
  }

  /**
   * 智能审计日志记录
   * 自动分析操作上下文，智能评估风险等级
   */
  async intelligentAuditLog(auditData) {
    try {
      // 1. 基础审计信息
      const baseAudit = {
        ...auditData,
        created_at: new Date()
      };

      // 2. 智能风险评估
      const riskAssessment = await this.riskScorer.assessOperationRisk(auditData);
      baseAudit.risk_level = riskAssessment.level;
      baseAudit.risk_score = riskAssessment.score;
      baseAudit.risk_factors = riskAssessment.factors;

      // 3. 行为模式分析
      const behaviorAnalysis = await this.analyzeBehaviorPattern(auditData);
      baseAudit.behavior_score = behaviorAnalysis.score;
      baseAudit.is_anomaly = behaviorAnalysis.isAnomaly;

      // 4. 合规性检查
      const complianceResult = await this.complianceChecker.checkCompliance(auditData);
      baseAudit.compliance_status = complianceResult.status;
      baseAudit.compliance_notes = complianceResult.notes;

      // 5. 上下文信息增强
      const contextInfo = await this.enrichContextInformation(auditData);
      baseAudit.context_info = contextInfo;

      // 6. 保存审计日志
      const auditLog = await AuditLog.create(baseAudit);

      // 7. 触发实时分析和告警
      await this.performRealTimeAnalysis(auditLog);

      // 8. 更新用户行为画像
      if (auditData.userId) {
        await this.updateUserBehaviorProfile(auditData.userId, auditLog);
      }

      logger.info('智能审计日志记录完成', {
        auditId: auditLog.id,
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score
      });

      return auditLog;

    } catch (error) {
      logger.error('智能审计日志记录失败:', error);
      throw error;
    }
  }

  /**
   * 分析用户行为模式
   */
  async analyzeBehaviorPattern(auditData) {
    try {
      const { userId, action, operationType, ipAddress } = auditData;

      if (!userId) {
        return { score: 50, isAnomaly: false, reason: '无用户信息' };
      }

      // 获取用户历史行为数据
      const userHistory = await AuditLog.findAll({
        where: {
          user_id: userId,
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 最近30天
          }
        },
        order: [['created_at', 'DESC']],
        limit: 100
      });

      // 初始化分析结果
      let behaviorScore = 100;
      let anomalyFlags = [];

      // 1. 操作频率分析
      const operationFrequency = this.analyzeOperationFrequency(userHistory, action);
      if (operationFrequency.isUnusual) {
        behaviorScore -= 20;
        anomalyFlags.push('操作频率异常');
      }

      // 2. 时间模式分析
      const timePattern = this.analyzeTimePattern(userHistory);
      if (timePattern.isUnusual) {
        behaviorScore -= 15;
        anomalyFlags.push('操作时间异常');
      }

      // 3. IP地址分析
      const ipPattern = this.analyzeIPPattern(userHistory, ipAddress);
      if (ipPattern.isUnusual) {
        behaviorScore -= 25;
        anomalyFlags.push('IP地址异常');
      }

      // 4. 操作序列分析
      const sequencePattern = this.analyzeOperationSequence(userHistory, action);
      if (sequencePattern.isUnusual) {
        behaviorScore -= 20;
        anomalyFlags.push('操作序列异常');
      }

      // 5. 权限使用模式分析
      const privilegePattern = this.analyzePrivilegeUsage(userHistory, operationType);
      if (privilegePattern.isUnusual) {
        behaviorScore -= 20;
        anomalyFlags.push('权限使用异常');
      }

      const isAnomaly = behaviorScore < 70 || anomalyFlags.length >= 2;

      return {
        score: Math.max(0, behaviorScore),
        isAnomaly,
        anomalyFlags,
        patterns: {
          operationFrequency,
          timePattern,
          ipPattern,
          sequencePattern,
          privilegePattern
        }
      };

    } catch (error) {
      logger.error('行为模式分析失败:', error);
      return { score: 50, isAnomaly: false, reason: '分析失败' };
    }
  }

  /**
   * 分析操作频率
   */
  analyzeOperationFrequency(history, currentAction) {
    const recentOperations = history.filter(log => log.action === currentAction);
    const hoursAgo = 1;
    const recentCount = recentOperations.filter(log => 
      (Date.now() - new Date(log.created_at).getTime()) < hoursAgo * 60 * 60 * 1000
    ).length;

    // 定义正常频率阈值
    const normalThresholds = {
      '用户登录': 3,
      '查看RDS实例列表': 10,
      '创建恢复任务': 2,
      '执行恢复任务': 1,
      '删除实例': 1,
      '生成合规报告': 2
    };

    const threshold = normalThresholds[currentAction] || 5;
    const isUnusual = recentCount > threshold;

    return {
      isUnusual,
      recentCount,
      threshold,
      reason: isUnusual ? `${hoursAgo}小时内操作${recentCount}次，超过正常阈值${threshold}` : '操作频率正常'
    };
  }

  /**
   * 分析时间模式
   */
  analyzeTimePattern(history) {
    const currentHour = new Date().getHours();
    
    // 统计用户历史操作的时间分布
    const hourDistribution = new Array(24).fill(0);
    history.forEach(log => {
      const hour = new Date(log.created_at).getHours();
      hourDistribution[hour]++;
    });

    // 判断当前时间是否为用户常用时间
    const currentHourCount = hourDistribution[currentHour];
    const totalOperations = history.length;
    const averageHourCount = totalOperations / 24;

    // 如果当前时间段的操作量远低于平均值，且是非工作时间，则标记为异常
    const isNightTime = currentHour < 6 || currentHour > 22;
    const isLowActivity = currentHourCount < averageHourCount * 0.3;
    const isUnusual = isNightTime && isLowActivity && totalOperations > 10;

    return {
      isUnusual,
      currentHour,
      currentHourCount,
      averageHourCount,
      reason: isUnusual ? '非常规时间操作' : '时间模式正常'
    };
  }

  /**
   * 分析IP地址模式
   */
  analyzeIPPattern(history, currentIP) {
    if (!currentIP) {
      return { isUnusual: false, reason: '无IP信息' };
    }

    const ipCounts = new Map();
    history.forEach(log => {
      if (log.ip_address) {
        ipCounts.set(log.ip_address, (ipCounts.get(log.ip_address) || 0) + 1);
      }
    });

    // 判断当前IP是否为新IP或极少使用的IP
    const currentIPCount = ipCounts.get(currentIP) || 0;
    const totalIPs = ipCounts.size;
    const isNewIP = currentIPCount === 0;
    const isRareIP = currentIPCount < 3 && history.length > 20;

    const isUnusual = isNewIP || (isRareIP && totalIPs > 1);

    return {
      isUnusual,
      isNewIP,
      currentIPCount,
      totalIPs,
      reason: isNewIP ? '使用新的IP地址' : isRareIP ? 'IP地址使用频率极低' : 'IP地址模式正常'
    };
  }

  /**
   * 分析操作序列
   */
  analyzeOperationSequence(history, currentAction) {
    if (history.length < 5) {
      return { isUnusual: false, reason: '历史数据不足' };
    }

    // 获取最近5个操作
    const recentActions = history.slice(0, 5).map(log => log.action);
    
    // 检查是否存在可疑的操作序列
    const suspiciousPatterns = [
      ['用户登录', '查看RDS实例列表', '删除实例', '删除实例'], // 连续删除
      ['创建恢复任务', '取消恢复任务', '创建恢复任务', '取消恢复任务'], // 反复创建取消
      ['查看审计日志', '导出审计日志', '查看审计日志', '导出审计日志'] // 频繁查看导出日志
    ];

    const isUnusual = suspiciousPatterns.some(pattern => {
      return pattern.every((action, index) => recentActions[index] === action);
    });

    return {
      isUnusual,
      recentActions,
      reason: isUnusual ? '检测到可疑操作序列' : '操作序列正常'
    };
  }

  /**
   * 分析权限使用模式
   */
  analyzePrivilegeUsage(history, currentOperationType) {
    const privilegeOperations = history.filter(log => 
      ['Create', 'Update', 'Delete', 'Execute'].includes(log.operation_type)
    );

    // 分析权限操作的频率
    const privilegeCounts = {};
    privilegeOperations.forEach(log => {
      privilegeCounts[log.operation_type] = (privilegeCounts[log.operation_type] || 0) + 1;
    });

    // 检查当前操作是否为异常的权限提升
    const currentCount = privilegeCounts[currentOperationType] || 0;
    const isFirstTimePrivilegeUse = currentCount === 0 && privilegeOperations.length > 0;
    const isRarePrivilegeUse = currentCount < 2 && privilegeOperations.length > 10;

    const isUnusual = isFirstTimePrivilegeUse || 
                     (isRarePrivilegeUse && ['Delete', 'Execute'].includes(currentOperationType));

    return {
      isUnusual,
      isFirstTimePrivilegeUse,
      isRarePrivilegeUse,
      currentCount,
      privilegeCounts,
      reason: isUnusual ? '权限使用模式异常' : '权限使用正常'
    };
  }

  /**
   * 增强上下文信息
   */
  async enrichContextInformation(auditData) {
    const context = {};

    try {
      // 获取用户详细信息
      if (auditData.userId) {
        const user = await User.findByPk(auditData.userId, {
          attributes: ['id', 'username', 'role', 'last_login_at']
        });
        context.user = user;
      }

      // 获取相关资源信息
      if (auditData.resourceId && auditData.resourceType) {
        context.resource = await this.getResourceInfo(auditData.resourceType, auditData.resourceId);
      }

      // 获取系统状态信息
      context.systemStatus = await this.getSystemStatus();

      // 获取并发用户信息
      context.concurrentUsers = await this.getConcurrentUserCount();

      return context;
    } catch (error) {
      logger.error('上下文信息增强失败:', error);
      return {};
    }
  }

  /**
   * 实时分析和告警
   */
  async performRealTimeAnalysis(auditLog) {
    try {
      // 1. 检查是否需要实时告警
      if (auditLog.risk_level === 'Critical' || auditLog.risk_score > 80) {
        await this.alertManager.sendCriticalAlert(auditLog);
      }

      // 2. 检查异常行为
      if (auditLog.is_anomaly) {
        await this.alertManager.sendAnomalyAlert(auditLog);
      }

      // 3. 检查合规性问题
      if (auditLog.compliance_status === 'VIOLATION') {
        await this.alertManager.sendComplianceAlert(auditLog);
      }

      // 4. 更新实时统计
      await this.updateRealTimeMetrics(auditLog);

    } catch (error) {
      logger.error('实时分析执行失败:', error);
    }
  }

  /**
   * 更新用户行为画像
   */
  async updateUserBehaviorProfile(userId, auditLog) {
    try {
      const profileKey = `user_profile_${userId}`;
      
      // 这里可以实现用户行为画像的更新逻辑
      // 比如使用Redis存储用户行为特征
      
      logger.debug(`更新用户行为画像: ${userId}`);
    } catch (error) {
      logger.error('更新用户行为画像失败:', error);
    }
  }

  /**
   * 获取资源信息
   */
  async getResourceInfo(resourceType, resourceId) {
    try {
      const models = {
        'RDSInstance': RDSInstance,
        'RecoveryTask': RecoveryTask,
        'User': User
      };

      const Model = models[resourceType];
      if (Model) {
        return await Model.findByPk(resourceId);
      }
      return null;
    } catch (error) {
      logger.error(`获取资源信息失败 ${resourceType}:${resourceId}:`, error);
      return null;
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    try {
      return {
        timestamp: new Date(),
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * 获取并发用户数
   */
  async getConcurrentUserCount() {
    try {
      // 获取最近5分钟内活跃的用户数
      const activeUsers = await AuditLog.count({
        distinct: true,
        col: 'user_id',
        where: {
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 5 * 60 * 1000)
          },
          user_id: {
            [require('sequelize').Op.ne]: null
          }
        }
      });
      return activeUsers;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 更新实时指标
   */
  async updateRealTimeMetrics(auditLog) {
    // 实现实时指标更新逻辑
    // 可以使用Redis或内存存储实时统计数据
  }
}

/**
 * 风险评分器
 */
class RiskScorer {
  async assessOperationRisk(auditData) {
    let score = 0;
    const factors = [];

    // 基础操作风险评分
    const operationRisks = {
      'Delete': 30,
      'Execute': 25,
      'Update': 15,
      'Create': 10,
      'Read': 5
    };

    score += operationRisks[auditData.operationType] || 10;

    // 资源类型风险评分
    const resourceRisks = {
      'RDSInstance': 20,
      'RecoveryTask': 15,
      'User': 25,
      'Report': 5
    };

    score += resourceRisks[auditData.resourceType] || 10;

    // 时间风险评分
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 22) {
      score += 15;
      factors.push('非工作时间操作');
    }

    // 用户角色风险评分
    if (auditData.userRole === 'admin') {
      score += 10;
      factors.push('管理员权限操作');
    }

    // 确定风险等级
    let level;
    if (score >= 70) level = 'Critical';
    else if (score >= 50) level = 'High';
    else if (score >= 30) level = 'Medium';
    else level = 'Low';

    return { score, level, factors };
  }
}

/**
 * 异常检测器
 */
class AnomalyDetector {
  detectAnomalies(auditData, behaviorAnalysis) {
    const anomalies = [];

    if (behaviorAnalysis.isAnomaly) {
      anomalies.push({
        type: 'behavior_anomaly',
        severity: 'medium',
        description: '用户行为模式异常',
        details: behaviorAnalysis.anomalyFlags
      });
    }

    return anomalies;
  }
}

/**
 * 合规性检查器
 */
class ComplianceChecker {
  async checkCompliance(auditData) {
    const violations = [];
    
    // 检查操作是否符合合规要求
    if (auditData.action === '删除RDS实例' && auditData.resourceType === 'RDSInstance') {
      // 检查是否有相关的恢复任务
      const hasRecentRecoveryTask = await RecoveryTask.findOne({
        where: {
          rds_instance_id: auditData.resourceId,
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 一年内
          }
        }
      });

      if (!hasRecentRecoveryTask) {
        violations.push('删除未进行年度恢复验证的RDS实例');
      }
    }

    return {
      status: violations.length > 0 ? 'VIOLATION' : 'COMPLIANT',
      violations,
      notes: violations.join('; ')
    };
  }
}

/**
 * 告警管理器
 */
class AlertManager {
  async sendCriticalAlert(auditLog) {
    logger.warn('发送关键告警', {
      auditId: auditLog.id,
      action: auditLog.action,
      riskScore: auditLog.risk_score
    });

    // 这里可以实现实际的告警发送逻辑
    // 比如发送邮件、短信、Slack通知等
  }

  async sendAnomalyAlert(auditLog) {
    logger.warn('发送异常行为告警', {
      auditId: auditLog.id,
      userId: auditLog.user_id,
      action: auditLog.action
    });
  }

  async sendComplianceAlert(auditLog) {
    logger.warn('发送合规违规告警', {
      auditId: auditLog.id,
      complianceNotes: auditLog.compliance_notes
    });
  }
}

module.exports = new IntelligentAuditService();