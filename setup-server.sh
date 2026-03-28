#!/bin/bash
# Run this ONCE to configure nginx on the server
set -e

# Configure your server details
SERVER_USER="your_user"
SERVER_HOST="your_server_ip"

echo "Setting up nginx for BlockBeats..."
ssh "$SERVER_USER@$SERVER_HOST" '
  cd ~/blockbeats &&
  npm install &&
  npm run build &&
  sudo cp blockbeats.nginx.conf /etc/nginx/sites-available/blockbeats &&
  sudo ln -sf /etc/nginx/sites-available/blockbeats /etc/nginx/sites-enabled/blockbeats &&
  sudo nginx -t &&
  sudo systemctl reload nginx
'

echo "Setup complete!"
