const state = {
    cliente: [],
    cuenta: [],
    tarjeta: [],
    transaccion: []
};

const labels = {
    cliente: "Cliente",
    cuenta: "Cuenta",
    tarjeta: "Tarjeta",
    transaccion: "Transacción"
};

async function api(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    if (response.status === 204) return null;

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Ocurrió un error en la operación.");
    }

    return data;
}

function mostrarMensaje(texto, tipo = "success") {
    const elemento = document.getElementById("mensaje");
    elemento.textContent = texto;
    elemento.className = `message ${tipo}`;

    setTimeout(() => {
        elemento.className = "message hidden";
    }, 3500);
}

function escapar(texto) {
    return String(texto ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function dinero(valor) {
    return new Intl.NumberFormat("es-CR", {
        style: "currency",
        currency: "CRC"
    }).format(Number(valor) || 0);
}

function ocultarTarjeta(numero) {
    const texto = String(numero ?? "");
    if (texto.length <= 4) return texto;
    return "•••• •••• •••• " + texto.slice(-4);
}

function actualizarContadores() {
    document.getElementById("totalClientes").textContent = state.cliente.length;
    document.getElementById("totalCuentas").textContent = state.cuenta.length;
    document.getElementById("totalTarjetas").textContent = state.tarjeta.length;
    document.getElementById("totalTransacciones").textContent = state.transaccion.length;
}

async function cargarTabla(tabla) {
    state[tabla] = await api(`/api/${tabla}`);
    renderizar(tabla);
    actualizarContadores();
}

async function cargarTodo() {
    try {
        await Promise.all(Object.keys(state).map(cargarTabla));
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
}

function renderizar(tabla) {
    const cuerpo = document.getElementById(`tabla${tabla.charAt(0).toUpperCase() + tabla.slice(1)}s`);
    if (!cuerpo) return;

    const datos = state[tabla];

    if (datos.length === 0) {
        cuerpo.innerHTML = `<tr><td colspan="10" class="empty">No hay registros.</td></tr>`;
        return;
    }

    if (tabla === "cliente") {
        cuerpo.innerHTML = datos.map(x => `
            <tr>
                <td>${escapar(x.cedula)}</td>
                <td>${escapar(x.nombre)} ${escapar(x.apellidos)}</td>
                <td>${escapar(x.correo)}</td>
                <td>${escapar(x.telefono)}</td>
                <td class="actions">
                    <button class="edit-btn" onclick="editarCliente('${encodeURIComponent(x.cedula)}')">Editar</button>
                    <button class="danger-btn" onclick="eliminarRegistro('cliente','${encodeURIComponent(x.cedula)}')">Eliminar</button>
                </td>
            </tr>
        `).join("");
    }

    if (tabla === "cuenta") {
        cuerpo.innerHTML = datos.map(x => `
            <tr>
                <td>${escapar(x.numeroCuenta)}</td>
                <td>${escapar(x.cedulaCliente)}</td>
                <td>${escapar(x.tipoCuenta)}</td>
                <td>${dinero(x.saldo)}</td>
                <td>${escapar(x.estado)}</td>
                <td class="actions">
                    <button class="edit-btn" onclick="editarCuenta('${encodeURIComponent(x.numeroCuenta)}')">Editar</button>
                    <button class="danger-btn" onclick="eliminarRegistro('cuenta','${encodeURIComponent(x.numeroCuenta)}')">Eliminar</button>
                </td>
            </tr>
        `).join("");
    }

    if (tabla === "tarjeta") {
        cuerpo.innerHTML = datos.map(x => `
            <tr>
                <td>${escapar(ocultarTarjeta(x.numeroTarjeta))}</td>
                <td>${escapar(x.numeroCuenta)}</td>
                <td>${escapar(x.tipo)}</td>
                <td>${escapar(x.marca)}</td>
                <td>${escapar(x.fechaVencimiento)}</td>
                <td>${escapar(x.estado)}</td>
                <td class="actions">
                    <button class="edit-btn" onclick="editarTarjeta('${encodeURIComponent(x.numeroTarjeta)}')">Editar</button>
                    <button class="danger-btn" onclick="eliminarRegistro('tarjeta','${encodeURIComponent(x.numeroTarjeta)}')">Eliminar</button>
                </td>
            </tr>
        `).join("");
    }

    if (tabla === "transaccion") {
        cuerpo.innerHTML = datos.map(x => `
            <tr>
                <td>${escapar(x.identificador)}</td>
                <td>${escapar(ocultarTarjeta(x.numeroTarjeta))}</td>
                <td>${escapar(x.tipo)}</td>
                <td>${dinero(x.monto)}</td>
                <td>${escapar(x.fecha)}</td>
                <td>${escapar(x.comercio)}</td>
                <td class="actions">
                    <button class="edit-btn" onclick="editarTransaccion('${encodeURIComponent(x.identificador)}')">Editar</button>
                    <button class="danger-btn" onclick="eliminarRegistro('transaccion','${encodeURIComponent(x.identificador)}')">Eliminar</button>
                </td>
            </tr>
        `).join("");
    }
}

async function guardar(tabla, datos, clave, modo = "crear") {
    const url = modo === "editar"
        ? `/api/${tabla}/${encodeURIComponent(clave)}`
        : `/api/${tabla}`;

    const method = modo === "editar" ? "PUT" : "POST";

    await api(url, {
        method,
        body: JSON.stringify(datos)
    });

    await cargarTabla(tabla);
    mostrarMensaje(`${labels[tabla]} ${modo === "editar" ? "actualizado" : "guardado"} correctamente.`);
}

document.getElementById("formCliente").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const datos = {
            cedula: document.getElementById("clienteCedula").value.trim(),
            nombre: document.getElementById("clienteNombre").value.trim(),
            apellidos: document.getElementById("clienteApellidos").value.trim(),
            correo: document.getElementById("clienteCorreo").value.trim(),
            telefono: document.getElementById("clienteTelefono").value.trim()
        };

        const existente = state.cliente.find(x => x.cedula === datos.cedula);
        await guardar("cliente", datos, datos.cedula, existente ? "editar" : "crear");
        limpiarFormulario("cliente");
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
});

document.getElementById("formCuenta").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const datos = {
            numeroCuenta: document.getElementById("cuentaNumero").value.trim(),
            cedulaCliente: document.getElementById("cuentaCliente").value.trim(),
            tipoCuenta: document.getElementById("cuentaTipo").value,
            saldo: Number(document.getElementById("cuentaSaldo").value),
            estado: document.getElementById("cuentaEstado").value
        };

        const existente = state.cuenta.find(x => x.numeroCuenta === datos.numeroCuenta);
        await guardar("cuenta", datos, datos.numeroCuenta, existente ? "editar" : "crear");
        limpiarFormulario("cuenta");
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
});

