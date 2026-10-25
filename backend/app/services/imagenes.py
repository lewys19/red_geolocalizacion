"""Procesa las fotos que suben los negocios.

- Acepta JPEG, PNG y WebP de hasta 8 MB.
- Respeta la orientación de la cámara y reduce a 1600 px de lado.
- Guarda en WebP SIN metadatos: las fotos de celular traen en su EXIF las
  coordenadas GPS de donde se tomaron (por ejemplo, la casa del dueño).
"""

import io

from fastapi import status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.errores import ErrorNegocio

FORMATOS = {"JPEG", "PNG", "WEBP"}
LADO_MAXIMO = 1600
# Una foto de 8 MB no pasa de ~50 megapíxeles; más que eso es sospechoso (bomba de descompresión).
Image.MAX_IMAGE_PIXELS = 60_000_000


def procesar(datos: bytes) -> tuple[bytes, int, int]:
    """Devuelve (webp, ancho, alto)."""
    if len(datos) > settings.MAX_MB_FOTO * 1024 * 1024:
        raise ErrorNegocio(status.HTTP_413_CONTENT_TOO_LARGE, f"La foto pesa más de {settings.MAX_MB_FOTO} MB.")
    try:
        with Image.open(io.BytesIO(datos)) as original:
            if original.format not in FORMATOS:
                raise ErrorNegocio(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Sube una foto JPG, PNG o WebP.")
            imagen = ImageOps.exif_transpose(original)
            imagen = imagen.convert("RGBA" if imagen.mode in ("RGBA", "LA", "P") else "RGB")
            imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
            salida = io.BytesIO()
            imagen.save(salida, "WEBP", quality=82, method=4)  # sin exif=…: no se copian metadatos
            return salida.getvalue(), imagen.width, imagen.height
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError):
        raise ErrorNegocio(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "No pudimos leer la foto. Prueba con otra.") from None
