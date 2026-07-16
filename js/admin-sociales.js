// Lógica de Auditoría de Registros Sociales y Dependencia
let listaResidentesGlobal = [];
let residenteSeleccionadoId = null;
let registroSeleccionadoId = null; // Para modals PATCH

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional de Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Buscador lateral
    document.getElementById('buscador-sociales-residente').addEventListener('input', filtrarResidentesSocial);

    // Eventos de los botones de guardar en Modales (PATCH)
    document.getElementById('btn-guardar-estado').addEventListener('click', enviarEstadoActualizado);
    document.getElementById('btn-guardar-gestiones').addEventListener('click', enviarGestionesCorregidas);

    // Iniciar
    cargarResidentesParaSocial();
});

// Obtiene los residentes de alta
async function cargarResidentesParaSocial() {
    const contenedor = document.getElementById('lista-sociales-residentes');
    const txtContador = document.getElementById('contador-residentes');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Sincronizando expedientes...</p>`;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo descargar la tabla de residentes.');
        listaResidentesGlobal = await respuesta.json();

        txtContador.innerText = `${listaResidentesGlobal.length} expedientes`;
        renderizarListaLateral(listaResidentesGlobal);

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error: ${error.message}</p>`;
    }
}

// Pinta el fichero lateral
function renderizarListaLateral(lista) {
    const contenedor = document.getElementById('lista-sociales-residentes');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Sin coincidencias.</p>`;
        return;
    }

    lista.forEach(res => {
        const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
        const seleccionado = residenteSeleccionadoId === res.id;

        const item = document.createElement('div');
        item.className = `p-3 cursor-pointer flex items-center justify-between rounded-xl bg-white border border-slate-200 select-none shadow-sm hover:border-fuchsia-500 hover:bg-fuchsia-50/5 transition-all ${seleccionado ? 'border-fuchsia-500 bg-fuchsia-50/10 shadow-md ring-1 ring-fuchsia-200' : ''
            }`;

        item.innerHTML = `
            <div class="flex items-center gap-3 truncate">
                <div class="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                    ${iniciales}
                </div>
                <div class="truncate text-left">
                    <span class="font-bold text-xs text-slate-700 block truncate">${res.nombre} ${res.apellidos}</span>
                    <span class="text-[10px] text-slate-400 block font-medium">Hab: ${res.habitacion || 'N/A'} • DNI: ${res.dni || 'N/A'}</span>
                </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 px-2">&rarr;</span>
        `;

        item.addEventListener('click', () => abrirExpedienteSocial(res));
        contenedor.appendChild(item);
    });
}

// Filtro offline lateral
function filtrarResidentesSocial(e) {
    const termino = e.target.value.toLowerCase().trim();
    if (!termino) {
        renderizarListaLateral(listaResidentesGlobal);
        return;
    }

    const filtrados = listaResidentesGlobal.filter(res =>
        (res.nombre && res.nombre.toLowerCase().includes(termino)) ||
        (res.apellidos && res.apellidos.toLowerCase().includes(termino)) ||
        (res.habitacion && res.habitacion.toLowerCase().includes(termino))
    );

    renderizarListaLateral(filtrados);
}

// Al seleccionar el residente, abre su expediente[cite: 53]
async function abrirExpedienteSocial(residente) {
    residenteSeleccionadoId = residente.id;

    renderizarListaLateral(listaResidentesGlobal);

    document.getElementById('panel-social-vacio').classList.add('hidden');
    document.getElementById('panel-social-activo').classList.remove('hidden');

    document.getElementById('residente-nombre-social').innerText = `📁 EXPEDIENTE SOCIAL DE: ${residente.nombre} ${residente.apellidos}`;
    document.getElementById('residente-meta-social').innerText = `DNI: ${residente.dni || 'N/A'} • TIS: ${residente.tis || 'N/A'} • Habitación: ${residente.habitacion || 'N/A'}`;

    await cargarRegistrosSocialesServidor();
}

// GET /api/registros-sociales/residente/{id}[cite: 53]
async function cargarRegistrosSocialesServidor() {
    const contenedor = document.getElementById('contenedor-registros-sociales');
    const txtContador = document.getElementById('contador-tramites');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Recuperando histórico de trámites y gestiones...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-sociales/residente/${residenteSeleccionadoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }); //[cite: 53]

        if (!respuesta.ok) throw new Error('Fallo al recuperar el expediente social.');
        const registros = await respuesta.json(); //[cite: 50]

        contenedor.innerHTML = '';
        txtContador.innerText = `${registros.length} registros`;

        if (registros.length === 0) {
            contenedor.innerHTML = `
                <div class="bg-white border border-slate-200 p-8 rounded-2xl text-center text-slate-400 italic text-xs shadow-sm">
                    ⚠️ No hay trámites abiertos ni intervenciones sociales documentadas.
                </div>
            `;
            return;
        }

        registros.forEach(reg => {
            // Formatear LocalDateTime y LocalDates
            let fechaInicio = formatearFechaHoraLocal(reg.fechaRegistro);
            let fechaPres = formatearFecha(reg.fechapresentacion);
            let fechaVenc = formatearFecha(reg.fechaVencimiento);

            const tsStr = reg.trabajadorSocial ? `${reg.trabajadorSocial.nombre} ${reg.trabajadorSocial.apellidos || ''}` : 'Trabajador Social';

            // Badge visual de estado[cite: 52]
            let estadoHTML = '';
            const e = reg.estado || 'INICIADO';
            if (e === 'RESUELTO_FAVORABLE') estadoHTML = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-extrabold uppercase text-[9px] tracking-wider">✔️ ${e.replace('_', ' ')}</span>`;
            else if (e === 'DENEGADO') estadoHTML = `<span class="bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded font-extrabold uppercase text-[9px] tracking-wider">❌ ${e}</span>`;
            else if (e === 'EN_ESPERA') estadoHTML = `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-extrabold uppercase text-[9px] tracking-wider">⏳ ${e.replace('_', ' ')}</span>`;
            else estadoHTML = `<span class="bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-extrabold uppercase text-[9px] tracking-wider">📝 ${e}</span>`;

            // Control visual de la alerta social[cite: 52]
            const btnAlertaHTML = reg.alertaSocial
                ? `<button onclick="alternarAlertaSocial(${reg.id}, false)" class="text-[10px] text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg font-bold tracking-tight animate-pulse hover:bg-red-100">🚨 ALERTA ACTIVA - Desactivar</button>`
                : `<button onclick="alternarAlertaSocial(${reg.id}, true)" class="text-[10px] text-slate-400 hover:text-red-500 font-bold tracking-tight border border-transparent hover:border-red-200 px-2 py-1 rounded-lg">Activar Alerta</button>`;

            const tarjeta = document.createElement('div');
            const borde = reg.alertaSocial ? 'border-l-red-500' : 'border-l-fuchsia-500';
            tarjeta.className = `bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3.5 shadow-sm border-l-4 ${borde} hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-150`;

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">📌 ${reg.categoria || 'GESTIÓN GENERAL'}</span>
                    <span>Abierto: ${fechaInicio}</span>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div>
                        <span class="text-[9px] font-bold text-slate-400 block uppercase">Nº Expediente / Referencia</span>
                        <span class="text-xs font-mono font-bold text-slate-700 block">${reg.numeroExpediente || 'S/N'}</span>
                    </div>
                    <div class="sm:text-right">
                        <span class="text-[9px] font-bold text-slate-400 block uppercase mb-1">Resolución</span>
                        ${estadoHTML}
                    </div>
                </div>

                <div class="flex items-center gap-4 text-[10px] text-slate-500 font-medium">
                    <span><strong>Presentado:</strong> ${fechaPres}</span>
                    <span><strong>Vencimiento:</strong> ${fechaVenc}</span>
                </div>
                
                <div class="text-xs text-slate-700 font-medium bg-slate-50 p-3.5 rounded-xl border border-dashed border-slate-200 leading-relaxed whitespace-pre-line select-text relative">
                    <span class="text-[9px] font-bold text-slate-400 uppercase absolute top-2 right-2">Gestiones Realizadas</span>
                    ${reg.gestionesRealizadas || 'Sin anotaciones descriptivas del progreso.'}
                </div>
                
                <div class="flex justify-between items-center mt-1 pt-2.5 border-t border-slate-100/60">
                    <span class="text-[9px] text-slate-400 font-medium">Trabajador/a: ${tsStr}</span>
                    
                    <div class="flex items-center gap-3">
                        ${btnAlertaHTML}
                        <button onclick="abrirModalEstado(${reg.id}, '${reg.estado}')" class="text-[10px] text-fuchsia-600 hover:text-fuchsia-800 font-bold tracking-tight">
                            🔄 Cambiar Estado
                        </button>
                        <button onclick="abrirModalGestiones(${reg.id}, \`${reg.gestionesRealizadas ? reg.gestionesRealizadas.replace(/`/g, '\\`').replace(/\$/g, '\\$') : ''}\`)" class="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold tracking-tight">
                            ✏️ Editar Texto
                        </button>
                        <button onclick="eliminarRegistroSocial(${reg.id})" class="text-[10px] text-slate-400 hover:text-red-500 font-bold tracking-tight" title="Eliminar registro">
                            🗑️
                        </button>
                    </div>
                </div>
            `;

            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error de comunicación: ${error.message}</p>`;
    }
}