document.getElementById("formTarjeta").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const datos = {
            numeroTarjeta: document.getElementById("tarjetaNumero").value.trim(),
            numeroCuenta: document.getElementById("tarjetaCuenta").value.trim(),
            tipo: document.getElementById("tarjetaTipo").value,
            marca: document.getElementById("tarjetaMarca").value,
            fechaVencimiento: document.getElementById("tarjetaVencimiento").value,
            limiteCredito: Number(document.getElementById("tarjetaLimite").value),
            estado: document.getElementById("tarjetaEstado").value
        };

        const existente = state.tarjeta.find(x => x.numeroTarjeta === datos.numeroTarjeta);
        await guardar("tarjeta", datos, datos.numeroTarjeta, existente ? "editar" : "crear");
        limpiarFormulario("tarjeta");
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
});

document.getElementById("formTransaccion").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const datos = {
            identificador: document.getElementById("transaccionId").value.trim(),
            numeroTarjeta: document.getElementById("transaccionTarjeta").value.trim(),
            tipo: document.getElementById("transaccionTipo").value,
            monto: Number(document.getElementById("transaccionMonto").value),
            fecha: document.getElementById("transaccionFecha").value,
            comercio: document.getElementById("transaccionComercio").value.trim(),
            descripcion: document.getElementById("transaccionDescripcion").value.trim()
        };

        const existente = state.transaccion.find(x => x.identificador === datos.identificador);
        await guardar("transaccion", datos, datos.identificador, existente ? "editar" : "crear");
        limpiarFormulario("transaccion");
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
});

