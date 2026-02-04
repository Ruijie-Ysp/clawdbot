#!/usr/bin/env bash
#
# Moltbot Docker 快速部署脚本
# 保留现有数据，将 Moltbot 迁移到 Docker 容器运行
#

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*"
    exit 1
}

# 检测项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

info "开始 Moltbot Docker 部署..."

# 1. 检查依赖
info "检查系统依赖..."
if ! command -v docker &> /dev/null; then
    error "Docker 未安装，请先安装 Docker Desktop 或 Docker Engine"
fi

if ! docker compose version &> /dev/null 2>&1; then
    error "Docker Compose 不可用，请确保已安装 Docker Compose v2"
fi

info "✓ Docker 和 Docker Compose 已安装"

# 2. 检测现有数据
MOLTBOT_CONFIG_DIR=""
MOLTBOT_WORKSPACE_DIR=""

# 检测配置目录
if [ -d "$HOME/.moltbot" ]; then
    MOLTBOT_CONFIG_DIR="$HOME/.moltbot"
    info "✓ 发现配置目录: $MOLTBOT_CONFIG_DIR"
elif [ -L "$HOME/.clawdbot" ]; then
    MOLTBOT_CONFIG_DIR="$(readlink -f "$HOME/.clawdbot" 2>/dev/null || readlink "$HOME/.clawdbot")"
    info "✓ 发现配置目录（符号链接): $MOLTBOT_CONFIG_DIR"
elif [ -d "$HOME/.clawdbot" ]; then
    MOLTBOT_CONFIG_DIR="$HOME/.clawdbot"
    info "✓ 发现配置目录: $MOLTBOT_CONFIG_DIR"
else
    warn "未发现配置目录，将创建新的配置"
    MOLTBOT_CONFIG_DIR="$HOME/.moltbot"
    mkdir -p "$MOLTBOT_CONFIG_DIR"
fi

# 检测工作空间
if [ -d "$HOME/clawd" ]; then
    MOLTBOT_WORKSPACE_DIR="$HOME/clawd"
    info "✓ 发现工作空间: $MOLTBOT_WORKSPACE_DIR"
else
    warn "未发现工作空间，将创建新的工作空间"
    MOLTBOT_WORKSPACE_DIR="$HOME/clawd"
    mkdir -p "$MOLTBOT_WORKSPACE_DIR"
fi

# 3. 备份现有数据
BACKUP_DIR="$HOME/moltbot-backup-$(date +%Y%m%d-%H%M%S)"
if [ -d "$MOLTBOT_CONFIG_DIR" ] && [ "$(ls -A "$MOLTBOT_CONFIG_DIR" 2>/dev/null)" ]; then
    info "备份现有数据到: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"

    cp -r "$MOLTBOT_CONFIG_DIR" "$BACKUP_DIR/config" 2>/dev/null || true
    cp -r "$MOLTBOT_WORKSPACE_DIR" "$BACKUP_DIR/workspace" 2>/dev/null || true

    info "✓ 备份完成: $BACKUP_DIR"
else
    info "跳过备份（无现有数据）"
fi

# 4. 停止现有进程
info "停止现有 Moltbot 进程..."
pkill -f "moltbot gateway" 2>/dev/null || true
pkill -f "node.*dist/index.js.*gateway" 2>/dev/null || true

# macOS launchd
if [ "$(uname)" = "Darwin" ]; then
    launchctl unload "$HOME/Library/LaunchAgents/bot.molt.gateway.plist" 2>/dev/null || true
    info "✓ 已停止 macOS 守护进程（如果存在）"
fi

# Linux systemd
if command -v systemctl &> /dev/null; then
    systemctl --user stop moltbot-gateway 2>/dev/null || true
    info "✓ 已停止 systemd 服务（如果存在）"
fi

sleep 2
info "✓ 现有进程已停止"

# 5. 创建 .env 配置
info "配置环境变量..."

ENV_FILE="$SCRIPT_DIR/.env"

# 检查是否已有 gateway token
EXISTING_TOKEN=""
if [ -f "$MOLTBOT_CONFIG_DIR/moltbot.json" ]; then
    EXISTING_TOKEN=$(grep -oE '"token"\s*:\s*"[^"]*"' "$MOLTBOT_CONFIG_DIR/moltbot.json" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || true)
fi

# 生成或使用现有 token
if [ -n "$EXISTING_TOKEN" ]; then
    GATEWAY_TOKEN="$EXISTING_TOKEN"
    info "✓ 使用现有 gateway token"
