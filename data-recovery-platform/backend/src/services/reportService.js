const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const { ComplianceReport, RecoveryTask, RDSInstance, AuditLog } = require('../models');
const { logAudit } = require('../utils/audit');
const logger = require('../config/logger');

class ReportService {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports');
    this.ensureReportsDirectory();
  }

  /**
   * 确保报告目录存在
   */
  async ensureReportsDirectory() {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
      logger.info('创建报告目录', { reportsDir: this.reportsDir });
    }
  }

  /**
   * 生成合规报告
   * @param {Object} params 报告参数
   * @param {Object} user 生成用户
   * @returns {Promise} 报告信息
   */
  async generateComplianceReport(params, user) {
    try {
      const {
        reportName,
        reportType,
        complianceYear,
        periodStart,
        periodEnd,
        includeDetails = true
      } = params;

      // 创建报告记录
      const report = await ComplianceReport.create({
        report_name: reportName,
        report_type: reportType,
        compliance_year: complianceYear,
        period_start: new Date(periodStart),
        period_end: new Date(periodEnd),
        status: 'Generating',
        generated_by: user.id
      });

      // 异步生成报告内容
      this.generateReportContent(report.id, includeDetails).catch(error => {
        logger.error('生成报告内容失败', {
          reportId: report.id,
          error: error.message
        });
      });

      // 记录审计日志
      await logAudit({
        userId: user.id,
        username: user.username,
        action: '生成合规报告',
        resourceType: 'Report',
        resourceId: report.id,
        resourceName: report.report_name,
        operationType: 'Create',
        status: 'Success',
        description: `开始生成${reportType}合规报告`,
        riskLevel: 'Low'
      });

      return report;
    } catch (error) {
      logger.error('创建合规报告失败', {
        error: error.message,
        params,
        userId: user.id
      });
      throw error;
    }
  }

  /**
   * 生成报告内容
   * @param {String} reportId 报告ID
   * @param {Boolean} includeDetails 是否包含详细信息
   */
  async generateReportContent(reportId, includeDetails = true) {
    try {
      const report = await ComplianceReport.findByPk(reportId);
      if (!report) {
        throw new Error('报告不存在');
      }

      // 收集数据
      const data = await this.collectReportData(report);

      // 生成Excel文件
      const filePath = await this.generateExcelReport(report, data, includeDetails);

      // 更新报告状态
      const fileStats = await fs.stat(filePath);
      await report.update({
        status: 'Completed',
        total_instances: data.totalInstances,
        tested_instances: data.testedInstances,
        passed_instances: data.passedInstances,
        failed_instances: data.failedInstances,
        compliance_rate: data.complianceRate,
        total_tasks: data.totalTasks,
        successful_tasks: data.successfulTasks,
        failed_tasks: data.failedTasks,
        task_success_rate: data.taskSuccessRate,
        average_recovery_time: data.averageRecoveryTime,
        data_summary: data.summary,
        risk_analysis: data.riskAnalysis,
        recommendations: data.recommendations,
        file_path: filePath,
        file_name: path.basename(filePath),
        file_size: fileStats.size,
        generated_at: new Date()
      });

      logger.info('合规报告生成完成', { reportId });
    } catch (error) {
      await ComplianceReport.update(
        { status: 'Failed' },
        { where: { id: reportId } }
      );
      logger.error('生成报告内容失败', { reportId, error: error.message });
      throw error;
    }
  }

  /**
   * 收集报告数据
   */
  async collectReportData(report) {
    const { period_start, period_end, compliance_year } = report;

    // 获取实例和任务数据
    const instances = await RDSInstance.findAll({
      where: {
        created_at: { [require('sequelize').Op.lte]: period_end }
      }
    });

    const tasks = await RecoveryTask.findAll({
      where: {
        created_at: { [require('sequelize').Op.between]: [period_start, period_end] }
      },
      include: [{ association: 'rdsInstance' }, { association: 'creator' }]
    });

    // 统计计算
    const totalInstances = instances.length;
    const testedInstances = new Set(tasks.map(task => task.rds_instance_id)).size;
    const successfulTasks = tasks.filter(task => task.status === 'Success').length;
    const failedTasks = tasks.filter(task => task.status === 'Failed').length;
    
    const passedInstances = new Set(
      tasks.filter(task => task.status === 'Success' && task.verification_status === 'Passed')
        .map(task => task.rds_instance_id)
    ).size;

    const complianceRate = totalInstances > 0 ? (passedInstances / totalInstances * 100).toFixed(2) : 0;
    const taskSuccessRate = tasks.length > 0 ? (successfulTasks / tasks.length * 100).toFixed(2) : 0;

    // 平均恢复时间
    const completedTasks = tasks.filter(task => task.duration_seconds);
    const averageRecoveryTime = completedTasks.length > 0 
      ? Math.round(completedTasks.reduce((sum, task) => sum + task.duration_seconds, 0) / completedTasks.length)
      : null;

    return {
      totalInstances,
      testedInstances,
      passedInstances,
      failedInstances: testedInstances - passedInstances,
      complianceRate: parseFloat(complianceRate),
      totalTasks: tasks.length,
      successfulTasks,
      failedTasks,
      taskSuccessRate: parseFloat(taskSuccessRate),
      averageRecoveryTime,
      summary: { instances, tasks },
      riskAnalysis: await this.performRiskAnalysis(report, tasks, instances),
      recommendations: this.generateRecommendations({
        complianceRate: parseFloat(complianceRate),
        taskSuccessRate: parseFloat(taskSuccessRate),
        failedTasks,
        totalInstances,
        testedInstances
      })
    };
  }

  /**
   * 执行风险分析
   */
  async performRiskAnalysis(report, tasks, instances) {
    const { period_start, period_end } = report;
    
    const failedAudits = await AuditLog.count({
      where: {
        status: 'Failed',
        created_at: { [require('sequelize').Op.between]: [period_start, period_end] }
      }
    });

    const untestedInstances = instances.length - new Set(tasks.map(task => task.rds_instance_id)).size;
    const failedTasks = tasks.filter(task => task.status === 'Failed').length;

    const riskScore = Math.min(100, (untestedInstances * 10) + (failedTasks * 15) + (failedAudits * 5));

    return {
      riskScore,
      riskLevel: riskScore >= 80 ? 'Critical' : riskScore >= 60 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low',
      untestedInstances,
      failedTaskCount: failedTasks,
      failedAuditCount: failedAudits
    };
  }

  /**
   * 生成建议
   */
  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.complianceRate < 80) {
      recommendations.push('合规率低于80%，建议增加测试频率');
    }
    if (stats.taskSuccessRate < 90) {
      recommendations.push('任务成功率需要改善，建议检查恢复流程');
    }
    if (stats.totalInstances > stats.testedInstances) {
      recommendations.push(`有 ${stats.totalInstances - stats.testedInstances} 个实例尚未进行恢复测试`);
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '当前合规状态良好';
  }

  /**
   * 生成Excel报告
   */
  async generateExcelReport(report, data, includeDetails) {
    const workbook = new ExcelJS.Workbook();
    
    // 创建概要页
    const sheet = workbook.addWorksheet('概要信息');
    
    // 标题
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = report.report_name;
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // 核心指标
    const metrics = [
      ['总实例数', data.totalInstances],
      ['已测试实例数', data.testedInstances],
      ['合规率', `${data.complianceRate}%`],
      ['任务成功率', `${data.taskSuccessRate}%`],
      ['平均恢复时间', data.averageRecoveryTime ? `${data.averageRecoveryTime}秒` : 'N/A']
    ];

    let row = 3;
    metrics.forEach(([label, value]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`B${row}`).value = value;
      row++;
    });

    // 建议事项
    row += 2;
    sheet.getCell(`A${row}`).value = '建议事项';
    sheet.getCell(`A${row}`).font = { bold: true };
    row++;
    sheet.getCell(`A${row}`).value = data.recommendations;
    sheet.mergeCells(`A${row}:D${row + 2}`);
    sheet.getCell(`A${row}`).alignment = { wrapText: true };

    // 保存文件
    const fileName = `compliance_report_${report.compliance_year}_${Date.now()}.xlsx`;
    const filePath = path.join(this.reportsDir, fileName);
    await workbook.xlsx.writeFile(filePath);
    
    return filePath;
  }
}

module.exports = new ReportService();