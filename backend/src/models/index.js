const User = require('./User');
const RDSInstance = require('./RDSInstance');
const RecoveryTask = require('./RecoveryTask');
const AuditLog = require('./AuditLog');
const ComplianceReport = require('./ComplianceReport');

// 用户与RDS实例关系
User.hasMany(RDSInstance, {
  foreignKey: 'created_by',
  as: 'createdInstances'
});
RDSInstance.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
});

// RDS实例与恢复任务关系
RDSInstance.hasMany(RecoveryTask, {
  foreignKey: 'rds_instance_id',
  as: 'recoveryTasks'
});
RecoveryTask.belongsTo(RDSInstance, {
  foreignKey: 'rds_instance_id',
  as: 'rdsInstance'
});

// 用户与恢复任务关系
User.hasMany(RecoveryTask, {
  foreignKey: 'created_by',
  as: 'createdTasks'
});
RecoveryTask.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
});

// 用户与审计日志关系
User.hasMany(AuditLog, {
  foreignKey: 'user_id',
  as: 'auditLogs'
});
AuditLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// 用户与合规报告关系
User.hasMany(ComplianceReport, {
  foreignKey: 'generated_by',
  as: 'generatedReports'
});
ComplianceReport.belongsTo(User, {
  foreignKey: 'generated_by',
  as: 'generator'
});

User.hasMany(ComplianceReport, {
  foreignKey: 'approved_by',
  as: 'approvedReports'
});
ComplianceReport.belongsTo(User, {
  foreignKey: 'approved_by',
  as: 'approver'
});

module.exports = {
  User,
  RDSInstance,
  RecoveryTask,
  AuditLog,
  ComplianceReport
};