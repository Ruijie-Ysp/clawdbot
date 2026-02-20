# Docker Compose 启动说明

## ✅ 简短回答

**是的！`docker compose up -d moltbot-gateway` 会同时启动前端和后端，本地不需要任何其他操作。**

---

## 🎯 完整说明

### 架构设计

Moltbot 采用**单体架构**，前端（Web UI）内置在 Gateway 服务中：

```
┌─────────────────────────────────────┐
│   Moltbot Gateway Container         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Backend (Gateway Server)   │  │
│  │   - WebSocket 服务           │  │
│  │   - API 端点                 │  │
│  │   - 频道连接                 │  │
│  │   - Agent 执行               │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Frontend (Web UI)          │  │
│  │   - Control UI (控制面板)    │  │
│  │   - WebChat (聊天界面)       │  │
│  │   - 静态资源                 │  │
│  └──────────────────────────────┘  │
│                                     │
│  同一进程，同一端口: 18789          │
└─────────────────────────────────────┘
```

### 构建过程（已包含在镜像中）

看 `Dockerfile` 的构建步骤：

```dockerfile
# 第27行：构建后端
RUN CLAWDBOT_A2UI_SKIP_MISSING=1 pnpm build

# 第30-31行：安装和构建前端
RUN pnpm ui:install
RUN pnpm ui:build
```

**这意味着**：

- ✅ 镜像构建时已经编译了后端（TypeScript → JavaScript）
- ✅ 镜像构建时已经构建了前端（Vite → 静态文件）
- ✅ 前端静态文件被打包进镜像，由 Gateway 服务提供

---

## 🚀 启动命令

### 方式一：自动启动（推荐）

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 后台启动
docker compose up -d moltbot-gateway
```

**这个命令会**：

- ✅ 启动 Gateway 服务（后端）
- ✅ 自动提供 Web UI（前端）
- ✅ 暴露端口 18789（前后端共用）
- ✅ 暴露端口 18790（Bridge端口）
- ✅ 设置自动重启（`restart: unless-stopped`）

### 方式二：查看日志启动

```bash
# 前台启动（查看实时日志）
docker compose up moltbot-gateway
```

### 方式三：使用部署脚本（最简单）

```bash
# 一键部署
./deploy-docker.sh
```

---

## 🌐 访问方式

启动后，直接在浏览器访问：

```
http://localhost:18789
```

**你会看到**：

- 🎨 Control UI（控制面板）
- 💬 WebChat（聊天界面）
- ⚙️ 配置界面

**如果需要 Token**：

```bash
# 查看 token
cat .env | grep CLAWDBOT_GATEWAY_TOKEN

# 或从日志获取
docker compose logs moltbot-gateway | grep -i token
```

---

## 📋 服务说明

### 启动的服务

```yaml
moltbot-gateway: # ✅ 自动启动
  - 后端服务（Gateway Server）
  - 前端服务（Web UI）
  - WebSocket 服务
  - 端口：18789, 18790

moltbot-cli: # ❌ 不自动启动（按需使用）
  - 命令行工具
  - 手动运行：docker compose run --rm moltbot-cli <command>
```

### 端口映射

| 宿主机端口 | 容器端口 | 用途               |
| ---------- | -------- | ------------------ |
| 18789      | 18789    | Gateway + Web UI   |
| 18790      | 18790    | Bridge（设备连接） |

---

## ✅ 本地不需要的操作

以下操作**完全不需要**：

❌ 单独启动前端服务器（如 `npm run dev`）
❌ 单独构建前端（如 `npm run build`）
❌ 配置 Nginx 或其他反向代理
❌ 安装 Node.js 或其他运行时环境
❌ 手动启动后端服务

**原因**：所有这些都已经在 Docker 镜像中完成了！

---

## 🔍 验证启动

### 1. 检查容器状态

```bash
docker ps | grep moltbot
```

**预期输出**：

```
CONTAINER ID   IMAGE          COMMAND                  STATUS         PORTS
abc123def456   moltbot:local  "node dist/index.js …"   Up 2 minutes   0.0.0.0:18789->18789/tcp
```

### 2. 检查日志

```bash
docker compose logs -f moltbot-gateway
```

**预期看到**：

```
[INFO] Gateway server started
[INFO] Listening on http://0.0.0.0:18789
[INFO] Web UI available at http://localhost:18789
```

### 3. 测试访问

```bash
# 测试 API
curl http://localhost:18789/health

