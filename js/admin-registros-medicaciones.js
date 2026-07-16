// Lógica de Auditoría de Registros de Suministro Farmacológico
let listadoGlobalTomas = [];
let tomaSeleccionadaId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional Exclusivo para Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Enlace de los buscadores y filtros interactivos en caliente
    document.getElementById('buscador-registro-medicacion').addEventListener('input', filtrarTomasEnMemoria);
    document.getElementById('filtro-fecha-medicacion').addEventListener('change', filtrarTomasEnMemoria);
    document.getElementById('btn-restaurar-tomas').addEventListener('click', () => {
        document.getElementById('buscador-registro-medicacion').value = '';
        document.getElementById('filtro-fecha-medicacion').value = '';
        filtrarTomasEnMemoria();
    });

    // Envío de la actualización del modal (Múltiples PATCH independientes del Back)
    document.getElementById('btn-guardar-auditoria-toma').addEventListener('click', guardarAuditoriaTomasServidor);

    // Carga inicial
    cargarTodosLosRegistrosTomas();
});

// Obtiene todas las ejecuciones de tratamientos del servidor
async function cargarTodosLosRegistrosTomas() {
    const contenedor = document.getElementById('contenedor-registros-medicacion');
    const txtContador = document.getElementById('contador-tomas');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando libro de suministro farmacológico...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/medicacion-registros`, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        }); // Consume el findAllByOrderByFechaHoraRealDesc() del service

        if (!respuesta.ok) throw new Error('No se pudo acceder al repositorio de registros de medicación.');
        listadoGlobalTomas = await respuesta.json(); // Array de tomas en memoria

        txtContador.innerText = `${listadoGlobalTomas.length} tomas registradas`;
        renderizarTarjetasDeTomas(listadoGlobalTomas);

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error de red: ${error.message}</p>`;
    }
}

// Renderiza los bloques cronológicos
function renderizarTarjetasDeTomas(lista) {
    const contenedor = document.getElementById('contenedor-registros-medicacion');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan registros de tomas para los criterios de búsqueda seleccionados.</p>`;
        return;
    }

    lista.forEach(toma => {
        // Formatear LocalDateTime (fechaHoraReal)
        let fechaFormateada = 'N/A';
        if (toma.fechaHoraReal) {
            const partes = toma.fechaHoraReal.split('T');
            if (partes[0]) {
                const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
            }
        }

        const residenteStr = toma.residente ? `${toma.residente.nombre} ${toma.residente.apellidos} (Hab. ${toma.residente.habitacion || 'N/A'})` : 'Residente Desconocido';
        const empleadoStr = toma.empleado ? `${toma.empleado.nombre} ${toma.empleado.apellidos || ''}` : 'Personal de Turno';
        const medicamentoStr = toma.pautaMedica ? toma.pautaMedica.medicamento : 'Medicamento General / Antiguo';
        const dosisStr = toma.pautaMedica ? `• Dosis: ${toma.pautaMedica.dosis}` : '';

        // Formateo estético del badge según el EstadoTarea de tu back
        let badgeEstadoClass = 'bg-slate-50 text-slate-500 border-slate-200';
        const estado = toma.estadoTarea ? toma.estadoTarea.toUpperCase() : 'PENDIENTE';

        if (estado === 'REALIZADO' || estado === 'HECHO' || estado === 'SI') {
            badgeEstadoClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold';
        } else if (estado === 'RECHAZADO') {
            badgeEstadoClass = 'bg-red-50 text-red-700 border-red-200 font-extrabold animate-pulse';
        } else if (estado === 'OMITIDO') {
            badgeEstadoClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
        }

        const tarjeta = document.createElement('div');
        tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm border-l-4 border-l-indigo-500 hover:shadow-md transition-all";

        tarjeta.innerHTML = `
            <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span class="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">👤 RESIDENTE: ${residenteStr}</span>
                <span> Suministrado el: ${fechaFormateada}</span>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 mt-0.5">
                <div>
                    <span class="text-[9px] font-bold text-slate-400 block uppercase">Fármaco Administrado</span>
                    <span class="text-xs font-bold text-slate-700 block">${medicamentoStr} <span class="text-slate-400 font-medium">${dosisStr}</span></span>
                </div>
                <div class="sm:text-right">
                    <span class="text-[9px] font-bold text-slate-400 block uppercase sm:pr-1">Condición de Entrega</span>
                    <span class="border px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider inline-block mt-0.5 ${badgeEstadoClass}">
                        ${estado}
                    </span>
                </div>
            </div>
            
            ${toma.observaciones ? `
                <div class="text-[11px] text-slate-600 font-medium bg-slate-50/20 p-2 rounded-xl border border-dashed border-slate-200 leading-relaxed">
                    <strong>Notas de enfermería:</strong> ${toma.observaciones}
                </div>
            ` : ''}
            
            <div class="flex justify-between items-center mt-1 pt-2 border-t border-slate-100/60">
                <span class="text-[9px] text-slate-400 font-medium">Auxiliar/Enfermero: ${empleadoStr}</span>
                
                <div class="flex items-center gap-4">
                    <button onclick="abrirModalAuditoria(${toma.id}, '${estado}', \`${toma.observaciones ? toma.observaciones.replace(/`/g, '\\`').replace(/\$/g, '\\$') : ''}\`)" class="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold tracking-tight">
                        ✏️ Rectificar Registro
                    </button>
                    <button onclick="eliminarRegistroToma(${toma.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                        🗑️ Eliminar Parte
                    </button>
                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);
    });
}

