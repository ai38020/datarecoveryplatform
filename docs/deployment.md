# 数据恢复验证平台 - 部署指南

## 系统要求

### 服务器配置
- **CPU**: 2核心以上
- **内存**: 4GB以上
- **存储**: 50GB以上
- **操作系统**: Linux (Ubuntu 20.04+/CentOS 7+) 或 Windows Server

### 软件环境
- Node.js 18.0+
- MySQL 8.0+
- Nginx (可选，用于反向代理)
- PM2 (进程管理)

## 安装步骤

### 1. 环境准备

#### 安装Node.js
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

#### 安装MySQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# CentOS/RHEL
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

#### 安装PM2
```bash
npm install -g pm2
```

### 2. 项目部署

#### 克隆代码
```bash
git clone <repository-url>
cd data-recovery-platform
```

#### 后端部署
```bash
cd backend

# 安装依赖
npm install --production

# 复制环境配置
cp .env.example .env

# 编辑配置文件
nano .env
```

#### 配置环境变量
编辑 `.env` 文件：
```env
NODE_ENV=production
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=data_recovery_platform
DB_USER=app_user
DB_PASSWORD=secure_password

# JWT配置  
JWT_SECRET=your_very_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# 阿里云配置
ALICLOUD_ACCESS_KEY_ID=your_access_key_id
ALICLOUD_ACCESS_KEY_SECRET=your_access_key_secret
ALICLOUD_REGION=cn-shenzhen

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

#### 数据库初始化
```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE data_recovery_platform;
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON data_recovery_platform.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 运行数据库迁移
npm run db:migrate
```

#### 前端构建
```bash
cd ../frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 复制构建文件到后端静态目录
cp -r dist/* ../backend/public/
```

### 3. 启动服务

#### 使用PM2启动
```bash
cd backend

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'data-recovery-platform',
    script: './src/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

### 4. Nginx配置 (可选)

#### 安装Nginx
```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL  
sudo yum install nginx
```

#### 配置反向代理
```bash
sudo nano /etc/nginx/sites-available/data-recovery-platform
```

添加以下配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # 静态文件
    location /static/ {
        alias /path/to/data-recovery-platform/backend/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 前端应用
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 启用配置
```bash
sudo ln -s /etc/nginx/sites-available/data-recovery-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 5. 安全配置

#### 防火墙设置
```bash
# Ubuntu (UFW)
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### MySQL安全配置
```bash
sudo mysql_secure_installation
```

#### 文件权限
```bash
# 设置应用文件权限
sudo chown -R app_user:app_user /path/to/data-recovery-platform
sudo chmod -R 755 /path/to/data-recovery-platform
sudo chmod -R 700 /path/to/data-recovery-platform/backend/logs
sudo chmod 600 /path/to/data-recovery-platform/backend/.env
```

## 监控和维护

### 日志管理
```bash
# 查看应用日志
pm2 logs data-recovery-platform

# 查看系统日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 健康检查
```bash
# 检查应用状态
pm2 status

# 检查数据库连接
mysql -u app_user -p -e "SELECT 1"

# 检查API健康状态
curl http://localhost:3000/health
```

### 备份策略

#### 数据库备份
```bash
# 创建备份脚本
cat > /usr/local/bin/backup-db.sh << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mysql"
mkdir -p \$BACKUP_DIR

mysqldump -u app_user -p data_recovery_platform > \$BACKUP_DIR/data_recovery_platform_\$DATE.sql
gzip \$BACKUP_DIR/data_recovery_platform_\$DATE.sql

# 删除7天前的备份
find \$BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-db.sh

# 设置定时备份
crontab -e
# 添加：0 2 * * * /usr/local/bin/backup-db.sh
```

#### 应用文件备份
```bash
# 代码和配置备份
tar -czf /backup/app/app_backup_$(date +%Y%m%d).tar.gz \
  /path/to/data-recovery-platform \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=uploads
```

### 更新部署
```bash
# 1. 备份当前版本
cp -r /path/to/data-recovery-platform /backup/app_$(date +%Y%m%d)

# 2. 拉取新代码
cd /path/to/data-recovery-platform
git pull origin main

# 3. 更新依赖
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# 4. 重启应用
pm2 restart data-recovery-platform

# 5. 验证部署
curl http://localhost:3000/health
```

## 故障排除

### 常见问题

1. **应用无法启动**
   ```bash
   # 检查日志
   pm2 logs data-recovery-platform
   # 检查端口占用
   netstat -tulpn | grep :3000
   ```

2. **数据库连接失败**
   ```bash
   # 检查MySQL状态
   sudo systemctl status mysql
   # 测试连接
   mysql -u app_user -p
   ```

3. **文件权限问题**
   ```bash
   # 修复权限
   sudo chown -R app_user:app_user /path/to/data-recovery-platform
   ```

4. **内存不足**
   ```bash
   # 检查内存使用
   free -h
   # 重启应用释放内存
   pm2 restart data-recovery-platform
   ```

### 性能优化

1. **数据库优化**
   - 添加索引
   - 配置连接池
   - 定期优化表

2. **应用优化**
   - 启用集群模式
   - 配置缓存
   - 压缩静态资源

3. **系统优化**
   - 调整文件描述符限制
   - 配置swap
   - 优化内核参数

## 联系支持

如遇到部署问题，请联系技术支持团队或查看项目文档。