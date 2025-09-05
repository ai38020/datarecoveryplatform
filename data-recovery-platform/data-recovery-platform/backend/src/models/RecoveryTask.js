const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecoveryTask = sequelize.define('RecoveryTask', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  task_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '任务名称'
  },
  rds_instance_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'RDS实例ID'
  },
  source_instance_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '源实例ID'
  },
  backup_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '备份集ID'
  },
  backup_type: {
    type: DataTypes.ENUM('FullBackup', 'IncrementalBackup', 'LogBackup'),
    defaultValue: 'FullBackup',
    comment: '备份类型'
  },
  restore_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '恢复到指定时间点'
  },
  restore_type: {
    type: DataTypes.ENUM('BackupSet', 'PointInTime'),
    defaultValue: 'BackupSet',
    comment: '恢复类型'
  },
  target_instance_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '目标实例名称'
  },
  target_instance_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '目标实例ID'
  },
  task_type: {
    type: DataTypes.ENUM('Manual', 'Scheduled', 'Annual'),
    defaultValue: 'Manual',
    comment: '任务类型'
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Normal', 'High', 'Critical'),
    defaultValue: 'Normal',
    comment: '优先级'
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Running', 'Success', 'Failed', 'Cancelled', 'Timeout'),
    defaultValue: 'Pending',
    comment: '任务状态'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '进度百分比'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '开始时间'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间'
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '持续时间(秒)'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息'
  },
  verification_status: {
    type: DataTypes.ENUM('Pending', 'InProgress', 'Passed', 'Failed'),
    defaultValue: 'Pending',
    comment: '验证状态'
  },
  verification_result: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '验证结果'
  },
  compliance_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '合规年度'
  },
  is_annual_task: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否年度任务'
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '计划执行时间'
  },
  config: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '任务配置'
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '创建者ID'
  }
}, {
  tableName: 'recovery_tasks',
  comment: '恢复任务表',
  indexes: [
    {
      fields: ['rds_instance_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['task_type']
    },
    {
      fields: ['compliance_year']
    },
    {
      fields: ['is_annual_task']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = RecoveryTask;