const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { validate, userSchemas } = require('../utils/validation');
const { logAudit } = require('../utils/audit');
const logger = require('../config/logger');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *               email:
 *                 type: string
 *                 description: 邮箱
 *               password:
 *                 type: string
 *                 description: 密码
 *               realName:
 *                 type: string
 *                 description: 真实姓名
 *               role:
 *                 type: string
 *                 enum: [admin, operator, auditor]
 *                 description: 用户角色
 *     responses:
 *       201:
 *         description: 注册成功
 *       400:
 *         description: 验证失败
 *       409:
 *         description: 用户已存在
 */
router.post('/register', validate(userSchemas.register), async (req, res, next) => {
  try {
    const { username, email, password, realName, role } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      where: {
        $or: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: true,
        message: '用户名或邮箱已存在'
      });
    }

    // 加密密码
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const user = await User.create({
      username,
      email,
      password_hash: passwordHash,
      real_name: realName,
      role
    });

    // 记录审计日志
    await logAudit({
      userId: user.id,
      username: user.username,
      action: '用户注册',
      resourceType: 'User',
      resourceId: user.id,
      resourceName: user.username,
      operationType: 'Create',
      status: 'Success',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestPath: req.originalUrl,
      requestMethod: req.method,
      description: `新用户 ${username} 注册成功`,
      riskLevel: 'Medium'
    });

    // 返回用户信息（不包含密码）
    const { password_hash, ...userResponse } = user.toJSON();

    res.status(201).json({
      message: '注册成功',
      user: userResponse
    });
  } catch (error) {
    logger.error('用户注册失败', { error: error.message });
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *               password:
 *                 type: string
 *                 description: 密码
 *     responses:
 *       200:
 *         description: 登录成功
 *       401:
 *         description: 登录失败
 */
router.post('/login', validate(userSchemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({
      where: { username }
    });

    if (!user) {
      await logAudit({
        username,
        action: '用户登录',
        resourceType: 'User',
        operationType: 'Login',
        status: 'Failed',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestPath: req.originalUrl,
        requestMethod: req.method,
        description: `用户名 ${username} 不存在`,
        riskLevel: 'Medium'
      });

      return res.status(401).json({
        error: true,
        message: '用户名或密码错误'
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await logAudit({
        userId: user.id,
        username: user.username,
        action: '用户登录',
        resourceType: 'User',
        resourceId: user.id,
        resourceName: user.username,
        operationType: 'Login',
        status: 'Failed',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestPath: req.originalUrl,
        requestMethod: req.method,
        description: '密码错误',
        riskLevel: 'High'
      });

      return res.status(401).json({
        error: true,
        message: '用户名或密码错误'
      });
    }

    // 检查用户是否激活
    if (!user.is_active) {
      await logAudit({
        userId: user.id,
        username: user.username,
        action: '用户登录',
        resourceType: 'User',
        resourceId: user.id,
        resourceName: user.username,
        operationType: 'Login',
        status: 'Failed',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestPath: req.originalUrl,
        requestMethod: req.method,
        description: '账户已被禁用',
        riskLevel: 'Medium'
      });

      return res.status(401).json({
        error: true,
        message: '账户已被禁用'
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // 更新最后登录时间
    await user.update({ last_login_at: new Date() });

    // 记录成功登录
    await logAudit({
      userId: user.id,
      username: user.username,
      action: '用户登录',
      resourceType: 'User',
      resourceId: user.id,
      resourceName: user.username,
      operationType: 'Login',
      status: 'Success',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestPath: req.originalUrl,
      requestMethod: req.method,
      description: '登录成功',
      riskLevel: 'Low'
    });

    // 返回用户信息和令牌
    const { password_hash, ...userResponse } = user.toJSON();

    res.json({
      message: '登录成功',
      token,
      user: userResponse
    });
  } catch (error) {
    logger.error('用户登录失败', { error: error.message });
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: 用户登出
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 登出成功
 */
router.post('/logout', async (req, res) => {
  // 记录登出日志
  await logAudit({
    userId: req.user?.id,
    username: req.user?.username,
    action: '用户登出',
    resourceType: 'User',
    resourceId: req.user?.id,
    resourceName: req.user?.username,
    operationType: 'Logout',
    status: 'Success',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestPath: req.originalUrl,
    requestMethod: req.method,
    description: '用户登出',
    riskLevel: 'Low'
  });

  res.json({
    message: '登出成功'
  });
});

module.exports = router;