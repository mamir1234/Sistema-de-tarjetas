import sqlite3
from pathlib import Path

DATABASE = Path(__file__).parent / "base_de_datos.db"


def get_connection():
    con = sqlite3.connect(DATABASE)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def initialize_database():
    con = get_connection()
    cur = con.cursor()

    # Tabla Cliente
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Cliente (
        cedula TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        apellidos TEXT NOT NULL,
        correo TEXT NOT NULL,
        telefono TEXT NOT NULL
    );
    """)

    # Tabla Cuenta
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Cuenta (
        numeroCuenta TEXT PRIMARY KEY,
        cedulaCliente TEXT NOT NULL,
        tipoCuenta TEXT NOT NULL,
        saldo REAL NOT NULL DEFAULT 0,
        estado TEXT NOT NULL,
        CONSTRAINT fk_cuenta_cliente
            FOREIGN KEY (cedulaCliente)
            REFERENCES Cliente (cedula)
    );
    """)

    # Tabla Tarjeta
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Tarjeta (
        numeroTarjeta TEXT PRIMARY KEY,
        numeroCuenta TEXT NOT NULL,
        tipo TEXT NOT NULL,
        marca TEXT NOT NULL,
        fechaVencimiento TEXT NOT NULL,
        limiteCredito REAL NOT NULL DEFAULT 0,
        estado TEXT NOT NULL,
        CONSTRAINT fk_tarjeta_cuenta
            FOREIGN KEY (numeroCuenta)
            REFERENCES Cuenta (numeroCuenta)
    );
    """)

    # Tabla Transaccion
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Transaccion (
        identificador TEXT PRIMARY KEY,
        numeroTarjeta TEXT NOT NULL,
        tipo TEXT NOT NULL,
        monto REAL NOT NULL,
        fecha TEXT NOT NULL,
        comercio TEXT NOT NULL,
        descripcion TEXT,
        CONSTRAINT fk_transaccion_tarjeta
            FOREIGN KEY (numeroTarjeta)
            REFERENCES Tarjeta (numeroTarjeta)
    );
    """)

    con.commit()
    con.close()
