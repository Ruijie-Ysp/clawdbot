# Moltbot 数据位置和备份指南

## 📁 核心问题解答

### Q1: moltbot 项目目录是否需要永久保留？

**简短回答**: 不需要永久保留，但建议保留。

**详细说明**:

```
/Users/yangshengpeng/Desktop/openAI/moltbot/  ← 项目源码目录
```

**用途**:

- ✅ 构建 Docker 镜像
- ✅ 更新代码时重新构建
- ✅ 查看文档和脚本

**可以删除的时机**:

- Docker 镜像已构建完成
- 不需要更新或修改代码

**建议保留的原因**:

1. 更新 Moltbot 需要重新构建镜像
2. 包含有用的脚本和文档
3. 便于排查问题和自定义配置

**迁移策略**:

```bash
# 可以移动到其他位置
mv /Users/yangshengpeng/Desktop/openAI/moltbot ~/Documents/moltbot-source

# 或者打包备份
tar -czf moltbot-source-$(date +%Y%m%d).tar.gz moltbot/
```

---

### Q2: 真正重要的数据在哪里？

## 🔐 核心数据目录（必须永久保留）

### 1. 配置和数据目录: `~/.moltbot/` (156KB)

```
~/.moltbot/
├── moltbot.json              # ⭐ 核心配置文件
│   ├── 模型配置（DeepSeek、Kimi等）
│   ├── API Keys（sk-012bb9cbd0a74220993bb6401e5cca35等）
│   ├── Gateway认证token
│   └── Agent配置
│
├── agents/                   # ⭐ Agent和会话数据
│   └── main/                 # 主Agent
│       └── sessions/         # ⭐ 所有对话历史
│           ├── *.jsonl       # 会话历史记录（JSONL格式）
│           └── sessions.json # 会话索引和元数据
│
├── credentials/              # ⭐ 认证凭据
│   ├── WhatsApp登录信息
│   ├── Telegram bot token
│   └── 其他频道凭据
│
├── skills/                   # ⭐ 自定义Skills
│   └── medical-doc-upload/   # 你的医疗文档上传skill
│       ├── SKILL.md
│       ├── scripts/
│       ├── assets/
│       └── references/
│
├── identity/                 # 身份配置
├── cron/                     # 定时任务配置
├── devices/                  # 设备配置
├── sandbox/                  # 沙箱配置
├── subagents/                # 子Agent配置
└── exec-approvals.json       # 执行审批记录
```

**大小**: 约 156KB（会随着使用增长）

### 2. 工作空间目录: `~/clawd/` (64KB)

```
~/clawd/
├── AGENTS.md                 # Agent配置文档
├── IDENTITY.md               # 身份定义
├── SOUL.md                   # Agent人格配置
├── TOOLS.md                  # 工具配置
├── BOOTSTRAP.md              # 启动配置
├── USER.md                   # 用户配置
├── HEARTBEAT.md              # 心跳配置
├── canvas/                   # Canvas相关
└── skills/                   # 工作空间级别的skills（如果有）
    └── (你可以在这里添加工作空间专用的skills)
```

---

## 🎯 Docker 挂载映射

当你运行 Docker 容器时，这些重要数据都会被正确挂载：

```yaml
volumes:
  # 配置目录 - 所有配置、会话、凭据
  - ~/.moltbot:/home/node/.clawdbot

  # 工作空间 - Agent配置和工作文件
  - ~/clawd:/home/node/clawd
```

### 数据流转示意图

```
宿主机                          Docker容器
┌────────────────────┐         ┌─────────────────────┐
│ ~/.moltbot/        │ ←────→ │ /home/node/.clawdbot│
│  ├── moltbot.json  │  挂载   │  ├── moltbot.json   │
│  ├── agents/       │ ←────→ │  ├── agents/        │
│  ├── credentials/  │         │  ├── credentials/   │
│  └── skills/       │         │  └── skills/        │
└────────────────────┘         └─────────────────────┘

┌────────────────────┐         ┌─────────────────────┐
│ ~/clawd/           │ ←────→ │ /home/node/clawd/   │
│  ├── AGENTS.md     │  挂载   │  ├── AGENTS.md      │
│  ├── SOUL.md       │ ←────→ │  ├── SOUL.md        │
│  └── skills/       │         │  └── skills/        │
└────────────────────┘         └─────────────────────┘
```