else
    if command -v openssl &> /dev/null; then
        GATEWAY_TOKEN="$(openssl rand -hex 32)"
    else
        GATEWAY_TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
    fi
    info "✓ 生成新 gateway token"
fi

# 写入 .env 文件
cat > "$ENV_FILE" << EOF
# Moltbot Docker 配置
# 生成时间: $(date)

# 数据目录（使用现有数据）
CLAWDBOT_CONFIG_DIR=$MOLTBOT_CONFIG_DIR
CLAWDBOT_WORKSPACE_DIR=$MOLTBOT_WORKSPACE_DIR

# 网络配置
CLAWDBOT_GATEWAY_PORT=18789
CLAWDBOT_BRIDGE_PORT=18790
CLAWDBOT_GATEWAY_BIND=lan

# Gateway Token
CLAWDBOT_GATEWAY_TOKEN=$GATEWAY_TOKEN

# 镜像配置
CLAWDBOT_IMAGE=moltbot:local

# 可选：额外的 apt 包（取消注释以启用）
# CLAWDBOT_DOCKER_APT_PACKAGES="ffmpeg git curl"

# 可选：额外的挂载目录（取消注释以启用）
# CLAWDBOT_EXTRA_MOUNTS="\$HOME/projects:/home/node/projects:rw"

# 可选：持久化整个 home 目录（取消注释以启用）
# CLAWDBOT_HOME_VOLUME="moltbot_home"
EOF

info "✓ 配置文件已创建: $ENV_FILE"

# 6. 检查配置文件中的 bind 设置
if [ -f "$MOLTBOT_CONFIG_DIR/moltbot.json" ]; then
    if grep -q '"bind"\s*:\s*"loopback"' "$MOLTBOT_CONFIG_DIR/moltbot.json" 2>/dev/null; then
        warn "检测到 gateway.bind 设置为 'loopback'"
        warn "这可能导致容器无法从外部访问"
        warn "建议修改为 'lan' 或在容器启动参数中指定"
    fi
fi

# 7. 构建 Docker 镜像
info "构建 Docker 镜像（这可能需要几分钟）..."
docker build -t moltbot:local -f Dockerfile . || error "Docker 镜像构建失败"
info "✓ Docker 镜像构建成功"

# 8. 停止并清理旧容器
info "清理旧容器..."
docker compose down 2>/dev/null || true
info "✓ 旧容器已清理"

# 9. 启动服务
info "启动 Moltbot Gateway 容器..."
docker compose up -d moltbot-gateway || error "容器启动失败"

# 等待服务启动
info "等待服务启动..."
sleep 5

# 10. 验证部署
info "验证部署..."

if docker ps | grep -q moltbot-gateway; then
    info "✓ 容器正在运行"
else
    error "容器未能启动，请查看日志: docker compose logs moltbot-gateway"
fi

# 检查数据挂载
if docker compose exec moltbot-gateway test -d /home/node/.clawdbot 2>/dev/null; then
    info "✓ 配置目录已正确挂载"
else
    warn "配置目录挂载可能有问题"
fi

if docker compose exec moltbot-gateway test -d /home/node/clawd 2>/dev/null; then
    info "✓ 工作空间已正确挂载"
else
    warn "工作空间挂载可能有问题"
fi

# 11. 显示部署信息
echo ""
echo "======================================"
echo -e "${GREEN}Moltbot Docker 部署成功！${NC}"
echo "======================================"
echo ""
echo "服务信息:"
echo "  • Gateway URL: http://localhost:18789"
echo "  • Gateway Token: $GATEWAY_TOKEN"
echo "  • 配置目录: $MOLTBOT_CONFIG_DIR"
echo "  • 工作空间: $MOLTBOT_WORKSPACE_DIR"
[ -n "$BACKUP_DIR" ] && echo "  • 备份目录: $BACKUP_DIR"
echo ""
echo "常用命令:"
echo "  • 查看日志: docker compose logs -f moltbot-gateway"
echo "  • 重启服务: docker compose restart moltbot-gateway"
echo "  • 停止服务: docker compose stop moltbot-gateway"
echo "  • 使用 CLI: docker compose run --rm moltbot-cli <command>"
echo ""
echo "访问控制面板:"
echo "  1. 打开浏览器: http://localhost:18789"
echo "  2. 使用上面的 Gateway Token 登录"
echo ""
echo "查看实时日志:"
echo "  docker compose logs -f moltbot-gateway"
echo ""
echo "======================================"

# 显示最近的日志
info "最近的日志输出:"
docker compose logs --tail=20 moltbot-gateway

exit 0
