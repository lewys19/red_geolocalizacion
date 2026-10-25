from pydantic import BaseModel


class ResumenOut(BaseModel):
    usuarios: int
    negocios_por_estado: dict[str, int]
