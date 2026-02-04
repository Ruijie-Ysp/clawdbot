# Moltbot Docker 日常使用指南

## 🚀 快速开始（每次使用）

### 1. 启动服务

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 启动（后台运行）
docker compose up -d moltbot-gateway

# 查看状态
docker compose ps
```

**预期输出**：
```
NAME                        STATUS              PORTS
moltbot-moltbot-gateway-1   Up 2 minutes        0.0.0.0:18789->18789/tcp
```

### 2. 访问 Web UI

打开浏览器，访问：
```
http://localhost:18789/?token=c13e4c31e46e3659c599e0e105710339
```

**建议**：将这个 URL 保存为浏览器书签！

### 3. 开始使用

- 💬 在 WebChat 中对话
- ⚙️ 查看配置
- 📊 查看会话历史
- 🔧 使用自定义 Skills

---

## 🔄 日常操作

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

# 最近 50 行
docker compose logs --tail=50 moltbot-gateway
```

### 查看运行状态

```bash
docker ps | grep moltbot
```

---

## 🛠️ 使用 CLI 工具

### 查看会话

```bash
docker compose run --rm moltbot-cli sessions list
```

### 查看状态

```bash
docker compose run --rm moltbot-cli status
```

### 查看 Skills

```bash
docker compose run --rm moltbot-cli skills list
```

### 发送测试消息

```bash
docker compose run --rm moltbot-cli agent --message "Hello"
```

---

## 🔧 配置修改

### 查看当前配置

```bash
cat ~/.moltbot/moltbot.json
```

### 修改配置

```bash
# 方式一：使用 CLI
docker compose run --rm moltbot-cli config set <key> <value>

# 方式二：直接编辑文件
vi ~/.moltbot/moltbot.json

# 方式三：在 IDE 中打开
open ~/.moltbot/moltbot.json
```

### 配置修改后重启

```bash
docker compose restart moltbot-gateway
```

---

## 💾 数据备份

### 快速备份

```bash
# 创建备份
tar -czf ~/moltbot-backup-$(date +%Y%m%d).tar.gz \
  ~/.moltbot \
  ~/clawd

# 查看备份
ls -lh ~/moltbot-backup-*.tar.gz
```

### 自动备份脚本

```bash
# 创建备份脚本
cat > ~/backup-moltbot.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/moltbot-backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d-%H%M%S)
tar -czf "$BACKUP_DIR/moltbot-$DATE.tar.gz" \
  ~/.moltbot \
  ~/clawd

echo "✅ 备份完成: $BACKUP_DIR/moltbot-$DATE.tar.gz"

# 只保留最近 7 天的备份
find "$BACKUP_DIR" -name "moltbot-*.tar.gz" -mtime +7 -delete
EOF

chmod +x ~/backup-moltbot.sh

# 运行备份
~/backup-moltbot.sh
```

---

## 🔄 更新 Moltbot

### 更新到最新版本

```bash
cd /Users/yangshengpeng/Desktop/openAI/moltbot

# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker build -t moltbot:local -f Dockerfile .

# 3. 重启服务
docker compose up -d moltbot-gateway

# 4. 查看日志确认
docker compose logs -f moltbot-gateway
```

---

## ❌ 停止并清理

### 完全停止

```bash
# 停止并删除容器
docker compose down

# 但数据仍然保留在：
# ~/.moltbot/
# ~/clawd/
```

### 清理 Docker 资源（可选）

```bash
# 删除镜像
docker rmi moltbot:local

# 清理未使用的资源
docker system prune -a
```

**注意**：这些操作不会删除你的数据！

---

## 🚨 故障排查

### 容器无法启动

```bash
# 查看错误日志
docker compose logs moltbot-gateway

# 检查端口占用
lsof -i :18789

# 杀掉占用端口的进程
kill -9 $(lsof -t -i :18789)

# 重新启动
docker compose up -d moltbot-gateway
```

### 无法访问 Web UI

```bash
# 1. 检查容器状态
docker ps | grep moltbot

# 2. 测试连接
curl http://localhost:18789/health

# 3. 查看日志
docker compose logs --tail=50 moltbot-gateway
```

### 配置文件错误

```bash
# 验证配置文件
docker compose run --rm moltbot-cli config show

# 如果有错误，恢复备份
cp ~/.moltbot/moltbot.json.bak ~/.moltbot/moltbot.json

# 重启服务
docker compose restart moltbot-gateway
```

---

## 📱 从其他设备访问

### 局域网访问

确保 `.env` 中设置：
```bash
CLAWDBOT_GATEWAY_BIND=0.0.0.0
```

然后重启：
```bash
docker compose up -d moltbot-gateway
```

访问地址（将 IP 替换为你的 Mac IP）：
```
http://192.168.x.x:18789/?token=c13e4c31e46e3659c599e0e105710339
```

---

## 🎯 快速命令参考

```bash
# 启动
docker compose up -d moltbot-gateway

# 停止
docker compose stop moltbot-gateway

# 重启
docker compose restart moltbot-gateway

# 查看日志
docker compose logs -f moltbot-gateway

# 查看状态
docker compose ps

# 备份数据
tar -czf ~/moltbot-backup.tar.gz ~/.moltbot ~/clawd

# 访问 Web UI
open "http://localhost:18789/?token=c13e4c31e46e3659c599e0e105710339"
```

---

## 🔖 常用 URL

### 本地访问
```
http://localhost:18789/?token=c13e4c31e46e3659c599e0e105710339
```

**建议**：保存为浏览器书签 → "Moltbot"

---

## ⚡ 快捷别名（可选）

添加到 `~/.zshrc` 或 `~/.bashrc`：

```bash
# Moltbot 快捷命令
alias moltbot-start='cd ~/Desktop/openAI/moltbot && docker compose up -d moltbot-gateway'
alias moltbot-stop='cd ~/Desktop/openAI/moltbot && docker compose stop moltbot-gateway'
alias moltbot-restart='cd ~/Desktop/openAI/moltbot && docker compose restart moltbot-gateway'
alias moltbot-logs='cd ~/Desktop/openAI/moltbot && docker compose logs -f moltbot-gateway'
alias moltbot-ui='open "http://localhost:18789/?token=c13e4c31e46e3659c599e0e105710339"'
alias moltbot-cli='cd ~/Desktop/openAI/moltbot && docker compose run --rm moltbot-cli'
alias moltbot-backup='tar -czf ~/moltbot-backup-$(date +%Y%m%d).tar.gz ~/.moltbot ~/clawd'
```

重新加载配置：
```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

使用：
```bash
moltbot-start    # 启动
moltbot-ui       # 打开 Web UI
moltbot-logs     # 查看日志
moltbot-backup   # 备份
```

---

## 📌 重要提醒

### 数据位置
```
~/.moltbot/      # 配置、会话、凭据、Skills
~/clawd/         # 工作空间

⚠️ 不要删除这些目录！
```

### Gateway Token
```
c13e4c31e46e3659c599e0e105710339
```

### 设备配对
✅ **已完成，无需重复操作**
配对信息保存在 `~/.moltbot/devices/paired.json`

---

## 🎉 总结

### 每次使用只需：

1. **启动服务**（如果没有运行）
   ```bash
   docker compose up -d moltbot-gateway
   ```

2. **打开浏览器**
   ```
   http://localhost:18789/?token=c13e4c31e46e3659c599e0e105710339
   ```

3. **开始使用** 🚀

就这么简单！
