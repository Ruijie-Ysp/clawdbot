#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/.local/dev-logs"

GATEWAY_LOG="$LOG_DIR/gateway.log"
UI_LOG="$LOG_DIR/ui.log"
GATEWAY_PID="$LOG_DIR/gateway.pid"
UI_PID="$LOG_DIR/ui.pid"

TAIL_LINES="${TAIL_LINES:-200}"
GATEWAY_ARGS="${GATEWAY_ARGS:-}"
UI_ARGS="${UI_ARGS:-}"

GATEWAY_PORT="${GATEWAY_PORT:-19001}"
UI_PORT="${UI_PORT:-5173}"

usage() {
  cat <<'EOF'
Usage: scripts/dev-stack.sh <start|stop|restart|status|logs> [gateway|ui|all]

Environment:
  GATEWAY_ARGS="--raw-stream --ws-log full"  Extra args for gateway dev.
  UI_ARGS="--host"                            Extra args for UI dev.
  TAIL_LINES=200                              Lines to show when tailing logs.
  GATEWAY_PORT=19001                          Gateway port (default: 19001).
  UI_PORT=5173                                UI port (default: 5173).
EOF
}

# Kill any process using the specified port
kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Killing processes on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

require_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found in PATH." >&2
    exit 1
  fi
}

rotate_log() {
  local file="$1"
  if [ -f "$file" ]; then
    local ts
    ts="$(date +"%Y%m%d-%H%M%S")"
    mv "$file" "${file}.${ts}"
  fi
  : > "$file"
}

read_pid() {
  local pidfile="$1"
  if [ ! -f "$pidfile" ]; then
    return 1
  fi
  local pid
  pid="$(cat "$pidfile" 2>/dev/null || true)"
  if [[ -z "$pid" || ! "$pid" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  echo "$pid"
}

is_running() {
  local pidfile="$1"
  local pid
  pid="$(read_pid "$pidfile" || true)"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

start_gateway() {
  if is_running "$GATEWAY_PID"; then
    echo "Gateway already running (pid $(cat "$GATEWAY_PID"))."
    return 0
  fi

  # Ensure port is free before starting
  kill_port "$GATEWAY_PORT"

  rotate_log "$GATEWAY_LOG"

  local extra=()
  if [ -n "$GATEWAY_ARGS" ]; then
    # shellcheck disable=SC2206
    extra=($GATEWAY_ARGS)
  fi

  local cmd=(pnpm gateway:dev)
  if ((${#extra[@]})); then
    cmd+=("${extra[@]}")
  fi

  local prev_dir
  prev_dir="$(pwd)"
  cd "$ROOT_DIR"
  CLAWDBOT_RUNNER_LOG=1 nohup "${cmd[@]}" >> "$GATEWAY_LOG" 2>&1 &
  echo $! > "$GATEWAY_PID"
  cd "$prev_dir"
  echo "Gateway started (pid $(cat "$GATEWAY_PID"))."
  echo "Gateway log: $GATEWAY_LOG"
}

start_ui() {
  if is_running "$UI_PID"; then
    echo "UI already running (pid $(cat "$UI_PID"))."
    return 0
  fi

  # Ensure port is free before starting
  kill_port "$UI_PORT"

  rotate_log "$UI_LOG"

  local extra=()
  if [ -n "$UI_ARGS" ]; then
    # shellcheck disable=SC2206
    extra=($UI_ARGS)
  fi

  local cmd=(pnpm ui:dev --)
  if ((${#extra[@]})); then
    cmd+=("${extra[@]}")
  fi

  local prev_dir
  prev_dir="$(pwd)"
  cd "$ROOT_DIR"
  nohup "${cmd[@]}" >> "$UI_LOG" 2>&1 &
  echo $! > "$UI_PID"
  cd "$prev_dir"
  echo "UI started (pid $(cat "$UI_PID"))."
  echo "UI log: $UI_LOG"
}

stop_process() {
  local name="$1"
  local pidfile="$2"
  local pid
  pid="$(read_pid "$pidfile" || true)"
  if [[ -z "$pid" ]]; then
    echo "$name not running."
    return 0
  fi
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "$name not running (stale pid $pid)."
    rm -f "$pidfile"
    return 0
  fi

  echo "Stopping $name (pid $pid)..."
  kill "$pid" >/dev/null 2>&1 || true
  for _ in {1..50}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$pidfile"
      echo "$name stopped."
      return 0
    fi
    sleep 0.1
  done
  echo "$name still running; sending SIGKILL."
  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$pidfile"
}

status() {
  if is_running "$GATEWAY_PID"; then
    echo "Gateway: running (pid $(cat "$GATEWAY_PID")), log: $GATEWAY_LOG"
  else
    echo "Gateway: stopped"
  fi
  if is_running "$UI_PID"; then
    echo "UI: running (pid $(cat "$UI_PID")), log: $UI_LOG"
  else
    echo "UI: stopped"
  fi
}

logs() {
  local target="${1:-all}"
  if [ "$target" = "gateway" ]; then
    tail -n "$TAIL_LINES" -f "$GATEWAY_LOG"
    return 0
  fi
  if [ "$target" = "ui" ]; then
    tail -n "$TAIL_LINES" -f "$UI_LOG"
    return 0
  fi
  if [ "$target" = "all" ]; then
    tail -n "$TAIL_LINES" -f "$GATEWAY_LOG" "$UI_LOG"
    return 0
  fi
  echo "Unknown logs target: $target" >&2
  exit 2
}

main() {
  mkdir -p "$LOG_DIR"
  local cmd="${1:-}"
  case "$cmd" in
    start)
      require_pnpm
      start_gateway
      start_ui
      ;;
    stop)
      stop_process "UI" "$UI_PID"
      stop_process "Gateway" "$GATEWAY_PID"
      ;;
    restart)
      stop_process "UI" "$UI_PID"
      stop_process "Gateway" "$GATEWAY_PID"
      require_pnpm
      start_gateway
      start_ui
      ;;
    status)
      status
      ;;
    logs)
      logs "${2:-all}"
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      exit 2
      ;;
  esac
}

main "${1:-}"
