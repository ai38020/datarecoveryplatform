const cron = require('node-cron');
const { RecoveryTask, RDSInstance } = require('../models');
const rdsService = require('./rdsService');
const { logAudit } = require('../utils/audit');
const logger = require('../config/logger');

class RecoveryService {
  constructor() {
    this.runningTasks = new Map(); // 存储正在运行的任务
    this.initScheduler();
  }

  /**
   * 初始化定时调度器
   */
  initScheduler() {
    // 每小时检查一次待执行的任务
    cron.schedule('0 * * * *', () => {
      this.processScheduledTasks();
    });

    // 每10分钟检查一次运行中任务的状态
    cron.schedule('*/10 * * * *', () => {
      this.checkRunningTasks();
    });

    logger.info('恢复任务调度器初始化完成');
  }

  /**
   * 创建恢复任务
   * @param {Object} taskData 任务数据
   * @param {Object} user 创建用户
   * @returns {Promise} 创建的任务
   */
  async createTask(taskData, user) {
    try {
      // 验证RDS实例是否存在
      const rdsInstance = await RDSInstance.findByPk(taskData.rdsInstanceId);
      if (!rdsInstance) {
        throw new Error('指定的RDS实例不存在');
      }

      // 如果是年度任务，检查是否已存在
      if (taskData.isAnnualTask) {
        const existingAnnualTask = await RecoveryTask.findOne({
          where: {
            rds_instance_id: taskData.rdsInstanceId,
            compliance_year: taskData.complianceYear,
            is_annual_task: true,
            status: ['Success', 'Running', 'Pending']
          }
        });

        if (existingAnnualTask) {
          throw new Error(`${taskData.complianceYear}年度的合规任务已存在`);
        }
      }

      const task = await RecoveryTask.create({
        task_name: taskData.taskName,
        rds_instance_id: taskData.rdsInstanceId,
        source_instance_id: taskData.sourceInstanceId,
        backup_id: taskData.backupId,
        backup_type: taskData.backupType,
        restore_time: taskData.restoreTime,
        restore_type: taskData.restoreType,
        target_instance_name: taskData.targetInstanceName,
        task_type: taskData.taskType,
        priority: taskData.priority,
        compliance_year: taskData.complianceYear,
        is_annual_task: taskData.isAnnualTask,
        scheduled_at: taskData.scheduledAt,
        config: taskData.config,
        created_by: user.id
      });

      // 记录审计日志
      await logAudit({
        userId: user.id,
        username: user.username,
        action: '创建恢复任务',
        resourceType: 'RecoveryTask',
        resourceId: task.id,
        resourceName: task.task_name,
        operationType: 'Create',
        status: 'Success',
        description: `创建恢复任务: ${task.task_name}`,
        riskLevel: 'Medium'
      });

      logger.info('恢复任务创建成功', {
        taskId: task.id,
        taskName: task.task_name,
        userId: user.id
      });

      return task;
    } catch (error) {
      logger.error('创建恢复任务失败', {
        error: error.message,
        taskData,
        userId: user.id
      });
      throw error;
    }
  }

  /**
   * 执行恢复任务
   * @param {String} taskId 任务ID
   * @param {Object} user 执行用户
   * @returns {Promise} 执行结果
   */
  async executeTask(taskId, user) {
    try {
      const task = await RecoveryTask.findByPk(taskId, {
        include: [{ association: 'rdsInstance' }]
      });

      if (!task) {
        throw new Error('任务不存在');
      }

      if (task.status === 'Running') {
        throw new Error('任务正在执行中');
      }

      if (task.status === 'Success') {
        throw new Error('任务已成功完成');
      }

      // 更新任务状态为运行中
      await task.update({
        status: 'Running',
        started_at: new Date(),
        progress: 0
      });

      // 添加到运行任务队列
      this.runningTasks.set(taskId, {
        task,
        startTime: Date.now(),
        user
      });

      // 异步执行恢复流程
      this.performRecovery(task, user).catch(error => {
        logger.error('恢复任务执行失败', {
          taskId,
          error: error.message
        });
      });

      logger.info('恢复任务开始执行', {
        taskId,
        taskName: task.task_name,
        userId: user.id
      });

      return {
        message: '恢复任务已开始执行',
        taskId,
        status: 'Running'
      };
    } catch (error) {
      logger.error('启动恢复任务失败', {
        taskId,
        error: error.message,
        userId: user.id
      });
      throw error;
    }
  }

