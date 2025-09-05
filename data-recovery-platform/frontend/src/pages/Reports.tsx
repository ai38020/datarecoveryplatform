import React from 'react';
import { Card, Table, Button, Space, Tag, Progress, Modal } from 'antd';
import { PlusOutlined, DownloadOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from 'react-query';
import api from '../services/api';

const Reports: React.FC = () => {
  const { data: reportsData, isLoading } = useQuery('compliance-reports', async () => {
    const response = await api.get('/report/compliance');
    return response.data;
  });

  const columns = [
    {
      title: '报告名称',
      dataIndex: 'report_name',
      key: 'report_name',
    },
    {
      title: '报告类型',
      dataIndex: 'report_type',
      key: 'report_type',
      render: (type: string) => {
        const typeConfig = {
          'Annual': { color: 'purple', text: '年度报告' },
          'Quarterly': { color: 'blue', text: '季度报告' },
          'Monthly': { color: 'green', text: '月度报告' },
          'Custom': { color: 'orange', text: '自定义' },
        };
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '合规年度',
      dataIndex: 'compliance_year',
      key: 'compliance_year',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          'Completed': { color: 'green', text: '已完成' },
          'Generating': { color: 'blue', text: '生成中' },
          'Failed': { color: 'red', text: '失败' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '合规率',
      dataIndex: 'compliance_rate',
      key: 'compliance_rate',
      render: (rate: number) => {
        if (rate === null || rate === undefined) return '-';
        return (
          <div style={{ width: 100 }}>
            <Progress 
              percent={rate} 
              size="small" 
              strokeColor={rate >= 80 ? '#52c41a' : rate >= 60 ? '#faad14' : '#ff4d4f'}
            />
          </div>
        );
      },
    },
    {
      title: '生成时间',
      dataIndex: 'generated_at',
      key: 'generated_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '是否最终版',
      dataIndex: 'is_final',
      key: 'is_final',
      render: (isFinal: boolean) => (
        isFinal ? <Tag color="green">是</Tag> : <Tag color="orange">否</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: any) => (
        <Space>
          {record.status === 'Completed' && (
            <Button 
              type="link" 
              icon={<DownloadOutlined />}
              onClick={() => {
                // 下载报告
                window.open(`/api/report/compliance/${record.id}/download`, '_blank');
              }}
            >
              下载
            </Button>
          )}
          {record.status === 'Completed' && !record.is_final && (
            <Button 
              type="link" 
              icon={<CheckOutlined />}
              onClick={() => Modal.info({ title: '功能开发中', content: '审批功能正在开发中...' })}
            >
              审批
            </Button>
          )}
          <Button 
            type="link"
            onClick={() => Modal.info({ 
              title: '报告详情', 
              content: (
                <div>
                  <p>报告ID: {record.id}</p>
                  <p>总实例数: {record.total_instances || 0}</p>
                  <p>已测试实例: {record.tested_instances || 0}</p>
                  <p>任务成功率: {record.task_success_rate || 0}%</p>
                  {record.recommendations && (
                    <div>
                      <p>建议事项:</p>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{record.recommendations}</p>
                    </div>
                  )}
                </div>
              ),
              width: 600
            })}
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
        title="合规报告管理"
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => Modal.info({ title: '功能开发中', content: '生成报告功能正在开发中...' })}
            >
              生成报告
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
          dataSource={reportsData?.reports || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: reportsData?.pagination?.total || 0,
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

export default Reports;