from contextlib import asynccontextmanager
import sqlite3
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from database import get_connection, initialize_database


class Cliente(BaseModel):
    cedula: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=80)
    apellidos: str = Field(min_length=1, max_length=100)
    correo: str = Field(min_length=3, max_length=120)
    telefono: str = Field(min_length=1, max_length=30)


class Cuenta(BaseModel):
    numeroCuenta: str = Field(min_length=1, max_length=30)
    cedulaCliente: str = Field(min_length=1, max_length=30)
    tipoCuenta: str = Field(min_length=1, max_length=40)
    saldo: float = Field(ge=0)
    estado: str = Field(min_length=1, max_length=30)


class Tarjeta(BaseModel):
    numeroTarjeta: str = Field(min_length=1, max_length=30)
    numeroCuenta: str = Field(min_length=1, max_length=30)
    tipo: str = Field(min_length=1, max_length=30)
    marca: str = Field(min_length=1, max_length=40)
    fechaVencimiento: date
    limiteCredito: float = Field(ge=0)
    estado: str = Field(min_length=1, max_length=30)


class Transaccion(BaseModel):
    identificador: str = Field(min_length=1, max_length=30)
    numeroTarjeta: str = Field(min_length=1, max_length=30)
    tipo: str = Field(min_length=1, max_length=30)
    monto: float = Field(gt=0)
    fecha: date
    comercio: str = Field(min_length=1, max_length=100)
    descripcion: str = Field(default="", max_length=250)


MODELS = {
    "cliente": Cliente,
    "cuenta": Cuenta,
    "tarjeta": Tarjeta,
    "transaccion": Transaccion,
}

PRIMARY_KEYS = {
    "cliente": "cedula",
    "cuenta": "numeroCuenta",
    "tarjeta": "numeroTarjeta",
    "transaccion": "identificador",
}

TABLES = set(MODELS)


def quoted_columns(data: dict):
    return list(data), list(data.values())


def db_error(exc: sqlite3.IntegrityError):
    raise HTTPException(
        status_code=409,
        detail="No se puede completar la operación: clave duplicada o relación inexistente/en uso.",
    ) from exc


def serialize(row):
    return dict(row)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Sistema de Control de Tarjetas",
    version="1.0.0",
    lifespan=lifespan,
)

app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).parent / "static"),
    name="static",
)


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/api/{table}")
def list_rows(table: str):
    if table not in TABLES:
        raise HTTPException(404, "Entidad no encontrada")

    with get_connection() as conn:
        return [
            serialize(row)
            for row in conn.execute(f"SELECT * FROM {table}")
        ]


@app.get("/api/{table}/{key}")
def get_row(table: str, key: str):
    if table not in TABLES:
        raise HTTPException(404, "Entidad no encontrada")

    with get_connection() as conn:
        row = conn.execute(
            f"SELECT * FROM {table} WHERE {PRIMARY_KEYS[table]} = ?",
            (key,),
        ).fetchone()

    if not row:
        raise HTTPException(404, "Registro no encontrado")

    return serialize(row)


@app.post("/api/{table}", status_code=201)
def create_row(table: str, payload: dict):
    if table not in TABLES:
        raise HTTPException(404, "Entidad no encontrada")

    data = MODELS[table].model_validate(payload).model_dump(mode="json")
    columns, values = quoted_columns(data)

    try:
        with get_connection() as conn:
            conn.execute(
                f"INSERT INTO {table} ({', '.join(columns)}) "
                f"VALUES ({', '.join('?' for _ in columns)})",
                values,
            )
    except sqlite3.IntegrityError as exc:
        db_error(exc)

    return data


@app.put("/api/{table}/{key}")
def update_row(table: str, key: str, payload: dict):
    if table not in TABLES:
        raise HTTPException(404, "Entidad no encontrada")

    data = MODELS[table].model_validate(payload).model_dump(mode="json")
    pk = PRIMARY_KEYS[table]

    if data[pk] != key:
        raise HTTPException(
            400,
            "La clave de la URL debe coincidir con el cuerpo",
        )

    try:
        with get_connection() as conn:
            result = conn.execute(
                f"UPDATE {table} SET "
                f"{', '.join(f'{c} = ?' for c in data if c != pk)} "
                f"WHERE {pk} = ?",
                [v for c, v in data.items() if c != pk] + [key],
            )
    except sqlite3.IntegrityError as exc:
        db_error(exc)

    if result.rowcount == 0:
        raise HTTPException(404, "Registro no encontrado")

    return data


@app.delete("/api/{table}/{key}", status_code=204)
def delete_row(table: str, key: str):
    if table not in TABLES:
        raise HTTPException(404, "Entidad no encontrada")

    try:
        with get_connection() as conn:
            result = conn.execute(
                f"DELETE FROM {table} WHERE {PRIMARY_KEYS[table]} = ?",
                (key,),
            )
    except sqlite3.IntegrityError as exc:
        db_error(exc)

    if result.rowcount == 0:
        raise HTTPException(404, "Registro no encontrado")


@app.get("/api/tarjeta/{numero_tarjeta}/transacciones")
def tarjeta_transacciones(numero_tarjeta: str):
    with get_connection() as conn:
        tarjeta = conn.execute(
            "SELECT * FROM Tarjeta WHERE numeroTarjeta = ?",
            (numero_tarjeta,),
        ).fetchone()

        if not tarjeta:
            raise HTTPException(404, "Tarjeta no encontrada")

        transacciones = conn.execute(
            "SELECT * FROM Transaccion "
            "WHERE numeroTarjeta = ? ORDER BY fecha DESC",
            (numero_tarjeta,),
        ).fetchall()

    return {
        "tarjeta": serialize(tarjeta),
        "transacciones": [serialize(t) for t in transacciones],
    }
