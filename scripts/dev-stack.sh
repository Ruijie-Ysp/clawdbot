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

# Resolved pnpm command (array) used by start_ui().
# Default to `pnpm` and resolve to an absolute path if PATH is missing common bin dirs.
PNPM_CMD=(pnpm)

# DEV_MODE: 0 = normal user mode (default), 1 = dev mode (C-3PO debug agent)
DEV_MODE="${DEV_MODE:-0}"

# Default ports: normal mode uses 18789, dev mode uses 19001
if [[ "$DEV_MODE" == "1" ]]; then
  GATEWAY_PORT="${GATEWAY_PORT:-19001}"
else
  GATEWAY_PORT="${GATEWAY_PORT:-18789}"
fi
UI_PORT="${UI_PORT:-5173}"

usage() {
  cat <<'EOF'
Usage: scripts/dev-stack.sh <start|stop|restart|status|logs> [gateway|ui|all]

Environment:
  DEV_MODE=0                                  0 = normal user mode (default), 1 = dev mode (C-3PO).
  GATEWAY_ARGS="--raw-stream --ws-log full"  Extra args for gateway.
  UI_ARGS="--host"                            Extra args for UI dev.
  TAIL_LINES=200                              Lines to show when tailing logs.
  GATEWAY_PORT=18789                          Gateway port (default: 18789 normal, 19001 dev).
  UI_PORT=5173                                UI port (default: 5173).

Examples:
  scripts/dev-stack.sh start                  Start in normal user mode (Clawd 🦞)
  DEV_MODE=1 scripts/dev-stack.sh start       Start in dev mode (C-3PO 🤖)
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
  # Some shells/GUI terminals may start with a restricted PATH (missing /usr/local/bin, etc.).
  # Make the script robust by best-effort augmenting PATH and resolving pnpm.
  local d
  for d in "/usr/local/bin" "/opt/homebrew/bin" "$HOME/Library/pnpm"; do
    if [[ -d "$d" ]]; then
      case ":$PATH:" in
        *":$d:"*) ;;
        *) PATH="$d:$PATH" ;;
      esac
    fi
  done
  export PATH

  if command -v pnpm >/dev/null 2>&1; then
    PNPM_CMD=(pnpm)
    return 0
  fi

  if [[ -x "/usr/local/bin/pnpm" ]]; then
    PNPM_CMD=("/usr/local/bin/pnpm")
    return 0
  fi
  if [[ -x "/opt/homebrew/bin/pnpm" ]]; then
    PNPM_CMD=("/opt/homebrew/bin/pnpm")
    return 0
  fi
  if [[ -x "$HOME/Library/pnpm/pnpm" ]]; then
    PNPM_CMD=("$HOME/Library/pnpm/pnpm")
    return 0
  fi

  echo "pnpm not found. Please install pnpm (recommended) or ensure it is on PATH." >&2
  echo "PATH=$PATH" >&2
  exit 1
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

  # Build gateway command based on DEV_MODE
  # DEV_MODE=0 (default): normal user mode, uses existing ~/.openclaw/ config
  # DEV_MODE=1: dev mode with --dev flag, uses C-3PO debug agent
  local cmd
  if [[ "$DEV_MODE" == "1" ]]; then
    echo "Starting gateway in DEV mode (C-3PO 🤖)..."
    cmd=(node scripts/run-node.mjs --dev gateway)
  else
    echo "Starting gateway in NORMAL mode (Clawd 🦞)..."
    cmd=(node scripts/run-node.mjs gateway --port "$GATEWAY_PORT")
  fi

  if ((${#extra[@]})); then
    cmd+=("${extra[@]}")
  fi

  local prev_dir
  prev_dir="$(pwd)"
  cd "$ROOT_DIR"
  # Use exec to ensure the child process replaces the shell, so PID is correct
  nohup bash -c 'exec "$@"' _ "${cmd[@]}" >> "$GATEWAY_LOG" 2>&1 &
  echo $! > "$GATEWAY_PID"
  cd "$prev_dir"
  # Wait a moment and verify the process actually started
  sleep 0.5
  if ! is_running "$GATEWAY_PID"; then
    echo "Gateway failed to start. Check log: $GATEWAY_LOG"
    return 1
  fi
  echo "Gateway started (pid $(cat "$GATEWAY_PID")), port: $GATEWAY_PORT"
  echo "Gateway log: $GATEWAY_LOG"
}

start_ui() {
  if is_running "$UI_PID"; then
    echo "UI already running (pid $(cat "$UI_PID"))."
    return 0
  fi

  # Ensure pnpm is available for UI start.
  require_pnpm

  # Ensure port is free before starting
  kill_port "$UI_PORT"

  rotate_log "$UI_LOG"

  local extra=()
  if [ -n "$UI_ARGS" ]; then
    # shellcheck disable=SC2206
    extra=($UI_ARGS)
  fi

  local cmd=("${PNPM_CMD[@]}" ui:dev --)
  if ((${#extra[@]})); then
    cmd+=("${extra[@]}")
  fi

  local prev_dir
  prev_dir="$(pwd)"
  cd "$ROOT_DIR"
  # Use exec to ensure the child process replaces the shell, so PID is correct
  nohup bash -c 'exec "$@"' _ "${cmd[@]}" >> "$UI_LOG" 2>&1 &
  echo $! > "$UI_PID"
  cd "$prev_dir"
  # Wait a moment and verify the process actually started
  sleep 0.5
  if ! is_running "$UI_PID"; then
    echo "UI failed to start. Check log: $UI_LOG"
    return 1
  fi
  echo "UI started (pid $(cat "$UI_PID"))."
  echo "UI log: $UI_LOG"
}

# Kill all descendant processes recursively
try_kill_children() {
  local parent_pid="$1"
  # Find all direct children and kill them first (recursively)
  local children
  children=$(pgrep -P "$parent_pid" 2>/dev/null || true)
  if [[ -n "$children" ]]; then
    local child
    for child in $children; do
      try_kill_children "$child"
      kill -9 "$child" 2>/dev/null || true
    done
  fi
}

stop_process() {
  local name="$1"
  local pidfile="$2"
  local port="$3"
  local pid
  pid="$(read_pid "$pidfile" || true)"

  if [[ -z "$pid" ]] || ! kill -0 "$pid" >/dev/null 2>&1; then
    if [[ -n "$pid" ]]; then
      echo "$name not running (stale pid $pid)."
      rm -f "$pidfile"
    else
      echo "$name not running (no pid file)."
    fi
  else
    echo "Stopping $name (pid $pid)..."
    # Kill all descendant processes first to prevent orphans
    try_kill_children "$pid"
    kill "$pid" >/dev/null 2>&1 || true
    for _ in {1..50}; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        rm -f "$pidfile"
        echo "$name stopped."
        break
      fi
      sleep 0.1
    done
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "$name still running; sending SIGKILL."
      kill -9 "$pid" >/dev/null 2>&1 || true
      rm -f "$pidfile"
    fi
  fi

  # Always clean up port to handle any remaining orphaned processes
  if [[ -n "$port" ]]; then
    local pids
    pids="$(lsof -ti:"$port" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "Cleaning up orphaned processes on port $port: $pids"
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 0.5
    fi
  fi
}

status() {
  echo "Mode: $(if [[ "$DEV_MODE" == "1" ]]; then echo "DEV (C-3PO 🤖)"; else echo "NORMAL (Clawd 🦞)"; fi)"
  echo "Gateway port: $GATEWAY_PORT"
  echo ""
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
      stop_process "UI" "$UI_PID" "$UI_PORT"
      stop_process "Gateway" "$GATEWAY_PID" "$GATEWAY_PORT"
      ;;
    restart)
      # Preflight before stopping services. Prevents leaving the dev stack down
      # when pnpm is missing from PATH.
      require_pnpm
      stop_process "UI" "$UI_PID" "$UI_PORT"
      stop_process "Gateway" "$GATEWAY_PID" "$GATEWAY_PORT"
      # Extra cleanup: kill any remaining openclaw-gateway processes not tracked by PID file
      local orphaned_gateway
      orphaned_gateway=$(pgrep -f "openclaw-gateway" 2>/dev/null || true)
      if [[ -n "$orphaned_gateway" ]]; then
        echo "Cleaning up orphaned gateway processes: $orphaned_gateway"
        echo "$orphaned_gateway" | xargs kill -9 2>/dev/null || true
        sleep 1
      fi
      # Ensure ports are fully released before starting
      kill_port "$GATEWAY_PORT"
      kill_port "$UI_PORT"
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
