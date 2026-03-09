#!/usr/bin/env bash
# OpenClaw 开发环境管理脚本 (Gateway + Web UI)
# 用法: ./scripts/dev-stack.sh <start|stop|restart|rebuild|status|log>

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 使用默认配置目录 ~/.openclaw
STATE_DIR="${HOME}/.openclaw"
CONFIG_PATH="${STATE_DIR}/openclaw.json"
GATEWAY_PORT=18789
WEB_PORT=5173
LOG_DIR="${STATE_DIR}/logs"
LOG_FILE="${LOG_DIR}/gateway.log"
ERR_FILE="${LOG_DIR}/gateway.err.log"
WEB_LOG="${LOG_DIR}/web-ui.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { printf "${GREEN}[OpenClaw]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[OpenClaw]${NC} %s\n" "$*"; }
err()  { printf "${RED}[OpenClaw]${NC} %s\n" "$*" >&2; }

# 导出环境变量，确保使用默认配置目录
export OPENCLAW_STATE_DIR="$STATE_DIR"
export OPENCLAW_CONFIG_PATH="$CONFIG_PATH"

gateway_running() {
  lsof -ti TCP:"$GATEWAY_PORT" -sTCP:LISTEN >/dev/null 2>&1
}

web_running() {
  lsof -ti TCP:"$WEB_PORT" -sTCP:LISTEN >/dev/null 2>&1
}

stop_gateway() {
  if cd "$ROOT_DIR" && node scripts/run-node.mjs gateway stop 2>/dev/null; then
    log "Gateway 已停止"
    return 0
  fi
  if gateway_running; then
    kill $(lsof -ti TCP:"$GATEWAY_PORT" -sTCP:LISTEN) 2>/dev/null || true
    sleep 1
    log "已清理 Gateway 端口 $GATEWAY_PORT"
  fi
}

stop_web() {
  if web_running; then
    kill $(lsof -ti TCP:"$WEB_PORT" -sTCP:LISTEN) 2>/dev/null || true
    sleep 1
    log "Web UI 已停止"
  fi
}

show_status() {
  echo ""
  if gateway_running; then
    log "✅ Gateway  运行中 (端口 $GATEWAY_PORT)"
  else
    warn "❌ Gateway  未运行"
  fi
  if web_running; then
    log "✅ Web UI   运行中 → http://localhost:$WEB_PORT"
  else
    warn "❌ Web UI   未运行"
  fi
  echo ""
  if gateway_running; then
    cd "$ROOT_DIR"
    node scripts/run-node.mjs channels status --probe 2>&1 | tail -5
  fi
}

do_build() {
  log "正在安装依赖..."
  cd "$ROOT_DIR"
  SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install --frozen-lockfile 2>&1 | tail -3
  log "正在构建项目..."
  pnpm build 2>&1 | tail -3
  log "构建完成"
}

start_gateway() {
  if gateway_running; then
    warn "Gateway 已在运行 (端口 $GATEWAY_PORT)"
    return 0
  fi
  mkdir -p "$LOG_DIR"
  log "正在启动 Gateway (port: $GATEWAY_PORT)..."
  cd "$ROOT_DIR"
  nohup node "$ROOT_DIR/dist/index.js" gateway --port "$GATEWAY_PORT" \
    > "$LOG_FILE" 2> "$ERR_FILE" &
  local pid=$!
  # 等待最多 15 秒，每秒检查一次
  local waited=0
  while [ $waited -lt 15 ]; do
    sleep 1
    waited=$((waited + 1))
    if gateway_running; then
      log "✅ Gateway 启动成功 (PID: $pid, ${waited}s)"
      return 0
    fi
    # 如果进程已退出，立即报错
    if ! kill -0 "$pid" 2>/dev/null; then
      err "❌ Gateway 进程已退出，查看日志:"
      tail -20 "$ERR_FILE" 2>/dev/null || tail -20 "$LOG_FILE" 2>/dev/null
      return 1
    fi
  done
  err "❌ Gateway 启动超时 (${waited}s)，查看日志:"
  tail -20 "$ERR_FILE" 2>/dev/null || tail -20 "$LOG_FILE" 2>/dev/null
  return 1
}

start_web() {
  if web_running; then
    warn "Web UI 已在运行 (端口 $WEB_PORT)"
    return 0
  fi
  mkdir -p "$LOG_DIR"
  log "正在启动 Web UI..."
  cd "$ROOT_DIR"
  nohup node scripts/ui.js dev > "$WEB_LOG" 2>&1 &
  local pid=$!
  sleep 2
  if web_running; then
    log "✅ Web UI 启动成功 (PID: $pid) → http://localhost:$WEB_PORT"
  else
    err "❌ Web UI 启动失败，查看日志:"
    tail -20 "$WEB_LOG" 2>/dev/null
    return 1
  fi
}

do_start() {
  start_gateway
  start_web
  show_status
}

do_stop() {
  log "正在停止所有服务..."
  stop_web
  stop_gateway
  log "全部已停止"
}

ACTION="${1:-help}"

case "$ACTION" in
  start)
    do_start
    ;;
  stop)
    do_stop
    ;;
  restart)
    do_stop
    sleep 1
    do_start
    ;;
  rebuild)
    do_stop
    do_build
    sleep 1
    do_start
    ;;
  status)
    show_status
    ;;
  log)
    if [ ! -f "$LOG_FILE" ]; then
      err "日志文件不存在: $LOG_FILE"
      exit 1
    fi
    log "📋 实时日志 (Ctrl+C 退出):"
    tail -f "$LOG_FILE"
    ;;
  help|*)
    printf "${CYAN}OpenClaw 开发环境管理脚本${NC}\n"
    echo ""
    echo "用法: $0 <命令>"
    echo ""
    echo "命令:"
    echo "  start     启动 Gateway + Web UI"
    echo "  stop      停止所有服务"
    echo "  restart   重启所有服务"
    echo "  rebuild   重新构建并启动 (install + build + start)"
    echo "  status    查看运行状态"
    echo "  log       实时查看 Gateway 日志 (tail -f)"
    echo ""
    echo "配置: ~/.openclaw/openclaw.json"
    ;;
esac