async function eliminarRegistro(tabla, clave) {
    const claveReal = decodeURIComponent(clave);

    if (!confirm(`¿Desea eliminar este registro de ${labels[tabla]}?`)) return;

    try {
        await api(`/api/${tabla}/${encodeURIComponent(claveReal)}`, {
            method: "DELETE"
        });

        await cargarTabla(tabla);
        mostrarMensaje(`${labels[tabla]} eliminado correctamente.`);
    } catch (error) {
        mostrarMensaje(error.message, "error");
    }
}

function editarCliente(clave) {
    const dato = state.cliente.find(x => x.cedula === decodeURIComponent(clave));
    if (!dato) return;

    document.getElementById("clienteCedula").value = dato.cedula;
    document.getElementById("clienteNombre").value = dato.nombre;
    document.getElementById("clienteApellidos").value = dato.apellidos;
    document.getElementById("clienteCorreo").value = dato.correo;
    document.getElementById("clienteTelefono").value = dato.telefono;
    mostrarMensaje("Datos cargados. Guardar actualizará el cliente.");
}

function editarCuenta(clave) {
    const dato = state.cuenta.find(x => x.numeroCuenta === decodeURIComponent(clave));
    if (!dato) return;

    document.getElementById("cuentaNumero").value = dato.numeroCuenta;
    document.getElementById("cuentaCliente").value = dato.cedulaCliente;
    document.getElementById("cuentaTipo").value = dato.tipoCuenta;
    document.getElementById("cuentaSaldo").value = dato.saldo;
    document.getElementById("cuentaEstado").value = dato.estado;
    mostrarMensaje("Datos cargados. Guardar actualizará la cuenta.");
}

function editarTarjeta(clave) {
    const dato = state.tarjeta.find(x => x.numeroTarjeta === decodeURIComponent(clave));
    if (!dato) return;

    document.getElementById("tarjetaNumero").value = dato.numeroTarjeta;
    document.getElementById("tarjetaCuenta").value = dato.numeroCuenta;
    document.getElementById("tarjetaTipo").value = dato.tipo;
    document.getElementById("tarjetaMarca").value = dato.marca;
    document.getElementById("tarjetaVencimiento").value = dato.fechaVencimiento;
    document.getElementById("tarjetaLimite").value = dato.limiteCredito;
    document.getElementById("tarjetaEstado").value = dato.estado;
    mostrarMensaje("Datos cargados. Guardar actualizará la tarjeta.");
}

function editarTransaccion(clave) {
    const dato = state.transaccion.find(x => x.identificador === decodeURIComponent(clave));
    if (!dato) return;

    document.getElementById("transaccionId").value = dato.identificador;
    document.getElementById("transaccionTarjeta").value = dato.numeroTarjeta;
    document.getElementById("transaccionTipo").value = dato.tipo;
    document.getElementById("transaccionMonto").value = dato.monto;
    document.getElementById("transaccionFecha").value = dato.fecha;
    document.getElementById("transaccionComercio").value = dato.comercio;
    document.getElementById("transaccionDescripcion").value = dato.descripcion || "";
    mostrarMensaje("Datos cargados. Guardar actualizará la transacción.");
}

function limpiarFormulario(tipo) {
    const form = document.getElementById(
        tipo === "cliente" ? "formCliente" :
        tipo === "cuenta" ? "formCuenta" :
        tipo === "tarjeta" ? "formTarjeta" :
        "formTransaccion"
    );

    form.reset();
}

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(tab.dataset.section).classList.add("active");
    });
});

cargarTodo();
