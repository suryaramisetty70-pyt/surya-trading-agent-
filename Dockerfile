# Multi-stage production Dockerfile for MAX MARKET
# Fully compatible with Hugging Face Spaces (24/7 Free No-Sleep), Render, Railway & Docker
FROM python:3.11-slim

# Prevent Python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

WORKDIR /app

# Install system build dependencies for scikit-learn & numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create standard non-root user (UID 1000 for Hugging Face Spaces & security)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

# Copy application files (including pre-built frontend dist)
COPY --chown=user:user . .

# Expose port (7860 default for Hugging Face Spaces, overridable by $PORT on Render/Cloud)
EXPOSE 7860

# Start production server with Gunicorn (4 worker threads, 120s timeout)
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 app:app
