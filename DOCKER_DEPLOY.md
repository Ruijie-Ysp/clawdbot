# Moltbot Docker 部署指南

本指南将帮助你将 Moltbot 迁移到 Docker 容器中运行，同时保留所有现有数据。

## 当前数据位置

根据你的系统检测，当前数据存储在：
- **配置目录**: `~/.clawdbot` → `~/.moltbot` (符号链接)
- **工作空间**: `~/clawd`

这些目录包含：
- 会话历史 (`~/.moltbot/sessions/`)
- 配置文件 (`~/.moltbot/moltbot.json`)
- 认证凭据 (`~/.moltbot/credentials/`)
- Agent 工作空间 (`~/clawd/`)

## 部署步骤

### 1. 备份现有数据（重要！）

```bash
# 创建备份目录
mkdir -p ~/moltbot-backup-$(date +%Y%m%d)

# 备份配置和会话
cp -r ~/.moltbot ~/moltbot-backup-$(date +%Y%m%d)/

# 备份工作空间
cp -r ~/clawd ~/moltbot-backup-$(date +%Y%m%d)/

echo "备份完成: ~/moltbot-backup-$(date +%Y%m%d)"
```

### 2. 停止现有的 Moltbot 进程

```bash
# 查找并停止运行中的 moltbot 进程
pkill -f "moltbot gateway" || true
pkill -f "node.*dist/index.js" || true

# 如果使用了 systemd 或 launchd 守护进程，也需要停止
# macOS (launchd):
launchctl unload ~/Library/LaunchAgents/bot.molt.gateway.plist 2>/dev/null || true

# Linux (systemd):
# systemctl --user stop moltbot-gateway
```

### 3. 配置环境变量

在项目根目录创建或编辑 `.env` 文件：

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 创建 .env 文件
cat > .env << 'EOF'
# 数据目录（使用现有数据位置）
CLAWDBOT_CONFIG_DIR=/Users/yangshengpeng/.moltbot
CLAWDBOT_WORKSPACE_DIR=/Users/yangshengpeng/clawd

# 网络配置
CLAWDBOT_GATEWAY_PORT=18789
CLAWDBOT_BRIDGE_PORT=18790
CLAWDBOT_GATEWAY_BIND=lan

# 如果你已经有 gateway token，在这里设置
# CLAWDBOT_GATEWAY_TOKEN=your-existing-token

# 如果需要安装额外的系统包（可选）
# CLAWDBOT_DOCKER_APT_PACKAGES="ffmpeg git"

# 镜像名称
CLAWDBOT_IMAGE=moltbot:local
EOF

echo ".env 文件已创建"
```

### 4. 构建 Docker 镜像

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 构建镜像（这可能需要几分钟）
docker build -t moltbot:local -f Dockerfile .
```

如果需要安装额外的系统包（如 ffmpeg、git 等）：

```bash
export CLAWDBOT_DOCKER_APT_PACKAGES="ffmpeg git curl"
docker build \
  --build-arg "CLAWDBOT_DOCKER_APT_PACKAGES=${CLAWDBOT_DOCKER_APT_PACKAGES}" \
  -t moltbot:local \
  -f Dockerfile .
```

### 5. 检查现有配置

在启动容器前，检查你的配置文件：

```bash
# 查看现有配置
cat ~/.moltbot/moltbot.json | head -50

# 检查是否有 gateway token
grep -i "gateway.*token" ~/.moltbot/moltbot.json || echo "未找到 gateway token"
```

如果配置中有 `gateway.bind` 设置为 `loopback`，需要修改为 `lan`，以便容器能够被访问：

```bash
# 备份原配置
cp ~/.moltbot/moltbot.json ~/.moltbot/moltbot.json.backup

# 如果需要，手动编辑配置文件
# 将 gateway.bind 从 "loopback" 改为 "lan"
```

### 6. 启动容器

#### 方式一：使用 docker-compose（推荐）

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 启动 gateway 服务
docker compose up -d moltbot-gateway

# 查看日志
docker compose logs -f moltbot-gateway
```

#### 方式二：使用自动化脚本

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 设置环境变量使用现有数据
export CLAWDBOT_CONFIG_DIR=/Users/yangshengpeng/.moltbot
export CLAWDBOT_WORKSPACE_DIR=/Users/yangshengpeng/clawd

# 运行设置脚本（会跳过 onboarding，因为配置已存在）
./docker-setup.sh
```

**注意**：如果 `docker-setup.sh` 尝试运行 onboarding，你可以按 Ctrl+C 跳过，因为你已经有配置了。

### 7. 手动启动（不使用脚本）

如果你想更多控制，可以手动启动：

```bash
# 启动 gateway
docker run -d \
  --name moltbot-gateway \
  --init \
  --restart unless-stopped \
  -p 18789:18789 \
  -p 18790:18790 \
  -v /Users/yangshengpeng/.moltbot:/home/node/.clawdbot \
  -v /Users/yangshengpeng/clawd:/home/node/clawd \
  -e HOME=/home/node \
  -e TERM=xterm-256color \
  moltbot:local \
  node dist/index.js gateway --bind lan --port 18789

# 查看日志
docker logs -f moltbot-gateway
```

