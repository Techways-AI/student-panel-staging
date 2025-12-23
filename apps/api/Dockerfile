FROM python:3.11-slim

# Critical: Ensure Python output is sent straight to terminal without buffering
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies including PDF processing libraries (updated Dec 2025)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    postgresql-client \
    libpoppler-cpp-dev \
    libpoppler-dev \
    poppler-utils \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Create logs directory and app-specific temp directory
RUN mkdir -p /app/logs && mkdir -p /app/tmp

# Disable Docker healthcheck - let Railway handle it
# HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
#     CMD curl -f http://127.0.0.1:8000/health || exit 1

EXPOSE 8000

# Railway-optimized startup with fewer workers to prevent memory issues
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info", "--access-log"]

