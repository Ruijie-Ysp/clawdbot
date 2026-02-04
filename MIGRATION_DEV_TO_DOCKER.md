# 从开发模式迁移到 Docker 部署

## 🔍 当前运行状态分析

你现在运行的是**开发模式**：

```
当前运行的服务：
├── 前端（Vite 开发服务器）
│   ├── 端口: 5173
│   ├── 访问: http://localhost:5173
│   ├── 进程: vite dev server
│   └── 特点: 热重载（HMR），快速刷新
│
└── 后端（Gateway 服务）
    ├── 端口: 18789
    ├── 进程: moltbot-gateway
    ├── 启动命令: pnpm gateway:dev
    └── 特点: 跳过频道加载（CLAWDBOT_SKIP_CHANNELS=1）
```

---

## 🔄 迁移到 Docker 的变化

### 开发模式 vs Docker 模式对比

| 特性 | 开发模式（当前） | Docker 模式（部署后） |
|------|----------------|---------------------|
| 前端访问 | `http://localhost:5173` | `http://localhost:18789` |
| 后端访问 | `ws://localhost:18789` | `ws://localhost:18789` |
| 前端服务器 | Vite dev server | Gateway 内置（生产构建） |
| 热重载 | ✅ 支持 | ❌ 不支持（需要重建镜像） |
| 启动方式 | 两个命令（ui:dev + gateway:dev） | 一个命令（docker compose up） |
| 数据位置 | `~/.moltbot`, `~/clawd` | `~/.moltbot`, `~/clawd` (完全相同) |
| 适用场景 | 开发调试、修改代码 | 生产使用、稳定运行 |

---

## 🎯 关键差异：访问地址变化

### 开发模式（当前）
```
http://localhost:5173  ← 前端（Vite dev server）
          ↓
   通过代理连接到
          ↓
ws://localhost:18789   ← 后端（Gateway）
```

### Docker 模式（部署后）
```
http://localhost:18789  ← 前端 + 后端（集成）
```

**⚠️ 重点：访问地址从 5173 变成 18789**

---

## 📝 完整迁移步骤

### 步骤 1: 停止当前的开发服务

#### 方法一：在终端按 Ctrl+C（如果还在前台运行）

#### 方法二：使用命令停止

```bash
# 停止前端（Vite）
pkill -f vite

# 停止后端（Gateway）
pkill -f "moltbot-gateway"
pkill -f "pnpm gateway:dev"

# 验证已停止
ps aux | grep -E "(vite|moltbot)" | grep -v grep
# 应该没有输出
```

### 步骤 2: 部署 Docker

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 一键部署（会自动备份数据）
./deploy-docker.sh
```

**脚本会自动**：
- ✅ 检测现有数据（`~/.moltbot/`, `~/clawd/`）
- ✅ 备份数据到 `~/moltbot-backup-<时间戳>/`
- ✅ 构建 Docker 镜像（包含前端构建）
- ✅ 启动容器
- ✅ 显示新的访问地址

### 步骤 3: 访问新地址

**旧地址（停用）**：
```
http://localhost:5173
```

**新地址（使用这个）**：
```
http://localhost:18789
```

---

## ✅ 数据完全保留确认

你的所有数据都会被保留：

```bash
# 模型配置（DeepSeek、Kimi API Keys）
~/.moltbot/moltbot.json  ✅

# 会话历史
~/.moltbot/agents/main/sessions/*.jsonl  ✅

# 自定义 Skills
~/.moltbot/skills/medical-doc-upload/  ✅

# 频道凭据
~/.moltbot/credentials/  ✅

# 工作空间配置
~/clawd/  ✅
```

Docker 容器通过 volume 挂载这些目录，**数据位置完全不变**！

---

## 🎨 界面功能对比

### 开发模式（5173）
- Web UI 控制面板
- WebChat 聊天界面
- 实时热重载
- 开发者工具

### Docker 模式（18789）
- ✅ Web UI 控制面板（相同）
- ✅ WebChat 聊天界面（相同）
- ✅ 所有功能（相同）
- ❌ 无热重载（生产模式）

**界面和功能完全一样，只是构建方式不同！**

---

## 🔄 如果需要两种模式共存

### 方案一：使用不同端口

```bash
# 开发模式（保持默认）
# 前端: 5173
# 后端: 18789

# Docker 使用不同端口
# 编辑 .env:
CLAWDBOT_GATEWAY_PORT=18800

# 启动 Docker
docker compose up -d moltbot-gateway

# 这样可以同时运行：
# 开发: http://localhost:5173
# Docker: http://localhost:18800
```

**问题**：两个 Gateway 可能会竞争数据访问

### 方案二：使用不同数据目录（推荐共存）

```bash
# Docker 使用独立数据目录
export CLAWDBOT_CONFIG_DIR=$HOME/.moltbot-docker
export CLAWDBOT_WORKSPACE_DIR=$HOME/clawd-docker

# 启动 Docker
docker compose up -d moltbot-gateway

# 开发环境继续使用原数据
pnpm ui:dev
pnpm gateway:dev
```

### 方案三：按需切换（最简单）

创建切换脚本：

```bash
# 开发模式
cat > ~/dev-mode.sh << 'EOF'
#!/bin/bash
docker compose down
cd /Users/yangshengpeng/Desktop/openAI/moltbot
pnpm ui:dev &
sleep 2
pnpm gateway:dev
EOF
chmod +x ~/dev-mode.sh

# Docker 模式
cat > ~/docker-mode.sh << 'EOF'
#!/bin/bash
pkill -f vite
pkill -f moltbot-gateway
cd /Users/yangshengpeng/Desktop/openAI/moltbot
docker compose up -d moltbot-gateway
echo "访问: http://localhost:18789"
EOF
chmod +x ~/docker-mode.sh
```

---

## 🚀 推荐操作流程

### 如果你主要是使用 Moltbot（不开发）

**强烈建议直接切换到 Docker**：

```bash
# 1. 停止开发服务
pkill -f vite
pkill -f moltbot-gateway

# 2. 一键部署
cd /Users/yangshengpeng/Desktop/openAI/moltbot
./deploy-docker.sh

# 3. 更新浏览器书签
# 旧: http://localhost:5173
# 新: http://localhost:18789

# 4. 完成！
```

**以后每次重启后只需要**：
```bash
# 如果容器没有自动启动
docker compose up -d moltbot-gateway
```

---

## 🎯 总结

### 回答你的问题

**Q: docker compose up 是不是前端和后端都启动了？**
✅ **是的！**

**Q: 本地不需要再做任何操作吧？**
✅ **对的！除了：**
1. 停止当前的开发服务（vite 和 gateway）
2. 改用新地址访问：`http://localhost:18789`（而不是 5173）

---

## ⚠️ 重要提醒

### 访问地址变化

```
开发模式: http://localhost:5173
         ↓
       迁移后
         ↓
Docker模式: http://localhost:18789
```

### 数据位置不变

```
~/.moltbot/  ← 配置、会话、Skills
~/clawd/     ← 工作空间

完全相同，无需担心！
```

---

**准备好了吗？运行下面的命令开始迁移：**

```bash
# 停止开发服务
pkill -f vite && pkill -f moltbot-gateway

# 一键部署 Docker
cd /Users/yangshengpeng/Desktop/openAI/moltbot && ./deploy-docker.sh
```

迁移后，在浏览器访问：`http://localhost:18789` 🎉
