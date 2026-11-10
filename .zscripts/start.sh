#!/bin/sh

set -e

# Directory containing this script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR"

# PIDs of all spawned child processes
pids=""

# Cleanup: gracefully shut down all services
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."

    # Send SIGTERM to every child process
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "   Stopping process $pid ($service_name)..."
            kill -TERM "$pid" 2>/dev/null
        fi
    done

    # Wait up to 5 seconds for all processes to exit
    sleep 1
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            # If still running, wait up to 4 more seconds
            timeout=4
            while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done
            # Force-kill if it is still alive
            if kill -0 "$pid" 2>/dev/null; then
                echo "   Force-killing process $pid..."
                kill -KILL "$pid" 2>/dev/null
            fi
        fi
    done

    echo "✅ All services stopped"
    exit 0
}

echo "🚀 Starting all services..."
echo ""

# Switch to the build directory
cd "$BUILD_DIR" || exit 1

ls -lah

DEFAULT_PACKAGED_DB_PATH="/app/db/custom.db"
DEFAULT_PACKAGED_DATABASE_URL="file:$DEFAULT_PACKAGED_DB_PATH"

# Python dependencies were installed into the deploy artifact at build time;
# they are not reused from the Sandbox's /home/z/.venv. Next.js and any child
# processes it spawns inherit this set of paths.
if [ -d "/app/python-runtime/site-packages" ]; then
    export PYTHONPATH="/app/python-runtime/site-packages:/app/next-service-dist${PYTHONPATH:+:$PYTHONPATH}"
    export PATH="/app/python-runtime/site-packages/bin:$PATH"
    export PYTHONDONTWRITEBYTECODE=1
    export PYTHONUNBUFFERED=1
    echo "🐍 Enabled bundled Python runtime: $(python --version 2>&1)"
fi

# Start the Next.js server
if [ -f "./next-service-dist/server.js" ]; then
    echo "🚀 Starting Next.js server..."
    cd next-service-dist/ || exit 1

    # Environment variables
    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"
    export DATABASE_URL="${DATABASE_URL:-$DEFAULT_PACKAGED_DATABASE_URL}"

    # Session-token signing secret (HMAC). The app refuses to serve requests
    # in production without it (see src/lib/auth.ts). If the deploy
    # environment does not inject SESSION_SECRET, generate a random one on
    # first boot and persist it next to the database so sessions survive
    # restarts without ever storing the secret in the repository.
    if [ -z "${SESSION_SECRET:-}" ]; then
        SESSION_SECRET_FILE="$(dirname "$DEFAULT_PACKAGED_DB_PATH")/.session-secret"
        if [ -f "$SESSION_SECRET_FILE" ]; then
            export SESSION_SECRET="$(cat "$SESSION_SECRET_FILE")"
            echo "🔑 Reusing persisted SESSION_SECRET ($SESSION_SECRET_FILE)"
        else
            export SESSION_SECRET="$(bun -e 'console.log(crypto.randomBytes(32).toString("hex"))')"
            mkdir -p "$(dirname "$SESSION_SECRET_FILE")"
            printf '%s' "$SESSION_SECRET" > "$SESSION_SECRET_FILE"
            chmod 600 "$SESSION_SECRET_FILE"
            echo "🔑 Generated and persisted a new SESSION_SECRET ($SESSION_SECRET_FILE)"
        fi
    fi

    if [ "$DATABASE_URL" = "$DEFAULT_PACKAGED_DATABASE_URL" ]; then
        if [ ! -f "$DEFAULT_PACKAGED_DB_PATH" ]; then
            echo "❌ Packaged database not found: $DEFAULT_PACKAGED_DB_PATH"
            echo "   Aborting startup to prevent production from booting with an empty database"
            exit 1
        fi

        echo "🗄️  Using packaged database: $DEFAULT_PACKAGED_DB_PATH"
    else
        echo "🗄️  Using externally provided database: $DATABASE_URL"
    fi

    # Start Next.js in the background
    bun server.js &
    NEXT_PID=$!
    pids="$NEXT_PID"

    # Give it a moment to boot, then verify the process is still alive
    sleep 1
    if ! kill -0 "$NEXT_PID" 2>/dev/null; then
        echo "❌ Next.js server failed to start"
        exit 1
    else
        echo "✅ Next.js server started (PID: $NEXT_PID, Port: $PORT)"
    fi

    cd ../
else
    echo "⚠️  Next.js server file not found: ./next-service-dist/server.js"
fi

# Start mini-services
if [ -f "./mini-services-start.sh" ]; then
    echo "🚀 Starting mini-services..."

    # Run the start script (from the root directory; the script itself
    # handles the mini-services-dist directory)
    sh ./mini-services-start.sh &
    MINI_PID=$!
    pids="$pids $MINI_PID"

    # Give it a moment to boot, then verify
    sleep 1
    if ! kill -0 "$MINI_PID" 2>/dev/null; then
        echo "⚠️  mini-services may have failed to start; continuing anyway..."
    else
        echo "✅ mini-services started (PID: $MINI_PID)"
    fi
elif [ -d "./mini-services-dist" ]; then
    echo "⚠️  mini-services start script not found, but the directory exists"
else
    echo "ℹ️  mini-services directory not found, skipping"
fi

# Start Caddy (if a Caddyfile exists)
echo "🚀 Starting Caddy..."

# Caddy runs in the foreground as the main process
echo "✅ Caddy started (running in foreground)"
echo ""
echo "🎉 All services started!"
echo ""
echo "💡 Press Ctrl+C to stop all services"
echo ""

# Run Caddy as the main process
exec caddy run --config Caddyfile --adapter caddyfile
