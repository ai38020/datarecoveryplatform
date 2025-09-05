import React from 'react';
import { Card, Table, Button, Space, Tag, Progress, Modal } from 'antd';
import { PlusOutlined, PlayCircleOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from 'react-query';
import api from '../services/api';

const RecoveryTasks: React.FC = () => {
  const { data: tasksData, isLoading } = useQuery('recovery-tasks', async () => {
    const response = await api.get('/recovery/tasks');
    return response.data;
  });

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
    },
    {
      title: '关联实例',
      dataIndex: ['rdsInstance', 'instance_name'],
      key: 'instance_name',
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      render: (type: string) => {
        const typeConfig = {
          'Manual': { color: 'blue', text: '手动' },
          'Scheduled': { color: 'orange', text: '计划' },
          'Annual': { color: 'purple', text: '年度' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
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
          'Cancelled': { color: 'default', text: '已取消' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number, record: any) => {
        if (record.status === 'Running') {
          return <Progress percent={progress} size="small" />;
        }
        return record.status === 'Success' ? '100%' : '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: any) => (
        <Space>
          {record.status === 'Pending' && (
            <Button 
              type="link" 
              icon={<PlayCircleOutlined />}
              onClick={() => Modal.info({ title: '功能开发中', content: '执行任务功能正在开发中...' })}
            >
              执行
            </Button>
          )}
          {record.status === 'Running' && (
            <Button 
              type="link" 
              danger 
              icon={<StopOutlined />}
              onClick={() => Modal.info({ title: '功能开发中', content: '取消任务功能正在开发中...' })}
            >
              取消
            </Button>
          )}
          <Button 
            type="link"
            onClick={() => Modal.info({ title: '任务详情', content: `任务ID: ${record.id}` })}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        title="恢复任务管理"
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => Modal.info({ title: '功能开发中', content: '创建任务功能正在开发中...' })}
            >
              创建任务
            </Button>
            <Button 
              icon={<ReloadOutlined />}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tasksData?.tasks || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: tasksData?.pagination?.total || 0,
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>
    </div>
  );
};

export default RecoveryTasks;