---

## ✅ Docker 部署已完全考虑数据保护

我创建的 `deploy-docker.sh` 脚本已经完全考虑了这些：

### 1. 自动检测数据位置

```bash
# 脚本会自动检测
if [ -d "$HOME/.moltbot" ]; then
    MOLTBOT_CONFIG_DIR="$HOME/.moltbot"
    info "✓ 发现配置目录: $MOLTBOT_CONFIG_DIR"
fi
```

### 2. 自动备份

```bash
# 部署前自动备份
BACKUP_DIR="$HOME/moltbot-backup-$(date +%Y%m%d-%H%M%S)"
cp -r "$MOLTBOT_CONFIG_DIR" "$BACKUP_DIR/config"
cp -r "$MOLTBOT_WORKSPACE_DIR" "$BACKUP_DIR/workspace"
```

### 3. 正确挂载

```bash
# .env 配置会正确指向数据目录
CLAWDBOT_CONFIG_DIR=/Users/yangshengpeng/.moltbot
CLAWDBOT_WORKSPACE_DIR=/Users/yangshengpeng/clawd
```

---

## 🔒 关键数据清单

### 必须永久保留的数据

| 文件/目录                   | 内容                              | 重要性     | 位置                 |
| --------------------------- | --------------------------------- | ---------- | -------------------- |
| `moltbot.json`              | 模型配置、API Keys、Gateway Token | ⭐⭐⭐⭐⭐ | `~/.moltbot/`        |
| `agents/*/sessions/*.jsonl` | 所有对话历史                      | ⭐⭐⭐⭐⭐ | `~/.moltbot/agents/` |
| `credentials/`              | 频道认证信息                      | ⭐⭐⭐⭐⭐ | `~/.moltbot/`        |
| `skills/`                   | 自定义Skills                      | ⭐⭐⭐⭐   | `~/.moltbot/`        |
| `~/clawd/`                  | 工作空间配置                      | ⭐⭐⭐⭐   | `~/clawd/`           |
| `identity/`                 | 身份配置                          | ⭐⭐⭐     | `~/.moltbot/`        |
| `cron/`                     | 定时任务                          | ⭐⭐⭐     | `~/.moltbot/`        |

### 你当前的重要数据

根据检测，你的数据包括：

1. **模型配置** ✅
   - DeepSeek API Key: `sk-012bb9cbd0a74220993bb6401e5cca35`
   - Moonshot (Kimi) API Key: `sk-5odABEWlAoXTQdDhErSqAdwp60RK6gReiAtRxnAlbcyFCZLd`
   - Gateway Token: `c13e4c31e46e3659c599e0e105710339`

2. **会话历史** ✅
   - 位置: `~/.moltbot/agents/main/sessions/`
   - 文件: `cd1d2431-e4b6-4bd0-b3ae-8b3f9b7b414a.jsonl` (10行历史)
   - 索引: `sessions.json` (14KB)

3. **自定义Skills** ✅
   - `medical-doc-upload` (84KB)
   - 包含脚本、资源、文档

4. **工作空间配置** ✅
   - `~/clawd/` 目录下所有配置文件

---

## 💾 备份策略推荐

### 方案一：简单备份（推荐）

```bash
#!/bin/bash
# 创建备份脚本
cat > ~/backup-moltbot.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/moltbot-backups/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "开始备份 Moltbot 数据..."

# 备份配置和数据
tar -czf "$BACKUP_DIR/moltbot-config.tar.gz" -C "$HOME" .moltbot

# 备份工作空间
tar -czf "$BACKUP_DIR/moltbot-workspace.tar.gz" -C "$HOME" clawd

# 保存备份信息
cat > "$BACKUP_DIR/backup-info.txt" << INFO
备份时间: $(date)
配置目录: ~/.moltbot
工作空间: ~/clawd
备份大小: $(du -sh "$BACKUP_DIR" | cut -f1)
INFO

echo "✓ 备份完成: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
EOF

chmod +x ~/backup-moltbot.sh
```

