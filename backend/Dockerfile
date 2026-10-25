FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Primero las dependencias, para aprovechar la caché de Docker.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# /app/media: fotos de los negocios (volumen persistente en docker-compose).
RUN useradd --system --create-home altoque && mkdir -p /app/media && chown altoque /app/media
USER altoque

EXPOSE 8000

# Aplica las migraciones pendientes y arranca la API (2 procesos: PostgreSQL sí aguanta varios).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips='*'"]
