const Joi = require('joi');

/**
 * 验证中间件
 * @param {Object} schema Joi验证模式
 * @param {String} source 数据源 ('body', 'query', 'params')
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        error: true,
        message: '数据验证失败',
        validationErrors
      });
    }

    // 用验证后的数据替换原始数据
    req[source] = value;
    next();
  };
};

// 用户相关验证模式
const userSchemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required().messages({
      'string.alphanum': '用户名只能包含字母和数字',
      'string.min': '用户名至少3个字符',
      'string.max': '用户名最多50个字符',
      'any.required': '用户名是必填的'
    }),
    email: Joi.string().email().required().messages({
      'string.email': '请输入有效的邮箱地址',
      'any.required': '邮箱是必填的'
    }),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required().messages({
      'string.min': '密码至少8个字符',
      'string.pattern.base': '密码必须包含大小写字母、数字和特殊字符',
      'any.required': '密码是必填的'
    }),
    realName: Joi.string().max(50).optional(),
    role: Joi.string().valid('admin', 'operator', 'auditor').default('operator')
  }),
  
  login: Joi.object({
    username: Joi.string().required().messages({
      'any.required': '用户名是必填的'
    }),
    password: Joi.string().required().messages({
      'any.required': '密码是必填的'
    })
  }),
  
  updateProfile: Joi.object({
    realName: Joi.string().max(50).optional(),
    email: Joi.string().email().optional()
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': '当前密码是必填的'
    }),
    newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required().messages({
      'string.min': '新密码至少8个字符',
      'string.pattern.base': '新密码必须包含大小写字母、数字和特殊字符',
      'any.required': '新密码是必填的'
    })
  })
};

// RDS实例相关验证模式
const rdsSchemas = {
  create: Joi.object({
    instanceId: Joi.string().required().messages({
      'any.required': '实例ID是必填的'
    }),
    instanceName: Joi.string().required().messages({
      'any.required': '实例名称是必填的'
    }),
    engine: Joi.string().valid('MySQL', 'PostgreSQL', 'SQLServer', 'PPAS', 'MariaDB').required(),
    engineVersion: Joi.string().required(),
    region: Joi.string().default('cn-shenzhen'),
    zone: Joi.string().optional(),
    instanceClass: Joi.string().optional(),
    storageType: Joi.string().optional(),
    storageSize: Joi.number().integer().min(20).max(32000).optional(),
    vpcId: Joi.string().optional(),
    vswitchId: Joi.string().optional(),
    connectionString: Joi.string().optional(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    backupRetentionPeriod: Joi.number().integer().min(7).max(730).default(7),
    backupTime: Joi.string().optional(),
    description: Joi.string().max(500).optional()
  }),
  
  update: Joi.object({
    instanceName: Joi.string().optional(),
    description: Joi.string().max(500).optional(),
    backupRetentionPeriod: Joi.number().integer().min(7).max(730).optional(),
    backupTime: Joi.string().optional(),
    isMonitored: Joi.boolean().optional()
  })
};

// 恢复任务相关验证模式
const recoverySchemas = {
  create: Joi.object({
    taskName: Joi.string().required().messages({
      'any.required': '任务名称是必填的'
    }),
    rdsInstanceId: Joi.string().uuid().required(),
    sourceInstanceId: Joi.string().required(),
    backupId: Joi.string().optional(),
    backupType: Joi.string().valid('FullBackup', 'IncrementalBackup', 'LogBackup').default('FullBackup'),
    restoreTime: Joi.date().optional(),
    restoreType: Joi.string().valid('BackupSet', 'PointInTime').default('BackupSet'),
    targetInstanceName: Joi.string().required(),
    taskType: Joi.string().valid('Manual', 'Scheduled', 'Annual').default('Manual'),
    priority: Joi.string().valid('Low', 'Normal', 'High', 'Critical').default('Normal'),
    complianceYear: Joi.number().integer().min(2020).max(2050).optional(),
    isAnnualTask: Joi.boolean().default(false),
    scheduledAt: Joi.date().optional(),
    config: Joi.object().optional()
  }),
  
  update: Joi.object({
    taskName: Joi.string().optional(),
    priority: Joi.string().valid('Low', 'Normal', 'High', 'Critical').optional(),
    scheduledAt: Joi.date().optional(),
    config: Joi.object().optional()
  })
};

// 通用验证模式
const commonSchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  uuid: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.uuid': 'ID格式无效',
      'any.required': 'ID是必填的'
    })
  }),
  
  dateRange: Joi.object({
    startDate: Joi.date().required(),
    endDate: Joi.date().min(Joi.ref('startDate')).required()
  })
};

module.exports = {
  validate,
  userSchemas,
  rdsSchemas,
  recoverySchemas,
  commonSchemas
};