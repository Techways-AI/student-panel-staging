# Durrani Student Panel - Docker Setup

This directory contains the Docker configuration for the Durrani Student Panel application.

## Architecture

The application consists of four main services:

- **PostgreSQL Database**: Stores application data
- **FastAPI Backend**: REST API service (Python)
- **Next.js Frontend**: Web application (React/Next.js)
- **Nginx**: Reverse proxy and load balancer

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available
- Ports 80, 3000, 5432, and 8000 available

## Quick Start

### 1. Environment Setup

```bash
# Copy the environment example file
cp env.example .env

# Edit the .env file with your actual values
nano .env
```

### 2. Start Services

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

**Manual:**
```bash
docker-compose up -d
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://127.0.0.1:8000
- **Nginx**: http://localhost:3000
- **Database**: production managed service

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET_KEY` | Secret key for JWT tokens | `your_super_secret_key_here` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `...` |
| `S3_BUCKET` | S3 bucket name | Required - Set in environment |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | `Dur!Ns_2025` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `NODE_ENV` | Node.js environment | `production` |

## Service Details

### PostgreSQL Database
- **Image**: postgres:15-alpine
- **Port**: 5432
- **Data**: Persisted in Docker volume
- **Credentials**: Defined in environment variables

### FastAPI Backend
- **Image**: Custom build from `../apps/api/Dockerfile`
- **Port**: 8000
- **Health Check**: `/health` endpoint
- **Features**: JWT auth, OpenAI integration, S3 integration

### Next.js Frontend
- **Image**: Custom build from `../apps/web/Dockerfile`
- **Port**: 3000
- **Build**: Multi-stage build for optimization
- **Features**: React app with Tailwind CSS

### Nginx Reverse Proxy
- **Image**: nginx:alpine
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Features**: Load balancing, rate limiting, SSL termination
- **Security**: Security headers, gzip compression

## Docker Commands

### Basic Operations

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api

# Restart services
docker-compose restart

# Rebuild images
docker-compose build --no-cache
```

### Development

```bash
# Start only database
docker-compose up -d postgres

# Start backend with hot reload
docker-compose up api

# Access database
docker-compose exec postgres psql -U postgres -d durrani_db
```

### Monitoring

```bash
# Check service status
docker-compose ps

# Monitor resource usage
docker stats

# View service health
curl http://127.0.0.1:8000/health
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :8000
   # Kill the process or change port in docker-compose.yml
   ```

2. **Database connection failed**
   ```bash
   # Check database logs
   docker-compose logs postgres
   # Ensure database is running
   docker-compose ps postgres
   ```

3. **Build failures**
   ```bash
   # Clean build
   docker-compose build --no-cache
   # Check Dockerfile syntax
   docker build -t test ../apps/api
   ```

4. **Permission issues**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   chmod +x start.sh
   ```

### Log Locations

- **Application logs**: `./logs/` directory
- **Nginx logs**: `docker-compose logs nginx`
- **Database logs**: `docker-compose logs postgres`

## Production Deployment

### SSL Configuration

1. Place SSL certificates in `./ssl/` directory
2. Uncomment HTTPS server block in `nginx.conf`
3. Update domain names in configuration

### Scaling

```bash
# Scale API service
docker-compose up -d --scale api=3

# Scale web service
docker-compose up -d --scale web=2
```

### Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres durrani_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres durrani_db < backup.sql
```

## Security Considerations

- Change default passwords in production
- Use strong JWT secret keys
- Enable HTTPS in production
- Regularly update base images
- Monitor logs for suspicious activity
- Use secrets management for sensitive data

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review service logs
3. Ensure all prerequisites are met
4. Verify environment variables are set correctly

