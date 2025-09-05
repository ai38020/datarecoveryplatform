import React from 'react';
import { Row, Col, Card, Statistic, Progress, Table, Tag } from 'antd';
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import api from '../services/api';

const Dashboard: React.FC = () => {
  // 获取统计数据
  const { data: recoveryStats } = useQuery('recovery-statistics', async () => {
    const response = await api.get('/recovery/statistics');
    return response.data.statistics;
  });

  const { data: auditStats } = useQuery('audit-statistics', async () => {
    const response = await api.get('/audit/statistics');
    return response.data.statistics;
  });

  // 获取最新任务
  const { data: recentTasks } = useQuery('recent-tasks', async () => {
    const response = await api.get('/recovery/tasks?limit=5');
    return response.data.tasks;
  });

  // 获取RDS实例统计
  const { data: instanceStats } = useQuery('instance-stats', async () => {
    const response = await api.get('/rds/instances?limit=1');
    return response.data.pagination;
  });

  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          'Success': { color: 'green', text: '成功' },
          'Failed': { color: 'red', text: '失败' },
          'Running': { color: 'blue', text: '运行中' },
          'Pending': { color: 'orange', text: '待执行' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>仪表板</h1>
      
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="RDS实例总数"
              value={instanceStats?.total || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功任务"
              value={recoveryStats?.success || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败任务"
              value={recoveryStats?.failed || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中任务"
              value={recoveryStats?.running || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 任务成功率 */}
        <Col span={12}>
          <Card title="任务成功率" style={{ marginBottom: 16 }}>
            <Progress
              type="circle"
              percent={
                recoveryStats 
                  ? Math.round((recoveryStats.success / (recoveryStats.total || 1)) * 100)
                  : 0
              }
              format={(percent) => `${percent}%`}
              size={120}
            />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <p>总任务数: {recoveryStats?.total || 0}</p>
              <p>成功: {recoveryStats?.success || 0} | 失败: {recoveryStats?.failed || 0}</p>
            </div>
          </Card>
        </Col>

        {/* 系统状态 */}
        <Col span={12}>
          <Card title="系统状态" style={{ marginBottom: 16 }}>
            <div style={{ padding: '20px 0' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="今日审计日志"
                    value={auditStats?.total || 0}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="高风险操作"
                    value={auditStats?.highRisk || 0}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>系统健康度</span>
                  <span style={{ color: '#52c41a' }}>良好</span>
                </div>
                <Progress 
                  percent={85} 
                  strokeColor="#52c41a"
                  showInfo={false}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最新任务 */}
      <Card title="最新恢复任务" style={{ marginBottom: 16 }}>
        <Table
          columns={taskColumns}
          dataSource={recentTasks || []}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default Dashboard;