const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '用户名'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    },
    comment: '邮箱'
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码哈希'
  },
  real_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '真实姓名'
  },
  role: {
    type: DataTypes.ENUM('admin', 'operator', 'auditor'),
    defaultValue: 'operator',
    comment: '用户角色'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否激活'
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后登录时间'
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '创建者ID'
  }
}, {
  tableName: 'users',
  comment: '用户表',
  indexes: [
    {
      fields: ['username']
    },
    {
      fields: ['email']
    },
    {
      fields: ['role']
    }
  ]
});

module.exports = User;