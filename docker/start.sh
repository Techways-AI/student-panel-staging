#!/bin/bash

# Docker startup script for Durrani Student Panel

set -e

echo "🚀 Starting Durrani Student Panel..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp env.example .env
    echo "📝 Please edit .env file with your actual configuration values"
    echo "   Then run this script again."
    exit 1
fi

# Load environment variables
source .env

# Create necessary directories
mkdir -p logs
mkdir -p ssl

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "📦 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

# Show logs
echo "📋 Recent logs:"
docker-compose logs --tail=20

echo "✅ Durrani Student Panel is starting up!"
echo "🌐 Frontend: https://student-panel-staging-production-d927.up.railway.app/"
echo "🔌 Backend API: https://student-panel-staging-production.up.railway.app/"
echo "📚 API Documentation: https://student-panel-staging-production.up.railway.app/docs"
echo "🔍 Health Check: https://student-panel-staging-production.up.railway.app/health"
echo "🗄️  Database: localhost:5432"

echo ""
echo "📝 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart services: docker-compose restart"
echo "   View service status: docker-compose ps"

