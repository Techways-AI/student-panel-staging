@echo off
REM Docker startup script for Durrani Student Panel (Windows)

echo 🚀 Starting Durrani Student Panel...

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found. Creating from example...
    copy env.example .env
    echo 📝 Please edit .env file with your actual configuration values
    echo    Then run this script again.
    pause
    exit /b 1
)

REM Create necessary directories
if not exist logs mkdir logs
if not exist ssl mkdir ssl

REM Build and start services
echo 🔨 Building Docker images...
docker-compose build

echo 📦 Starting services...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak > nul

REM Check service health
echo 🏥 Checking service health...
docker-compose ps

REM Show logs
echo Recent logs:
docker-compose logs --tail=20

echo Durrani Student Panel is starting up!
echo   Frontend: https://student-panel-staging-production-d927.up.railway.app/
echo   Backend API: https://student-panel-staging-production.up.railway.app/
echo   Nginx: https://student-panel-staging-production-d927.up.railway.app/
echo   Database: localhost:5432

echo.
echo Useful commands:
echo    View logs: docker-compose logs -f
echo    Stop services: docker-compose down
echo    Restart services: docker-compose restart
echo    View service status: docker-compose ps

pause