  /**
   * 执行恢复流程
   * @param {Object} task 恢复任务
   * @param {Object} user 执行用户
   */
  async performRecovery(task, user) {
    try {
      const startTime = Date.now();

      // 步骤1: 创建克隆实例 (20%)
      await this.updateTaskProgress(task.id, 20, '正在创建克隆实例...');
      
      const cloneResult = await rdsService.cloneInstance({
        sourceInstanceId: task.source_instance_id,
        targetInstanceName: task.target_instance_name,
        backupId: task.backup_id,
        restoreTime: task.restore_time,
        restoreType: task.restore_type,
        instanceClass: task.config?.instanceClass || 'mysql.n1.micro.1',
        storageSize: task.config?.storageSize || 20
      });

      // 更新目标实例ID
      await task.update({
        target_instance_id: cloneResult.taskId,
        progress: 40
      });

      // 步骤2: 等待实例创建完成 (40% - 70%)
      await this.waitForInstanceReady(cloneResult.taskId, task.id);

      // 步骤3: 验证数据完整性 (70% - 90%)
      await this.updateTaskProgress(task.id, 70, '正在验证数据完整性...');
      
      const validationResult = await this.validateRecoveredData(task);

      // 步骤4: 完成任务 (100%)
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTime) / 1000);

      await task.update({
        status: 'Success',
        progress: 100,
        completed_at: new Date(),
        duration_seconds: duration,
        verification_status: 'Passed',
        verification_result: validationResult
      });

      // 从运行队列中移除
      this.runningTasks.delete(task.id);

      // 记录审计日志
      await logAudit({
        userId: user.id,
        username: user.username,
        action: '执行恢复任务',
        resourceType: 'RecoveryTask',
        resourceId: task.id,
        resourceName: task.task_name,
        operationType: 'Execute',
        status: 'Success',
        description: `恢复任务执行成功，耗时 ${duration} 秒`,
        riskLevel: 'Medium'
      });

