const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RDSInstance = sequelize.define('RDSInstance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  instance_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '阿里云RDS实例ID'
  },
  instance_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'RDS实例名称'
  },
  engine: {
    type: DataTypes.ENUM('MySQL', 'PostgreSQL', 'SQLServer', 'PPAS', 'MariaDB'),
    allowNull: false,
    comment: '数据库引擎'
  },
  engine_version: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '引擎版本'
  },
  region: {
    type: DataTypes.STRING(50),
    allowNull: false,
    default: 'cn-shenzhen',
    comment: '所在地区'
  },
  zone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '可用区'
  },
  instance_class: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '实例规格'
  },
  storage_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '存储类型'
  },
  storage_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '存储大小(GB)'
  },
  vpc_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'VPC ID'
  },
  vswitch_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '交换机ID'
  },
  connection_string: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '连接地址'
  },
  port: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '端口'
  },
  status: {
    type: DataTypes.ENUM('Running', 'Creating', 'Stopped', 'Deleting', 'Rebooting', 'Unknown'),
    defaultValue: 'Unknown',
    comment: '实例状态'
  },
  backup_retention_period: {
    type: DataTypes.INTEGER,
    defaultValue: 7,
    comment: '备份保留天数'
  },
  backup_time: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '备份时间窗口'
  },
  is_monitored: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否监控'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '实例描述'
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '创建者ID'
  }
}, {
  tableName: 'rds_instances',
  comment: 'RDS实例表',
  indexes: [
    {
      fields: ['instance_id']
    },
    {
      fields: ['region']
    },
    {
      fields: ['status']
    },
    {
      fields: ['is_monitored']
    }
  ]
});

module.exports = RDSInstance;