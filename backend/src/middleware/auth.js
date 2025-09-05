const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../config/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: true,
        message: '访问令牌缺失'
      });
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查找用户
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(401).json({
        error: true,
        message: '用户不存在'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        error: true,
        message: '用户账户已被禁用'
      });
    }

    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (error) {
    logger.error('Token验证失败', {
      error: error.message,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: true,
        message: '访问令牌已过期'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: true,
        message: '无效的访问令牌'
      });
    }

    return res.status(500).json({
      error: true,
      message: '令牌验证失败'
    });
  }
};

// 角色权限检查中间件
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: true,
        message: '用户未认证'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('权限不足', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        error: true,
        message: '权限不足'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorize
};