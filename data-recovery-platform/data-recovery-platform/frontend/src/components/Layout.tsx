import React from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button, Space } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ReconciliationOutlined,
  AuditOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

const { Header, Sider, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/rds-instances',
      icon: <DatabaseOutlined />,
      label: 'RDS实例管理',
    },
    {
      key: '/recovery-tasks',
      icon: <ReconciliationOutlined />,
      label: '恢复任务',
    },
    {
      key: '/audit-logs',
      icon: <AuditOutlined />,
      label: '审计日志',
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '合规报告',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // 忽略登出API错误
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="dark">
        <div style={{
          height: 64,
          margin: 16,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold'
        }}>
          数据恢复平台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      
      <AntLayout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            数据恢复验证平台
          </div>
          
          <Space>
            <span>欢迎，{user?.realName || user?.username}</span>
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
            >
              <Button type="text" icon={<Avatar size="small" icon={<UserOutlined />} />}>
                {user?.username}
              </Button>
            </Dropdown>
          </Space>
        </Header>
        
        <Content style={{
          margin: '16px',
          padding: '24px',
          background: '#fff',
          borderRadius: 6,
          overflow: 'auto'
        }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default AppLayout;