      logger.info('恢复任务执行成功', {
        taskId: task.id,
        duration,
        targetInstanceId: task.target_instance_id
      });

    } catch (error) {
      // 任务失败处理
      await task.update({
        status: 'Failed',
        completed_at: new Date(),
        error_message: error.message,
        verification_status: 'Failed'
      });

      this.runningTasks.delete(task.id);

      // 记录审计日志
      await logAudit({
        userId: user.id,
        username: user.username,
        action: '执行恢复任务',
        resourceType: 'RecoveryTask',
        resourceId: task.id,
        resourceName: task.task_name,
        operationType: 'Execute',
        status: 'Failed',
        description: `恢复任务执行失败: ${error.message}`,
        riskLevel: 'High'
      });

      logger.error('恢复任务执行失败', {
        taskId: task.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 更新任务进度
   * @param {String} taskId 任务ID
   * @param {Number} progress 进度百分比
   * @param {String} status 状态描述
   */
  async updateTaskProgress(taskId, progress, status) {
    try {
      await RecoveryTask.update(
        { progress },
        { where: { id: taskId } }
      );

      logger.info('任务进度更新', {
        taskId,
        progress,
        status
      });
    } catch (error) {
      logger.error('更新任务进度失败', {
        taskId,
        error: error.message
      });
    }
  }

  /**
   * 等待实例准备就绪
   * @param {String} instanceId 实例ID
   * @param {String} taskId 任务ID
   */
  async waitForInstanceReady(instanceId, taskId) {
    const maxWaitTime = 30 * 60 * 1000; // 30分钟
    const checkInterval = 30 * 1000; // 30秒
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('等待实例创建超时'));
            return;
          }

          const instance = await rdsService.getInstance(instanceId);
          const progress = Math.min(40 + Math.floor((Date.now() - startTime) / (maxWaitTime / 30)), 70);
          
          await this.updateTaskProgress(taskId, progress, `实例状态: ${instance?.dbInstanceStatus || 'Unknown'}`);

          if (instance && instance.dbInstanceStatus === 'Running') {
            resolve(instance);
          } else {
            setTimeout(checkStatus, checkInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkStatus();
    });
  }

  /**
   * 验证恢复的数据
   * @param {Object} task 恢复任务
   * @returns {Promise} 验证结果
   */
  async validateRecoveredData(task) {
    try {
      // 获取目标实例信息
      const targetInstance = await rdsService.getInstance(task.target_instance_id);
      
      if (!targetInstance) {
        throw new Error('无法获取目标实例信息');
      }

      // 执行数据验证
      const validationResult = await rdsService.validateData({
        instanceId: task.target_instance_id,
        validationRules: task.config?.validationRules || {}
      });

      await this.updateTaskProgress(task.id, 90, '数据验证完成');

      return validationResult;
    } catch (error) {
      logger.error('数据验证失败', {
        taskId: task.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 处理计划任务
   */
  async processScheduledTasks() {
    try {
      const now = new Date();
      const scheduledTasks = await RecoveryTask.findAll({
        where: {
          status: 'Pending',
          scheduled_at: {
            [require('sequelize').Op.lte]: now
          }
        },
        include: [{ association: 'creator' }]
      });

      for (const task of scheduledTasks) {
        try {
          await this.executeTask(task.id, task.creator);
          logger.info('自动执行计划任务', { taskId: task.id });
        } catch (error) {
          logger.error('自动执行计划任务失败', {
            taskId: task.id,
            error: error.message
          });
        }
      }
    } catch (error) {
      logger.error('处理计划任务失败', { error: error.message });
    }
  }

  /**
   * 检查运行中任务状态
   */
  async checkRunningTasks() {
    for (const [taskId, taskInfo] of this.runningTasks) {
      try {
        const { task, startTime } = taskInfo;
        const runningTime = Date.now() - startTime;
        const timeoutLimit = 2 * 60 * 60 * 1000; // 2小时超时

        if (runningTime > timeoutLimit) {
          // 任务超时处理
          await RecoveryTask.update(
            {
              status: 'Timeout',
              completed_at: new Date(),
              error_message: '任务执行超时'
            },
            { where: { id: taskId } }
          );

          this.runningTasks.delete(taskId);
          
          logger.warn('任务执行超时', {
            taskId,
            runningTime: Math.floor(runningTime / 1000)
          });
        }
      } catch (error) {
        logger.error('检查运行任务状态失败', {
          taskId,
          error: error.message
        });
      }
    }
  }

  /**
   * 取消任务
   * @param {String} taskId 任务ID
   * @param {Object} user 操作用户
   */
  async cancelTask(taskId, user) {
    try {
      const task = await RecoveryTask.findByPk(taskId);
      
      if (!task) {
        throw new Error('任务不存在');
      }

      if (!['Pending', 'Running'].includes(task.status)) {
        throw new Error('只能取消待执行或执行中的任务');
      }

      await task.update({
        status: 'Cancelled',
        completed_at: new Date(),
        error_message: '任务被用户取消'
      });

      // 从运行队列中移除
      this.runningTasks.delete(taskId);

      // 记录审计日志
      await logAudit({
        userId: user.id,
        username: user.username,
        action: '取消恢复任务',
        resourceType: 'RecoveryTask',
        resourceId: taskId,
        resourceName: task.task_name,
        operationType: 'Update',
        status: 'Success',
        description: '用户取消了恢复任务',
        riskLevel: 'Medium'
      });

      logger.info('任务已取消', {
        taskId,
        taskName: task.task_name,
        userId: user.id
      });

      return task;
    } catch (error) {
      logger.error('取消任务失败', {
        taskId,
        error: error.message,
        userId: user.id
      });
      throw error;
    }
  }

  /**
   * 获取任务统计信息
   * @param {Object} filters 过滤条件
   * @returns {Promise} 统计信息
   */
  async getTaskStatistics(filters = {}) {
    try {
      const stats = await RecoveryTask.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: filters,
        group: ['status'],
        raw: true
      });

      const result = {
        total: 0,
        pending: 0,
        running: 0,
        success: 0,
        failed: 0,
        cancelled: 0,
        timeout: 0
      };

      stats.forEach(stat => {
        const count = parseInt(stat.count);
        result.total += count;
        result[stat.status.toLowerCase()] = count;
      });

      return result;
    } catch (error) {
      logger.error('获取任务统计信息失败', { error: error.message });
      throw error;
    }
  }
}

module.exports = new RecoveryService();