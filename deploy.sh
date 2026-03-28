#!/bin/bash
set -e

# Configure your server details
SERVER_USER="your_user"
SERVER_HOST="your_server_ip"

echo "Pushing to server..."
git push

echo "Building on server..."
ssh "$SERVER_USER@$SERVER_HOST" 'cd ~/blockbeats && npm install && npm run build'

echo "Done!"
