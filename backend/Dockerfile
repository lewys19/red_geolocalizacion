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

# Aplica las migraciones pendientes y arranca la API.
# UVICORN_WORKERS: procesos en paralelo. 1 en equipos chicos: uvicorn reinicia un worker que tarda
# en responder, y en una máquina cargada eso termina en un bucle de reinicios. En el servidor, 2 a 4.
# --timeout-keep-alive 65: la web (Node) reutiliza las conexiones; si la API las cerrara antes
# (por defecto a los 5 s), a veces la web usaría una ya cerrada y la petición fallaría ("socket hang up").
ENV UVICORN_WORKERS=1
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers $UVICORN_WORKERS --timeout-keep-alive 65 --proxy-headers --forwarded-allow-ips='*'"]
