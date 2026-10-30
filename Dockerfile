# One image serves everything: the React app at / and the API at /api.

# --- 1. Build the frontend ---------------------------------------------------
FROM node:22-slim AS frontend
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Same origin as the API, so the browser calls /api/... directly.
ENV VITE_API_URL=/api
RUN npm run build

# --- 2. Python server ---------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    FASTEMBED_CACHE_PATH=/models DATA_DIR=/data FRONTEND_DIR=/srv/static \
    ANONYMIZED_TELEMETRY=False
WORKDIR /srv

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image so the first request isn't slow.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5', cache_dir='/models')"

COPY backend/app ./app
COPY --from=frontend /web/dist ./static
RUN useradd -m appuser && mkdir -p /data && chown -R appuser /data /models
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.site:site_factory --factory --host 0.0.0.0 --port ${PORT:-8000}"]