### 8. 验证部署

```bash
# 检查容器状态
docker ps | grep moltbot

# 检查日志
docker compose logs moltbot-gateway | tail -50

# 测试 API（如果设置了 token）
curl http://localhost:18789/health

# 进入容器检查数据
docker compose exec moltbot-gateway ls -la /home/node/.clawdbot
docker compose exec moltbot-gateway ls -la /home/node/clawd
```

### 9. 使用 CLI 工具

```bash
# 查看会话
docker compose run --rm moltbot-cli sessions list

# 查看状态
docker compose run --rm moltbot-cli status

# 发送消息（测试）
docker compose run --rm moltbot-cli agent --message "Hello from Docker!"
```

## 访问控制面板

如果你的配置中启用了 Web UI：

1. 打开浏览器访问: `http://localhost:18789`
2. 如果需要 token，使用配置文件中的 `gateway.auth.token`
3. 或者从日志中获取 token：
   ```bash
   docker compose logs moltbot-gateway | grep -i token
   ```

## 数据持久化说明

你的所有数据通过 Docker volume 挂载，存储在宿主机上：

- **配置**: `~/.moltbot` → 容器内 `/home/node/.clawdbot`
- **工作空间**: `~/clawd` → 容器内 `/home/node/clawd`
- **会话历史**: `~/.moltbot/sessions/` → 保留所有历史记录
- **凭据**: `~/.moltbot/credentials/` → WhatsApp、Telegram 等凭据

**重要**：即使删除容器，数据依然保存在宿主机上，不会丢失。

## 常用操作

### 重启服务

```bash
docker compose restart moltbot-gateway
```

### 停止服务

```bash
docker compose stop moltbot-gateway
```

### 查看日志

```bash
# 实时日志
docker compose logs -f moltbot-gateway

# 最近 100 行
docker compose logs --tail=100 moltbot-gateway
```

### 更新镜像

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 拉取最新代码
git pull

# 重新构建镜像
docker build -t moltbot:local -f Dockerfile .

# 重启服务
docker compose up -d moltbot-gateway
```

### 进入容器调试

```bash
# 进入运行中的容器
docker compose exec moltbot-gateway /bin/bash

# 或使用 sh
docker compose exec moltbot-gateway /bin/sh
```

### 备份容器数据

```bash
# 即使在容器中运行，数据仍在宿主机，可以直接备份
tar -czf moltbot-data-$(date +%Y%m%d).tar.gz \
  ~/.moltbot \
  ~/clawd
```

## 高级配置

### 添加额外的挂载目录

如果你需要访问其他目录（如代码仓库）：

```bash
export CLAWDBOT_EXTRA_MOUNTS="$HOME/projects:/home/node/projects:rw,$HOME/.ssh:/home/node/.ssh:ro"
./docker-setup.sh
```

### 使用 Docker 卷持久化整个 HOME

```bash
export CLAWDBOT_HOME_VOLUME="moltbot_home"
./docker-setup.sh
```

### 网络配置

如果需要从其他设备访问：

```bash
# 编辑 .env 文件
echo "CLAWDBOT_GATEWAY_BIND=0.0.0.0" >> .env

# 重启服务
docker compose up -d moltbot-gateway
```

**安全提示**：如果绑定到 `0.0.0.0`，确保设置了强 token 密码！

## 故障排查

### 容器无法启动

```bash
# 查看详细错误
docker compose logs moltbot-gateway

# 检查端口占用
lsof -i :18789
```

### 数据未正确挂载

```bash
# 检查挂载
docker compose exec moltbot-gateway ls -la /home/node/.clawdbot
docker compose exec moltbot-gateway cat /home/node/.clawdbot/moltbot.json
```

### 权限问题

```bash
# 容器以 node 用户（uid 1000）运行
# 确保宿主机目录可被访问
chmod -R 755 ~/.moltbot
chmod -R 755 ~/clawd
```

### 重置并重新部署

```bash
# 停止并删除容器
docker compose down

# 删除镜像
docker rmi moltbot:local

# 重新开始
docker build -t moltbot:local -f Dockerfile .
docker compose up -d moltbot-gateway
```

## 迁移回非容器部署

如果需要回退到直接运行：

```bash
# 停止容器
docker compose down

# 数据已经在宿主机上，直接使用
cd /Users/yangshengpeng/Desktop/openAI/moltbot
pnpm moltbot gateway --bind lan --port 18789
```

## 总结

你的部署流程：

1. ✅ 备份现有数据
2. ✅ 停止现有进程
3. ✅ 配置环境变量（指向现有数据目录）
4. ✅ 构建 Docker 镜像
5. ✅ 启动容器（数据自动挂载）
6. ✅ 验证服务正常

所有现有数据（会话历史、配置、凭据、工作空间）都会继续使用，无需任何迁移或转换。
