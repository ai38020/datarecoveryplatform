const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'data_recovery_platform',
  username: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  timezone: '+08:00', // 中国时区
  define: {
    charset: 'utf8mb4',
    dialectOptions: {
      collate: 'utf8mb4_unicode_ci'
    },
    timestamps: true, // 自动添加createdAt和updatedAt
    underscored: true, // 使用下划线命名
    paranoid: true // 软删除
  }
});

module.exports = sequelize;