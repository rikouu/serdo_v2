#!/bin/bash

PORT=4000

echo "🔍 Checking port $PORT ..."

# 找到占用该端口的 PID
PID=$(lsof -ti tcp:$PORT)

if [ -n "$PID" ]; then
  echo "⚠️  Port $PORT is currently in use by PID: $PID"
  echo "🛑 Killing process $PID ..."
  kill -9 $PID
  echo "✔️  Process killed."
else
  echo "✅ Port $PORT is free."
fi

echo "🚀 Starting server on port $PORT ..."
export REDACT_MODE=true
node server.js