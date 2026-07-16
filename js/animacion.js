// Lógica de Gestión y Registro del Módulo de Animación
let listaResidentesGlobal = [];
let registroSeleccionadoId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Sesión Institucional General
    if (window.Auth && !window.Auth.checkSession()) return;

    // Inicializar input de fechaHora al momento actual por usabilidad
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    document.getElementById('anim-fechaHora').value = ahora.toISOString().slice(0, 16);

    // Enlace de eventos del formulario y modal
    document.getElementById('form-crear-animacion').addEventListener('submit', guardarNuevoRegistroAnimacion);
    document.getElementById('btn-guardar-cambios-anim').addEventListener('click', enviarModificacionesServidor);

    // Cargar datos del servidor
    prepararModuloAnimacion();
});

async function prepararModuloAnimacion() {
    await cargarListaCheckboxesResidentes();
    await cargarHistoricoAnimaciones();
}

// Carga la lista con checkboxes en el formulario izquierdo
async function cargarListaCheckboxesResidentes() {
    const contenedor = document.getElementById('lista-checkbox-residentes');
    if (!contenedor) return;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo mapear el fichero de residentes.');
        listaResidentesGlobal = await respuesta.json();

        contenedor.innerHTML = '';
        if (listaResidentesGlobal.length === 0) {
            contenedor.innerHTML = `<p class="text-slate-400 italic text-center py-2">No hay residentes registrados.</p>`;
            return;
        }

        listaResidentesGlobal.forEach(res => {
            const div = document.createElement('div');
            div.className = "flex items-center gap-2 hover:bg-slate-100 p-1 rounded transition-colors select-none";
            div.innerHTML = `
                <input type="checkbox" value="${res.id}" id="chk-res-${res.id}" class="rounded text-pink-600 focus:ring-pink-500 cursor-pointer">
                <label for="chk-res-${res.id}" class="cursor-pointer text-slate-700 font-medium truncate w-full">
                    ${res.apellidos}, ${res.nombre} <span class="text-slate-400 text-[10px]">(Hab. ${res.habitacion || 'N/A'})</span>
                </label>
            `;
            contenedor.appendChild(div);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-red-500 font-medium text-center py-2">Error al sincronizar residentes.</p>`;
    }
}

// Helper para marcar todos los checkboxes de una sola vez
function marcarTodosResidentes(estado) {
    const inputs = document.querySelectorAll('#lista-checkbox-residentes input[type="checkbox"]');
    inputs.forEach(i => i.checked = estado);
}

// --- POST: GUARDAR UN NUEVO REGISTRO ---
async function guardarNuevoRegistroAnimacion(e) {
    e.preventDefault();

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    // 💡 SOLUCIÓN FRONTEND SIN TOCAR EL BACKEND:
    // Almacenamos el ID del empleado. Si tu app en algún momento lo guarda en localStorage, lo usará.
    // Si no existe, usamos el ID 1 (o el ID del usuario por defecto del sistema) para que Spring Boot no lance un error.
    let empleadoId = localStorage.getItem('resi_empleado_id') || 1;

    const checkboxes = document.querySelectorAll('#lista-checkbox-residentes input[type="checkbox"]:checked');
    const residentesIds = Array.from(checkboxes).map(chk => parseInt(chk.value));

    if (residentesIds.length === 0) {
        alert('⚠️ Debes seleccionar al menos un residente participante para guardar la sesión.');
        return;
    }

    const payloadBody = {
        fechaHora: document.getElementById('anim-fechaHora').value,
        actividadRealizada: document.getElementById('anim-actividad').value,
        observaciones: document.getElementById('anim-observaciones').value
    };

    // La URL viaja con el ID limpio hacia tu @RequestParam
    const url = `${baseUrl}/api/registros-animacion?empleadoId=${empleadoId}&residentesIds=${residentesIds.join(',')}`;

    try {
        const respuesta = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadBody)
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la inserción de la actividad.');

        alert('¡Registro de animación guardado correctamente!');

        // Limpieza de interfaz
        document.getElementById('form-crear-animacion').reset();
        marcarTodosResidentes(false);

        // Restaurar fecha actual en el input
        const ahora = new Date();
        ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
        document.getElementById('anim-fechaHora').value = ahora.toISOString().slice(0, 16);

        await cargarHistoricoAnimaciones();

    } catch (error) {
        console.error(error);
        alert(`Error al registrar sesión: ${error.message}`);
    }
}

