FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    FASTEMBED_CACHE_PATH=/models DATA_DIR=/data
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image so the first request isn't slow.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5', cache_dir='/models')"

COPY app ./app
RUN useradd -m appuser && mkdir -p /data && chown -R appuser /data /models
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app_factory --factory --host 0.0.0.0 --port ${PORT:-8000}"]
