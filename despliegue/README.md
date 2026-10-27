# Despliegue de Altoque en el VPS

Camino de una versión nueva:

1. Se une un sprint a `main` y se hace push.
2. GitHub Actions (`.github/workflows/ci.yml`) corre las pruebas y, en `main`, sube las imágenes
   `ghcr.io/lewys19/altoque-api` y `ghcr.io/lewys19/altoque-web` (etiquetas `latest` y el hash del commit).
3. En el VPS: `cd ~/altoque && docker compose pull && docker compose up -d`.

## Qué hay en el VPS

```
~/proxy/     docker-compose.yml + Caddyfile   (copias de despliegue/proxy/)  → único en 80/443
~/altoque/   docker-compose.yml + .env        (docker-compose.prod.yml y .env.prod.example completado)
~/avanza/    docker-compose.yml + .env        (Avanza, detrás del mismo proxy)
```

El VPS no tiene el código fuente: solo esos archivos y las imágenes de GHCR.

## Primera vez

1. DNS: registro A `altoque` → IP del VPS (en el cPanel de zcorp23.com).
2. `docker network create proxy`
3. Avanza detrás del proxy: en `~/avanza/.env` poner `DOMAIN=:80`; en su compose quitar los puertos
   80/443 y unir `web` a la red `proxy` (externa).
4. `~/proxy`: copiar los dos archivos de `despliegue/proxy/` y `docker compose up -d`.
5. `~/altoque`: copiar `docker-compose.prod.yml` como `docker-compose.yml`, crear `.env` desde
   `.env.prod.example` (`chmod 600 .env`), `docker login ghcr.io`, `docker compose pull`, `docker compose up -d`.
6. Superadmin: `docker compose exec api python -m app.cli crear-superadmin --email ...`
