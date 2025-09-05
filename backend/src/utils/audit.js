const { AuditLog } = require('../models');
const logger = require('../config/logger');

/**
 * 记录审计日志
 * @param {Object} params 审计日志参数
 */
const logAudit = async ({
  userId,
  username,
  action,
  resourceType,
  resourceId,
  resourceName,
  operationType,
  status,
  ipAddress,
  userAgent,
  requestPath,
  requestMethod,
  requestParams,
  responseStatus,
  responseTime,
  oldValues,
  newValues,
  description,
  riskLevel = 'Low',
  tags,
  sessionId,
  traceId
}) => {
  try {
    await AuditLog.create({
      user_id: userId,
      username,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_name: resourceName,
      operation_type: operationType,
      status,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_path: requestPath,
      request_method: requestMethod,
      request_params: requestParams,
      response_status: responseStatus,
      response_time: responseTime,
      old_values: oldValues,
      new_values: newValues,
      description,
      risk_level: riskLevel,
      tags,
      session_id: sessionId,
      trace_id: traceId
    });

    logger.info('审计日志记录成功', {
      userId,
      action,
      resourceType,
      operationType,
      status
    });
  } catch (error) {
    logger.error('审计日志记录失败', {
      error: error.message,
      userId,
      action,
      resourceType
    });
  }
};

/**
 * 创建审计日志中间件
 */
const createAuditMiddleware = (action, resourceType, operationType, riskLevel = 'Low') => {
  return async (req, res, next) => {
    const start = Date.now();
    
    // 保存原始的res.json方法
    const originalJson = res.json;
    
    // 重写res.json方法以捕获响应
    res.json = function(body) {
      const responseTime = Date.now() - start;
      
      // 确定操作状态
      const status = res.statusCode >= 400 ? 'Failed' : 'Success';
      
      // 记录审计日志
      logAudit({
        userId: req.user?.id,
        username: req.user?.username,
        action,
        resourceType,
        resourceId: req.params?.id || req.body?.id,
        resourceName: req.body?.name || req.params?.name,
        operationType,
        status,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestPath: req.originalUrl,
        requestMethod: req.method,
        requestParams: {
          params: req.params,
          query: req.query,
          body: req.body
        },
        responseStatus: res.statusCode,
        responseTime,
        description: `用户执行了${action}操作`,
        riskLevel,
        sessionId: req.sessionID,
        traceId: req.headers['x-trace-id']
      });
      
      // 调用原始的json方法
      originalJson.call(this, body);
    };
    
    next();
  };
};

module.exports = {
  logAudit,
  createAuditMiddleware
};