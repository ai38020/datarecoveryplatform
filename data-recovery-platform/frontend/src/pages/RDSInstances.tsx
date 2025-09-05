import React from 'react';
import { Card, Table, Button, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';

const RDSInstances: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: instancesData, isLoading } = useQuery('rds-instances', async () => {
    const response = await api.get('/rds/instances');
    return response.data;
  });

  const syncMutation = useMutation(
    (id: string) => api.post(`/rds/instances/${id}/sync`),
    {
      onSuccess: () => {
        message.success('实例状态同步成功');
        queryClient.invalidateQueries('rds-instances');
      },
      onError: () => {
        message.error('同步失败');
      }
    }
  );

  const columns = [
    {
      title: '实例名称',
      dataIndex: 'instance_name',
      key: 'instance_name',
    },
    {
      title: '实例ID',
      dataIndex: 'instance_id',
      key: 'instance_id',
    },
    {
      title: '数据库引擎',
      dataIndex: 'engine',
      key: 'engine',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          'Running': { color: 'green', text: '运行中' },
          'Stopped': { color: 'red', text: '已停止' },
          'Creating': { color: 'blue', text: '创建中' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '地区',
      dataIndex: 'region',
      key: 'region',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: any) => (
        <Space>
          <Button 
            type="link" 
            icon={<ReloadOutlined />}
            onClick={() => syncMutation.mutate(record.id)}
            loading={syncMutation.isLoading}
          >
            同步
          </Button>
          <Button type="link" icon={<EditOutlined />}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        title="RDS实例管理"
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => Modal.info({ title: '功能开发中', content: '添加实例功能正在开发中...' })}
            >
              添加实例
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries('rds-instances')}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={instancesData?.instances || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: instancesData?.pagination?.total || 0,
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

export default RDSInstances;