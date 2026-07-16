// Lógica de Auditoría de Sesiones de Fisioterapia
let listaResidentesGlobal = [];
let sesionSeleccionadaId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional de Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Inicializaciones
    cargarSelectFiltroResidentes();
    cargarSesionesFisioterapia();

    // Eventos de los botones de filtros
    document.getElementById('filtro-residente-fisio').addEventListener('change', filtrarSesionesPorResidente);
    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
        document.getElementById('filtro-residente-fisio').value = '';
        cargarSesionesFisioterapia();
    });

    // Guardar cambios de observaciones en el modal
    document.getElementById('btn-guardar-obs').addEventListener('click', guardarObservacionesServidor);
});

// Carga la lista de residentes en el combobox del panel lateral
async function cargarSelectFiltroResidentes() {
    const select = document.getElementById('filtro-residente-fisio');
    if (!select) return;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo recuperar la lista de residentes.');
        listaResidentesGlobal = await respuesta.json();

        listaResidentesGlobal.forEach(res => {
            const opt = document.createElement('option');
            opt.value = res.id;
            opt.innerText = `${res.apellidos}, ${res.nombre} (Hab. ${res.habitacion || 'N/A'})`;
            select.appendChild(opt);
        });

    } catch (error) {
        console.error("Error al poblar el selector de residentes:", error);
    }
}

// Carga general de sesiones (GET /api/registros-fisio)
async function cargarSesionesFisioterapia(urlEspecifica = null) {
    const contenedor = document.getElementById('contenedor-sesiones-fisio');
    const txtContador = document.getElementById('contador-sesiones');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando diario de rehabilitación...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');
    const url = urlEspecifica || `${baseUrl}/api/registros-fisio`; //

    try {
        const respuesta = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('Fallo al obtener los registros de fisioterapia.');
        const sesiones = await respuesta.json(); //

        contenedor.innerHTML = '';
        txtContador.innerText = `${sesiones.length} sesiones`;

        if (sesiones.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan sesiones de fisioterapia registradas.</p>`;
            return;
        }

        sesiones.forEach(sesion => {
            // Formatear LocalDate (YYYY-MM-DD)
            let fechaFormateada = 'N/A';
            if (sesion.fechaRegistro) {
                fechaFormateada = sesion.fechaRegistro.split('-').reverse().join('/');
            }

            const terapeutaStr = sesion.empleado ? `${sesion.empleado.nombre} ${sesion.empleado.apellidos || ''}` : 'Fisioterapeuta del Centro';

            // Construir la lista de participantes (Badges interactivos con botón "eliminar")
            let listadoParticipantesHTML = '';
            if (sesion.residentes && sesion.residentes.length > 0) { //
                listadoParticipantesHTML = sesion.residentes.map(res => ` //
                    <span class="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        👤 ${res.nombre} ${res.apellidos} (Hab. ${res.habitacion || 'N/A'})
                        <button onclick="retirarResidenteDeSesion(${sesion.id}, ${res.id})" class="text-teal-400 hover:text-teal-800 font-extrabold ml-1 text-xs">
                            &times;
                        </button>
                    </span>
                `).join(' ');
            } else {
                listadoParticipantesHTML = `<span class="text-[10px] text-slate-400 italic">No constan participantes en esta sesión.</span>`;
            }

            // Crear el selector para poder integrar residentes nuevos a la sesión
            let opcionesResidentesHTML = '<option value="">-- Añadir Residente --</option>';
            listaResidentesGlobal.forEach(res => {
                // Evitamos listar a los que ya participan
                const yaParticipa = sesion.residentes && sesion.residentes.some(p => p.id === res.id); //
                if (!yaParticipa) {
                    opcionesResidentesHTML += `<option value="${res.id}">${res.nombre} ${res.apellidos}</option>`;
                }
            });

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3 shadow-sm border-l-4 border-l-teal-500 hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-150";

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">⚡ ${sesion.actividadFisio || 'TERAPIA'}</span>
                    <span>📅 Fecha: ${fechaFormateada}</span>
                </div>
                
                <div class="space-y-1.5">
                    <span class="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Residentes Asistentes:</span>
                    <div class="flex flex-wrap gap-1.5">
                        ${listadoParticipantesHTML}
                    </div>
                </div>

                <div class="text-xs text-slate-700 font-medium bg-slate-50/50 p-3.5 rounded-xl border border-dashed border-slate-200 leading-relaxed select-text">
                    <strong>Observaciones de la sesión:</strong><br>
                    <span id="obs-text-${sesion.id}">${sesion.observaciones || 'Sin anotaciones clínicas redactadas.'}</span>
                </div>

                <div class="flex justify-between items-center mt-1 pt-2.5 border-t border-slate-100/60">
                    <span class="text-[9px] text-slate-400 font-medium">Terapeuta: ${terapeutaStr}</span>
                    
                    <div class="flex items-center gap-3">
                        <select onchange="agregarResidenteASesion(${sesion.id}, this)" class="bg-slate-50 border border-slate-200 text-[10px] px-2 py-1 rounded-lg focus:outline-none focus:border-teal-500 text-slate-600 font-semibold cursor-pointer">
                            ${opcionesResidentesHTML}
                        </select>

                        <button onclick="abrirModalObs(${sesion.id}, \`${sesion.observaciones ? sesion.observaciones.replace(/`/g, '\\`').replace(/\$/g, '\\$') : ''}\`)" class="text-[10px] text-teal-600 hover:text-teal-800 font-bold tracking-tight">
                            ✏️ Editar Notas
                        </button>
                        <button onclick="eliminarSesionFisio(${sesion.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                            🗑️ Eliminar Sesión
                        </button>
                    </div>
                </div>
            `;

            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error al sincronizar con el servidor: ${error.message}</p>`;
    }
}

// Filtra dinámicamente llamando al endpoint específico del back si se escoge un residente
function filtrarSesionesPorResidente() {
    const residenteId = document.getElementById('filtro-residente-fisio').value;
    if (!residenteId) {
        cargarSesionesFisioterapia();
        return;
    }

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const url = `${baseUrl}/api/registros-fisio/residente/${residenteId}`; //
    cargarSesionesFisioterapia(url);
}

// --- ACCIONES DINÁMICAS DE PARTICIPANTES (ManyToMany) ---

// Agrega un residente a la sesión activa (POST /api/registros-fisio/{sesionId}/residentes?residenteId={residenteId})
async function agregarResidenteASesion(sesionId, selectElement) {
    const residenteId = selectElement.value;
    if (!residenteId) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-fisio/${sesionId}/residentes?residenteId=${residenteId}`, { //
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo añadir al residente a la sesión.');

        // Refrescar lista manteniendo filtros activos
        recargarVistaFisio();

    } catch (error) {
        console.error(error);
        alert(`Error al añadir participante: ${error.message}`);
    }
}

