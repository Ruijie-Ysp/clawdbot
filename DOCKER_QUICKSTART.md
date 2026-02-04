# Moltbot Docker 部署 - 快速开始

## 一键部署（推荐）

最简单的方式，自动完成所有操作：

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot
./deploy-docker.sh
```

这个脚本会自动：

- ✅ 检测并备份你的现有数据
- ✅ 停止当前运行的 Moltbot
- ✅ 构建 Docker 镜像
- ✅ 启动容器（自动挂载你的数据）
- ✅ 验证部署成功

完成后，你的所有数据（会话、配置、凭据）都会继续使用，无需任何迁移！

## 手动部署

如果你想更多控制，可以手动执行：

### 1. 创建配置文件

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

cat > .env << 'EOF'
CLAWDBOT_CONFIG_DIR=/Users/yangshengpeng/.moltbot
CLAWDBOT_WORKSPACE_DIR=/Users/yangshengpeng/clawd
CLAWDBOT_GATEWAY_PORT=18789
CLAWDBOT_GATEWAY_BIND=lan
CLAWDBOT_IMAGE=moltbot:local
EOF
```

### 2. 构建镜像

```bash
docker build -t moltbot:local -f Dockerfile .
```

### 3. 启动服务

```bash
docker compose up -d moltbot-gateway
```

### 4. 查看日志

```bash
docker compose logs -f moltbot-gateway
```

## 访问控制面板

打开浏览器访问: `http://localhost:18789`

如果需要 token，查看日志获取：

```bash
docker compose logs moltbot-gateway | grep -i token
```

## 常用命令

```bash
# 查看状态
docker compose ps

# 查看日志
docker compose logs -f moltbot-gateway

# 重启服务
docker compose restart moltbot-gateway

# 停止服务
docker compose stop moltbot-gateway

# 使用 CLI
docker compose run --rm moltbot-cli sessions list
docker compose run --rm moltbot-cli status
```

## 数据位置

你的所有数据都安全地保存在宿主机上：

- **配置**: `~/.moltbot` (包含会话历史、配置文件、凭据)
- **工作空间**: `~/clawd` (Agent 工作目录)

即使删除容器，数据也不会丢失！

## 更新 Moltbot

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker build -t moltbot:local -f Dockerfile .

# 3. 重启服务
docker compose up -d moltbot-gateway
```

## 故障排查

### 容器没有启动？

```bash
# 查看错误日志
docker compose logs moltbot-gateway

# 检查端口占用
lsof -i :18789
```

### 无法访问 Web UI？

```bash
# 测试连接
curl http://localhost:18789/health

# 检查容器是否运行
docker ps | grep moltbot
```

### 数据不见了？

```bash
# 检查挂载
docker compose exec moltbot-gateway ls -la /home/node/.clawdbot
docker compose exec moltbot-gateway ls -la /home/node/clawd

# 验证配置
cat .env | grep DIR
```

## 完整文档

- 📘 详细部署指南: `DOCKER_DEPLOY.md`
- 📋 快速参考手册: `DOCKER_CHEATSHEET.md`
- 🌐 在线文档: https://docs.molt.bot/install/docker

## 获取帮助

如果遇到问题：

1. 查看日志: `docker compose logs -f moltbot-gateway`
2. 查看文档: `cat DOCKER_DEPLOY.md`
3. 提交 Issue: https://github.com/moltbot/moltbot/issues
