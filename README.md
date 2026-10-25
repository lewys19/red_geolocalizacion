# Altoque

Directorio de negocios locales con mapa: busca "pollo a la brasa" y mira al toque qué hay cerca.
Piloto en Lima. Arquitectura del MVP: https://claude.ai/artifact/BgNnu1pfyftKnNVZBZ5Lac

| Parte | Tecnología | Carpeta |
| --- | --- | --- |
| API (la misma para la web y la futura app móvil) | Python + FastAPI + SQLAlchemy + Alembic | `backend/` |
| Base de datos | PostgreSQL 17 + PostGIS | contenedor `db` |
| Caché y colas | Redis | contenedor `redis` |
| Web | Next.js + React + TypeScript + Tailwind + MapLibre | `web/` |

## Levantar todo (como en producción)

```bash
cp .env.example .env    # completa SECRET_KEY y DB_PASSWORD
docker compose up -d --build
```

- Web: http://localhost:3100
- API y su documentación interactiva: http://localhost:8100/docs

## Programar

Backend con `.venv` (necesita la base y Redis del compose):

```bash
docker compose up -d db redis
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# backend/.env: SECRET_KEY, DATABASE_URL (puerto 5433) y REDIS_URL (puerto 6380)
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8100
.venv/bin/pytest -q          # usa su propia base, altoque_pruebas
```

Web:

```bash
cd web
npm install
npm run dev                  # http://localhost:3200, reenvía /api/v1 a localhost:8100
npm test && npm run lint
```

## Primer superadministrador

```bash
docker compose exec api python -m app.cli crear-superadmin --email tu@correo.com --nombre "Tu nombre"
```

## Ramas

`main` es producción. Cada función va en su propia rama y se une a `main` cuando está probada.
