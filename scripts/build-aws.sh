#!/bin/bash

# Exit on error
set -e

echo "Starting AWS build process..."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build the client
echo "Building client..."
npm run build

# Create necessary directories
echo "Setting up directories..."
mkdir -p dist

# Copy necessary files
echo "Copying files..."
cp -r dist/* /opt/nodejs/dist/

# Set permissions
echo "Setting permissions..."
chmod -R 755 /opt/nodejs/dist/

echo "Build completed successfully!" 