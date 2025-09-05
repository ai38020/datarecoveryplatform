const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '用户ID'
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '用户名'
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '操作动作'
  },
  resource_type: {
    type: DataTypes.ENUM('User', 'RDSInstance', 'RecoveryTask', 'Report', 'System'),
    allowNull: false,
    comment: '资源类型'
  },
  resource_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '资源ID'
  },
  resource_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '资源名称'
  },
  operation_type: {
    type: DataTypes.ENUM('Create', 'Read', 'Update', 'Delete', 'Execute', 'Login', 'Logout'),
    allowNull: false,
    comment: '操作类型'
  },
  status: {
    type: DataTypes.ENUM('Success', 'Failed', 'Warning'),
    allowNull: false,
    comment: '操作状态'
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: 'IP地址'
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '用户代理'
  },
  request_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '请求路径'
  },
  request_method: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '请求方法'
  },
  request_params: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '请求参数'
  },
  response_status: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '响应状态码'
  },
  response_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '响应时间(ms)'
  },
  old_values: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '修改前的值'
  },
  new_values: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '修改后的值'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作描述'
  },
  risk_level: {
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
    defaultValue: 'Low',
    comment: '风险级别'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '标签'
  },
  session_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '会话ID'
  },
  trace_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '追踪ID'
  }
}, {
  tableName: 'audit_logs',
  comment: '审计日志表',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['action']
    },
    {
      fields: ['resource_type']
    },
    {
      fields: ['operation_type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['risk_level']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['ip_address']
    }
  ]
});

module.exports = AuditLog;