// Filtra la colección local en caliente reduciendo accesos innecesarios a la base de datos
function filtrarTomasEnMemoria() {
    const busqueda = document.getElementById('buscador-registro-medicacion').value.toLowerCase().trim();
    const filtroFecha = document.getElementById('filtro-fecha-medicacion').value; // Formato YYYY-MM-DD
    const txtContador = document.getElementById('contador-tomas');

    let filtrados = listadoGlobalTomas;

    if (busqueda) {
        filtrados = filtrados.filter(t => {
            const residente = t.residente ? `${t.residente.nombre} ${t.residente.apellidos} ${t.residente.habitacion}`.toLowerCase() : '';
            const farmaco = t.pautaMedica ? t.pautaMedica.medicamento.toLowerCase() : '';
            const observaciones = (t.observaciones || '').toLowerCase();
            const estado = (t.estadoTarea || '').toLowerCase();

            return residente.includes(busqueda) || farmaco.includes(busqueda) || observaciones.includes(busqueda) || estado.includes(busqueda);
        });
    }

    if (filtroFecha) {
        filtrados = filtrados.filter(t => {
            if (!t.fechaHoraReal) return false;
            const fechaToma = t.fechaHoraReal.split('T')[0]; // Extrae 'YYYY-MM-DD'
            return fechaToma === filtroFecha;
        });
    }

    txtContador.innerText = `${filtrados.length} tomas registradas`;
    renderizarTomasEnMemoria(filtrados);
}

// Wrapper secundario para re-dirección de pintado manual sin perder el foco
function renderizarTomasEnMemoria(lista) {
    renderizarTarjetasDeTomas(lista);
}

// --- MODAL DE RECTIFICACIÓN Y LLAMADAS A ENDPOINTS PATCH ---

function abrirModalAuditoria(id, estadoActual, observacionesActual) {
    tomaSeleccionadaId = id;

    // Normalizar estados para matchear las opciones del select
    document.getElementById('modal-estado-toma').value = estadoActual;
    document.getElementById('modal-observaciones-toma').value = observacionesActual;

    document.getElementById('modal-auditar-toma').classList.remove('hidden');
}

function cerrarModalAuditoria() {
    tomaSeleccionadaId = null;
    document.getElementById('modal-auditar-toma').classList.add('hidden');
}

// Dispara la concatenación asíncrona de los dos PATCH del controlador (Estado y Observaciones)
async function guardarAuditoriaTomasServidor() {
    if (!tomaSeleccionadaId) return;

    const nuevoEstado = document.getElementById('modal-estado-toma').value;
    const nuevasObs = document.getElementById('modal-observaciones-toma').value;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        // 1. PATCH para el Estado de la Toma (/api/medicacion-registros/{id}/estado)
        const resEstado = await fetch(`${baseUrl}/api/medicacion-registros/${tomaSeleccionadaId}/estado?estado=${nuevoEstado}`, { //
            method: 'PATCH',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (!resEstado.ok) throw new Error('El servidor denegó la modificación del estado farmacológico.');

        // 2. PATCH para las Observaciones de la toma (/api/medicacion-registros/{id}/observaciones)
        const resObs = await fetch(`${baseUrl}/api/medicacion-registros/${tomaSeleccionadaId}/observaciones`, { //
            method: 'PATCH',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: nuevasObs // Se envía como texto plano en @RequestBody
        });
        if (!resObs.ok) throw new Error('El servidor denegó la actualización de las anotaciones clínicas.');

        cerrarModalAuditoria();
        // Recargar el libro completo actualizando cambios
        await cargarTodosLosRegistrosTomas();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar la auditoría: ${error.message}`);
    }
}

// --- ACCIÓN DE ELIMINACIÓN FÍSICA (DELETE) ---

async function eliminarRegistroToma(id) {
    if (!confirm('⚠ ¿Estás totalmente seguro de que deseas eliminar permanentemente este registro de toma farmacológica del histórico? Esta acción removerá el justificante de administración del fármaco de manera definitiva.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/medicacion-registros/${id}`, { //
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        }); // Ejecuta el borrado físico de la fila

        if (!respuesta.ok) throw new Error('El servidor rechazó anular de la base de datos el registro de toma.');

        // Sincronizar listado instantáneamente
        await cargarTodosLosRegistrosTomas();

    } catch (error) {
        console.error(error);
        alert(`Error al purgar el registro: ${error.message}`);
    }
}