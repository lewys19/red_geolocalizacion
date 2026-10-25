"""Envoltorio para cualquier estrategia: guarda las respuestas en Redis y limita el ritmo.

- Caché: el mismo punto (redondeado a ~1 m) no se vuelve a preguntar en 30 días.
- Ritmo: como máximo 1 consulta por segundo al proveedor (regla de Nominatim),
  compartida entre todos los procesos de la API gracias a Redis.
Si Redis no responde, se consulta igual: es mejor que no tener sugerencia.
"""

import json
import time
from dataclasses import asdict

import redis

from app.geocoding.base import DireccionSugerida, ProveedorGeocoding


class ConCacheYRitmo:
    def __init__(self, proveedor: ProveedorGeocoding, cliente: redis.Redis, dias_cache: int) -> None:
        self.proveedor = proveedor
        self.nombre = proveedor.nombre
        self.redis = cliente
        self.segundos_cache = dias_cache * 86400

    def inverso(self, lng: float, lat: float) -> DireccionSugerida | None:
        clave = f"geo:inverso:{self.nombre}:{lng:.5f},{lat:.5f}"
        try:
            guardado = self.redis.get(clave)
            if guardado is not None:
                datos = json.loads(guardado)
                return DireccionSugerida(**datos) if datos else None
            self._esperar_turno()
        except redis.RedisError:
            return self.proveedor.inverso(lng, lat)
        resultado = self.proveedor.inverso(lng, lat)
        try:
            self.redis.set(clave, json.dumps(asdict(resultado) if resultado else None), ex=self.segundos_cache)
        except redis.RedisError:
            pass
        return resultado

    def _esperar_turno(self) -> None:
        """Toma el "turno" de este segundo; si otro proceso lo tiene, espera hasta 3 s."""
        limite = time.monotonic() + 3
        while not self.redis.set(f"geo:turno:{self.nombre}", "1", nx=True, px=1000):
            if time.monotonic() > limite:
                raise TimeoutError("Geocodificador ocupado")
            time.sleep(0.1)
