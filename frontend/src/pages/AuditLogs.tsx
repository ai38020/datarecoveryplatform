import React from 'react';
import { Card, Table, Tag, DatePicker, Button, Space, Input } from 'antd';
import { SearchOutlined, ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from 'react-query';
import api from '../services/api';

const { RangePicker } = DatePicker;

const AuditLogs: React.FC = () => {
  const { data: logsData, isLoading } = useQuery('audit-logs', async () => {
    const response = await api.get('/audit/logs');
    return response.data;
  });

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 200,
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      render: (type: string) => {
        const typeConfig = {
          'User': { color: 'blue', text: '用户' },
          'RDSInstance': { color: 'green', text: 'RDS实例' },
          'RecoveryTask': { color: 'orange', text: '恢复任务' },
          'Report': { color: 'purple', text: '报告' },
          'System': { color: 'default', text: '系统' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      width: 100,
      render: (type: string) => {
        const typeConfig = {
          'Create': { color: 'green', text: '创建' },
          'Read': { color: 'blue', text: '查看' },
          'Update': { color: 'orange', text: '更新' },
          'Delete': { color: 'red', text: '删除' },
          'Execute': { color: 'purple', text: '执行' },
          'Login': { color: 'cyan', text: '登录' },
          'Logout': { color: 'default', text: '登出' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const statusConfig = {
          'Success': { color: 'green', text: '成功' },
          'Failed': { color: 'red', text: '失败' },
          'Warning': { color: 'orange', text: '警告' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '风险级别',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (level: string) => {
        const levelConfig = {
          'Critical': { color: 'red', text: '严重' },
          'High': { color: 'orange', text: '高' },
          'Medium': { color: 'yellow', text: '中' },
          'Low': { color: 'green', text: '低' },
        };
        const config = levelConfig[level] || { color: 'default', text: level };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Card 
        title="审计日志"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索操作或用户"
              style={{ width: 200 }}
              onSearch={() => {}}
            />
            <RangePicker />
            <Button icon={<ExportOutlined />}>
              导出
            </Button>
            <Button icon={<ReloadOutlined />}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={logsData?.logs || []}
          rowKey="id"
          loading={isLoading}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{
            total: logsData?.pagination?.total || 0,
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

export default AuditLogs;