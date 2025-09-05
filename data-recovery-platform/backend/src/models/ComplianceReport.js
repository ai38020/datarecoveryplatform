const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ComplianceReport = sequelize.define('ComplianceReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  report_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '报告名称'
  },
  report_type: {
    type: DataTypes.ENUM('Annual', 'Quarterly', 'Monthly', 'Custom'),
    allowNull: false,
    comment: '报告类型'
  },
  compliance_year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '合规年度'
  },
  period_start: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '统计开始时间'
  },
  period_end: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '统计结束时间'
  },
  status: {
    type: DataTypes.ENUM('Generating', 'Completed', 'Failed'),
    defaultValue: 'Generating',
    comment: '生成状态'
  },
  total_instances: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总实例数'
  },
  tested_instances: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已测试实例数'
  },
  passed_instances: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '测试通过实例数'
  },
  failed_instances: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '测试失败实例数'
  },
  compliance_rate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00,
    comment: '合规率(%)'
  },
  total_tasks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总任务数'
  },
  successful_tasks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '成功任务数'
  },
  failed_tasks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '失败任务数'
  },
  task_success_rate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00,
    comment: '任务成功率(%)'
  },
  average_recovery_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '平均恢复时间(秒)'
  },
  data_summary: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '数据汇总'
  },
  risk_analysis: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '风险分析'
  },
  recommendations: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '建议事项'
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '报告文件路径'
  },
  file_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '报告文件名'
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '文件大小(bytes)'
  },
  generated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '生成时间'
  },
  generated_by: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '生成者ID'
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '审批者ID'
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '审批时间'
  },
  is_final: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否最终版本'
  }
}, {
  tableName: 'compliance_reports',
  comment: '合规报告表',
  indexes: [
    {
      fields: ['report_type']
    },
    {
      fields: ['compliance_year']
    },
    {
      fields: ['status']
    },
    {
      fields: ['generated_by']
    },
    {
      fields: ['is_final']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = ComplianceReport;