# 预期返回：{"status":"ok"}
```

### 4. 浏览器访问

打开浏览器：`http://localhost:18789`

应该能看到 Moltbot 的控制面板界面。

---

## 🎨 Web UI 功能

访问 `http://localhost:18789` 后你可以：

### 控制面板功能

- 📊 查看 Gateway 状态
- 📨 查看消息历史
- 🔧 管理频道连接
- 👥 查看会话列表
- ⚙️ 配置设置
- 📈 查看统计信息

### WebChat 功能

- 💬 直接在浏览器与 AI 对话
- 📎 上传文件和图片
- 📝 查看对话历史
- 🔄 切换模型

---

## 🛠️ 常见问题

### Q1: 启动后无法访问 18789 端口？

**检查容器状态**：

```bash
docker ps | grep moltbot
```

**查看日志**：

```bash
docker compose logs moltbot-gateway
```

**检查端口占用**：

```bash
lsof -i :18789
```

**解决方法**：

- 如果端口被占用，修改 `.env` 中的 `CLAWDBOT_GATEWAY_PORT`
- 重启容器：`docker compose restart moltbot-gateway`

### Q2: 需要 Token 但不知道在哪里？

```bash
# 查看 .env 文件
cat .env | grep GATEWAY_TOKEN

# 或查看配置文件
docker compose exec moltbot-gateway cat /home/node/.clawdbot/moltbot.json | grep token
```

### Q3: 修改了前端代码，如何更新？

```bash
# 需要重新构建镜像
docker build -t moltbot:local -f Dockerfile .

# 重启服务
docker compose up -d moltbot-gateway
```

### Q4: 可以从其他设备访问吗？

可以！但需要修改 bind 设置：

```bash
# 编辑 .env 文件
echo "CLAWDBOT_GATEWAY_BIND=0.0.0.0" >> .env

# 重启服务
docker compose up -d moltbot-gateway
```

然后用宿主机的 IP 访问：`http://<宿主机IP>:18789`

⚠️ **安全提示**：对外暴露时，确保设置了强 Token！

---

## 📊 服务架构对比

### 传统分离式架构（需要多个服务）

```
前端服务器 (Vite/Nginx) :3000  ←→  后端服务 :18789
     ↓                                  ↓
  需要单独启动                      需要单独启动
  需要配置反向代理                  需要配置CORS
```

### Moltbot 集成式架构（单一服务）✅

```
Gateway Container :18789
    ├── 后端 API
    └── 前端静态文件

只需要启动一个容器！
```

---

## 🎯 总结

### 你需要做的：

1. **构建镜像**（一次）：

   ```bash
   docker build -t moltbot:local -f Dockerfile .
   ```

2. **启动服务**（每次重启后）：

   ```bash
   docker compose up -d moltbot-gateway
   ```

3. **访问界面**：
   ```bash
   打开浏览器：http://localhost:18789
   ```

### 你不需要做的：

❌ 启动前端开发服务器
❌ 构建前端资源
❌ 配置反向代理
❌ 管理多个服务
❌ 担心前后端通信

**一切都已集成在 Gateway 服务中！** 🎉

---

## 🚀 快速开始清单

- [ ] 运行 `./deploy-docker.sh` 或手动构建镜像
- [ ] 运行 `docker compose up -d moltbot-gateway`
- [ ] 检查容器状态：`docker ps`
- [ ] 打开浏览器访问：`http://localhost:18789`
- [ ] 输入 Token（如果需要）
- [ ] 开始使用！

就这么简单！🎉