// Quita un participante de la sesión (DELETE /api/registros-fisio/{sesionId}/residentes/{residenteId})
async function retirarResidenteDeSesion(sesionId, residenteId) {
    if (!confirm('¿Deseas retirar a este residente de la asistencia de esta sesión de fisioterapia?')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-fisio/${sesionId}/residentes/${residenteId}`, { //
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo remover al participante de la sesión.');

        recargarVistaFisio();

    } catch (error) {
        console.error(error);
        alert(`Error al remover participante: ${error.message}`);
    }
}

// --- MODAL Y PARCIAL ACTUALIZACIÓN DE OBSERVACIONES (PATCH) ---

function abrirModalObs(id, textoActual) {
    sesionSeleccionadaId = id;
    document.getElementById('modal-text-obs').value = textoActual;
    document.getElementById('modal-editar-obs').classList.remove('hidden');
}

function cerrarModalObs() {
    sesionSeleccionadaId = null;
    document.getElementById('modal-editar-obs').classList.add('hidden');
}

// Envía el PATCH de observaciones (/api/registros-fisio/{id}/observaciones)
async function guardarObservacionesServidor() {
    if (!sesionSeleccionadaId) return;

    const nuevasObs = document.getElementById('modal-text-obs').value;
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-fisio/${sesionSeleccionadaId}/observaciones`, { //
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: nuevasObs // El endpoint recibe un @RequestBody String
        });

        if (!respuesta.ok) throw new Error('El servidor rechazó la actualización de observaciones.');

        cerrarModalObs();
        recargarVistaFisio();

    } catch (error) {
        console.error(error);
        alert(`Error al actualizar observaciones: ${error.message}`);
    }
}

// --- ACCIÓN DE ELIMINACIÓN DE SESIÓN COMPLETADA (DELETE) ---

async function eliminarSesionFisio(id) {
    if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar permanentemente esta sesión de fisioterapia? Esta acción removerá el registro de asistencia de todos los participantes de forma irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-fisio/${id}`, { //
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la eliminación física de la sesión.');

        recargarVistaFisio();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar sesión: ${error.message}`);
    }
}

// Helper para refrescar la vista respetando la pestaña o filtro actual
function recargarVistaFisio() {
    const filtroResidente = document.getElementById('filtro-residente-fisio').value;
    if (filtroResidente) {
        filtrarSesionesPorResidente();
    } else {
        cargarSesionesFisioterapia();
    }
}