// Helpers Formato Fecha
function formatearFechaHoraLocal(fh) {
    if (!fh) return 'N/A';
    const partes = fh.split('T');
    if (!partes[0]) return 'N/A';
    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
    return partes[0].split('-').reverse().join('/') + hora;
}

function formatearFecha(f) {
    if (!f) return 'No definida';
    return f.split('-').reverse().join('/');
}

// --- MODAL DE ESTADO DEL TRÁMITE (PATCH) ---

function abrirModalEstado(id, estadoActual) {
    registroSeleccionadoId = id;
    if (estadoActual) document.getElementById('modal-select-estado').value = estadoActual;
    document.getElementById('modal-estado-tramite').classList.remove('hidden');
}

function cerrarModalSocial() {
    registroSeleccionadoId = null;
    document.getElementById('modal-estado-tramite').classList.add('hidden');
}

async function enviarEstadoActualizado() {
    if (!registroSeleccionadoId) return;

    const nuevoEstado = document.getElementById('modal-select-estado').value;
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-sociales/${registroSeleccionadoId}/estado?nuevoEstado=${nuevoEstado}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        }); //[cite: 53]

        if (!respuesta.ok) throw new Error('El servidor denegó la modificación del trámite.');

        cerrarModalSocial();
        await cargarRegistrosSocialesServidor();

    } catch (error) {
        console.error(error);
        alert(`Error: ${error.message}`);
    }
}