**使用**:

```bash
# 手动备份
~/backup-moltbot.sh

# 或设置定时备份（每天凌晨3点）
crontab -e
# 添加: 0 3 * * * /Users/yangshengpeng/backup-moltbot.sh
```

### 方案二：增量备份（高级）

```bash
# 使用 rsync 增量备份
rsync -avz --delete ~/.moltbot/ ~/Backups/moltbot-config/
rsync -avz --delete ~/clawd/ ~/Backups/moltbot-workspace/
```

### 方案三：Git版本控制

```bash
# 对配置文件使用Git（注意：排除敏感信息）
cd ~/.moltbot
git init
cat > .gitignore << 'EOF'
# 排除敏感信息
moltbot.json
credentials/
*.log
*.bak
EOF

git add .
git commit -m "Initial backup"
```

---

## 🔄 恢复数据

### 从备份恢复

```bash
# 停止容器
docker compose down

# 恢复配置
tar -xzf backup-20260129/moltbot-config.tar.gz -C "$HOME"

# 恢复工作空间
tar -xzf backup-20260129/moltbot-workspace.tar.gz -C "$HOME"

# 重启容器
docker compose up -d moltbot-gateway
```

### 迁移到新机器

```bash
# 在旧机器上
tar -czf moltbot-all-data.tar.gz ~/.moltbot ~/clawd

# 传输到新机器
scp moltbot-all-data.tar.gz user@new-host:~/

# 在新机器上
tar -xzf moltbot-all-data.tar.gz -C "$HOME"
cd /path/to/moltbot-source
./deploy-docker.sh
```

---

## 📊 数据增长预估

| 数据类型 | 初始大小   | 增长速度 | 预计大小（1年） |
| -------- | ---------- | -------- | --------------- |
| 配置文件 | ~10KB      | 极慢     | ~15KB           |
| 会话历史 | ~20KB      | 中等     | ~500MB-5GB      |
| Skills   | ~84KB      | 慢       | ~200KB-1MB      |
| 凭据     | ~1KB       | 极慢     | ~2KB            |
| 工作空间 | ~64KB      | 慢       | ~500KB-5MB      |
| **总计** | **~180KB** | -        | **~500MB-5GB**  |

**说明**: 主要增长来自会话历史，取决于使用频率。

---

## 🎯 总结

### 必须永久保留的数据

✅ **`~/.moltbot/`** - 所有配置、会话、凭据、skills
✅ **`~/clawd/`** - 工作空间配置

### 可以删除的内容

❌ `/Users/yangshengpeng/Desktop/openAI/moltbot/` - 项目源码（建议保留但不是必须）
❌ Docker镜像（可以重新构建）
❌ 容器（可以重新创建）

### Docker部署数据保护

✅ 所有重要数据通过 volume 挂载到宿主机
✅ 部署脚本自动检测和挂载数据目录
✅ 容器删除不影响数据
✅ 支持随时备份和恢复

### 最佳实践

1. **定期备份** `~/.moltbot/` 和 `~/clawd/`
2. **保留项目源码**以便更新
3. **使用 Git 管理**工作空间配置（排除敏感信息）
4. **测试恢复流程**确保备份可用

---

## 🔧 快速检查数据完整性

```bash
# 检查核心文件
echo "检查核心数据文件..."
ls -lh ~/.moltbot/moltbot.json
ls -lh ~/.moltbot/agents/main/sessions/
ls -lh ~/.moltbot/skills/
ls -lh ~/clawd/

# 检查数据大小
echo -e "\n数据大小:"
du -sh ~/.moltbot
du -sh ~/clawd

# 检查会话数量
echo -e "\n会话数量:"
ls ~/.moltbot/agents/main/sessions/*.jsonl 2>/dev/null | wc -l
```

运行这个命令验证你的数据都在！