// --- GET: LISTAR TODOS LOS REGISTROS ---
async function cargarHistoricoAnimaciones() {
    const contenedor = document.getElementById('contenedor-registros-animacion');
    const txtContador = document.getElementById('contador-animaciones');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Consultando libro de actas asistenciales...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-animacion`, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        }); // Mapea el findAllByOrderByFechaHoraDesc()

        if (!respuesta.ok) throw new Error('Fallo al recuperar las actas de animación.');
        const sesiones = await respuesta.json(); //

        contenedor.innerHTML = '';
        txtContador.innerText = `${sesiones.length} registros`;

        if (sesiones.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan actividades de animación sociocultural registradas en el centro.</p>`;
            return;
        }

        sesiones.forEach(s => {
            // Formatear LocalDateTime
            let fechaFormateada = 'N/A';
            if (s.fechaHora) {
                const partes = s.fechaHora.split('T');
                if (partes[0]) {
                    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                    fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
                }
            }

            const profesionalStr = s.empleado ? `${s.empleado.nombre} ${s.empleado.apellidos || ''}` : 'Animador/a del Centro';

            // Unir nombres de residentes participantes ManyToMany
            const participantesStr = s.participantes && s.participantes.length > 0
                ? s.participantes.map(p => `${p.nombre} ${p.apellidos[0] || ''}.`).join(', ')
                : 'Sin participantes registrados';

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-pink-500 hover:shadow-md transition-all";

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-pink-700 bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">🎭 ACTIVIDAD: ${s.actividadRealizada || 'DINÁMICA'}</span>
                    <span>${fechaFormateada}</span>
                </div>
                
                <div class="text-[10px] font-semibold text-slate-500 pl-0.5">
                    👥 Asistentes (${s.participantes ? s.participantes.length : 0}): <span class="text-slate-600 font-medium italic">${participantesStr}</span>
                </div>
                
                ${s.observaciones ? `
                    <div class="text-xs text-slate-700 font-medium bg-slate-50/50 p-2.5 rounded-xl border border-dashed select-text">
                        <strong>Memoria / Evolutivo:</strong> ${s.observaciones}
                    </div>
                ` : ''}
                
                <div class="flex justify-between items-center mt-1 pt-2 border-t border-slate-100/60">
                    <span class="text-[9px] text-slate-400 font-medium">Registrado por: ${profesionalStr}</span>
                    <div class="flex items-center gap-3">
                        <button onclick="abrirModalAnimacion(${s.id}, '${s.actividadRealizada || ''}', \`${s.observaciones ? s.observaciones.replace(/`/g, '\\`').replace(/\$/g, '\\$') : ''}\`)" class="text-[10px] text-pink-600 hover:text-pink-800 font-bold tracking-tight">
                            ✏️ Editar Notas
                        </button>
                        <button onclick="eliminarRegistroAnimacion(${s.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                            🗑️ Eliminar Registro
                        </button>
                    </div>
                </div>
            `;
            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error al sincronizar reportes de animación con el servidor.</p>`;
    }
}

// --- MODAL Y COHESIÓN DE ENLACES PATCH (MODIFICACIÓN) ---
function abrirModalAnimacion(id, actividad, obs) {
    registroSeleccionadaId = id;
    document.getElementById('modal-anim-actividad').value = actividad;
    document.getElementById('modal-anim-observaciones').value = obs;
    document.getElementById('modal-editar-animacion').classList.remove('hidden');
}

function cerrarModalAnimacion() {
    registroSeleccionadaId = null;
    document.getElementById('modal-editar-animacion').classList.add('hidden');
}

// Dispara secuencialmente los PATCH de tu controller para actualizar los dos campos de texto
async function enviarModificacionesServidor() {
    if (!registroSeleccionadaId) return;

    const nuevaActividad = document.getElementById('modal-anim-actividad').value;
    const nuevasObs = document.getElementById('modal-anim-observaciones').value;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        // 1. PATCH Actividad Realizada (/api/registros-animacion/{id}/actividad)
        const resAct = await fetch(`${baseUrl}/api/registros-animacion/${registroSeleccionadaId}/actividad`, {
            method: 'PATCH',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: nuevaActividad // Recibido como @RequestBody String
        });
        if (!resAct.ok) throw new Error('El servidor denegó actualizar el título de la actividad.');

        // 2. PATCH Observaciones (/api/registros-animacion/{id}/observaciones)
        const resObs = await fetch(`${baseUrl}/api/registros-animacion/${registroSeleccionadaId}/observaciones`, {
            method: 'PATCH',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: nuevasObs // Recibido como @RequestBody String
        });
        if (!resObs.ok) throw new Error('El servidor denegó actualizar el evolutivo descriptivo.');

        cerrarModalAnimacion();
        await cargarHistoricoAnimaciones();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar modificaciones: ${error.message}`);
    }
}

// --- DELETE: ELIMINACIÓN DE REGISTROS ---
async function eliminarRegistroAnimacion(id) {
    if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar permanentemente esta acta de animación? Esta acción es irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-animacion/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        }); // Mapeado al deleteById de tu repositorio

        if (!respuesta.ok) throw new Error('El servidor rechazó eliminar físicamente el registro.');

        await cargarHistoricoAnimaciones();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar el registro: ${error.message}`);
    }
}