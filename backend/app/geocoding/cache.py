"""Envoltorio para cualquier estrategia: guarda las respuestas en Redis y limita el ritmo.

- Caché: el mismo punto (redondeado a ~1 m) no se vuelve a preguntar en 30 días.
- Ritmo: como máximo 1 consulta por segundo al proveedor (regla de Nominatim),
  compartida entre todos los procesos de la API gracias a Redis.
Si Redis no responde, se consulta igual: es mejor que no tener sugerencia.
"""

import json
import time
from collections.abc import Callable
from dataclasses import asdict

import redis

from app.geocoding.base import DireccionSugerida, LugarEncontrado, ProveedorGeocoding


class ConCacheYRitmo:
    def __init__(self, proveedor: ProveedorGeocoding, cliente: redis.Redis, dias_cache: int) -> None:
        self.proveedor = proveedor
        self.nombre = proveedor.nombre
        self.redis = cliente
        self.segundos_cache = dias_cache * 86400

    def inverso(self, lng: float, lat: float) -> DireccionSugerida | None:
        clave = f"geo:inverso:{self.nombre}:{lng:.5f},{lat:.5f}"
        datos = self._con_cache(clave, lambda: self.proveedor.inverso(lng, lat))
        return DireccionSugerida(**datos) if datos else None

    def directo(self, texto: str) -> LugarEncontrado | None:
        clave = f"geo:directo:{self.nombre}:{' '.join(texto.lower().split())}"
        datos = self._con_cache(clave, lambda: self.proveedor.directo(texto))
        if not datos:
            return None
        return LugarEncontrado(lng=datos["lng"], lat=datos["lat"], sugerencia=DireccionSugerida(**datos["sugerencia"]))

    def _con_cache(self, clave: str, consultar: Callable[[], object]) -> dict | None:
        """Lo guardado en Redis o, si no hay, la respuesta del proveedor (respetando el ritmo)."""
        try:
            guardado = self.redis.get(clave)
            if guardado is not None:
                return json.loads(guardado)
            self._esperar_turno()
        except redis.RedisError:
            resultado = consultar()
            return asdict(resultado) if resultado else None  # type: ignore[call-overload]
        resultado = consultar()
        datos = asdict(resultado) if resultado else None  # type: ignore[call-overload]
        try:
            self.redis.set(clave, json.dumps(datos), ex=self.segundos_cache)
        except redis.RedisError:
            pass
        return datos

    def _esperar_turno(self) -> None:
        """Toma el "turno" de este segundo; si otro proceso lo tiene, espera hasta 3 s."""
        limite = time.monotonic() + 3
        while not self.redis.set(f"geo:turno:{self.nombre}", "1", nx=True, px=1000):
            if time.monotonic() > limite:
                raise TimeoutError("Geocodificador ocupado")
            time.sleep(0.1)
