#!/bin/bash
set -e

echo "=== Geko Protocols post-merge setup ==="

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Building frontend..."
npm run build

echo "=== Post-merge setup complete ==="