// --- MODAL DE EDICIÓN DE GESTIONES (PATCH) ---

function abrirModalGestiones(id, textoActual) {
    registroSeleccionadoId = id;
    document.getElementById('modal-text-gestiones').value = textoActual;
    document.getElementById('modal-gestiones-tramite').classList.remove('hidden');
}

function cerrarModalGestiones() {
    registroSeleccionadoId = null;
    document.getElementById('modal-gestiones-tramite').classList.add('hidden');
}

async function enviarGestionesCorregidas() {
    if (!registroSeleccionadoId) return;

    const nuevoTexto = document.getElementById('modal-text-gestiones').value;
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-sociales/${registroSeleccionadoId}/gestiones`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: nuevoTexto // @RequestBody String[cite: 53]
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la corrección del texto.');

        cerrarModalGestiones();
        await cargarRegistrosSocialesServidor();

    } catch (error) {
        console.error(error);
        alert(`Error: ${error.message}`);
    }
}

// --- ALTERNADOR DE ALERTA SOCIAL (PATCH BOOLEAN) ---

async function alternarAlertaSocial(id, booleanoActivar) {
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-sociales/${id}/alerta?estadoAlerta=${booleanoActivar}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        }); //[cite: 53]

        if (!respuesta.ok) throw new Error('Error al conmutar el estado de la alerta social.');

        await cargarRegistrosSocialesServidor();

    } catch (error) {
        console.error(error);
        alert(`Error al actualizar alerta: ${error.message}`);
    }
}

// --- ELIMINACIÓN DE REGISTROS COMPLETOS (DELETE) ---

async function eliminarRegistroSocial(id) {
    if (!confirm('⚠️ ¿Estás completamente seguro de eliminar permanentemente este expediente social? Esta acción es irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-sociales/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }); //[cite: 53]

        if (!respuesta.ok) throw new Error('El servidor rechazó la anulación física del expediente.');

        await cargarRegistrosSocialesServidor();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar: ${error.message}`);
    }
}