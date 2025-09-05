const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  logger.error('Application Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // 默认错误状态码
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';

  // 处理不同类型的错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '数据验证失败';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = '未授权访问';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = '禁止访问';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = '资源不存在';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    message = '资源冲突';
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = '数据验证失败';
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = '数据重复';
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = '外键约束违反';
  }

  // 构建错误响应
  const errorResponse = {
    error: true,
    message: message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  // 开发环境下返回详细错误信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }

  // 添加验证错误详情
  if (err.name === 'ValidationError' && err.details) {
    errorResponse.validationErrors = err.details;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;