// Lógica de Auditoría de Sesiones y Registros del Área de Psicología
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

    // Cargas iniciales
    cargarSelectFiltroResidentes();
    cargarSesionesPsicologia();

    // Eventos de Filtrado
    document.getElementById('filtro-residente-psicologia').addEventListener('change', filtrarSesionesPorResidente);
    document.getElementById('btn-limpiar-filtros-psicologia').addEventListener('click', () => {
        document.getElementById('filtro-residente-psicologia').value = '';
        cargarSesionesPsicologia();
    });

    // Guardado del modal de descripción
    document.getElementById('btn-guardar-desc-psico').addEventListener('click', enviarDescripcionCorregida);
});

// Carga la lista completa de residentes en el selector del panel lateral
async function cargarSelectFiltroResidentes() {
    const select = document.getElementById('filtro-residente-psicologia');
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

        if (!respuesta.ok) throw new Error('No se pudo sincronizar la lista de residentes.');
        listaResidentesGlobal = await respuesta.json();

        listaResidentesGlobal.forEach(res => {
            const opt = document.createElement('option');
            opt.value = res.id;
            opt.innerText = `${res.apellidos}, ${res.nombre} (Hab. ${res.habitacion || 'N/A'})`;
            select.appendChild(opt);
        });

    } catch (error) {
        console.error("Error al poblar select de residentes:", error);
    }
}

// Carga cronológica de las sesiones (GET /api/registros-psicologia)
async function cargarSesionesPsicologia(urlEspecifica = null) {
    const contenedor = document.getElementById('contenedor-sesiones-psicologia');
    const txtContador = document.getElementById('contador-sesiones-psicologia');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando diario de intervención psicológica...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');
    const url = urlEspecifica || `${baseUrl}/api/registros-psicologia`; //

    try {
        const respuesta = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('Error al obtener los informes del área de psicología.');
        const sesiones = await respuesta.json(); // Array devuelto por el back

        contenedor.innerHTML = '';
        txtContador.innerText = `${sesiones.length} sesiones`;

        if (sesiones.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan informes ni evolutivos de psicología registrados.</p>`;
            return;
        }

        sesiones.forEach(sesion => {
            // Formatear LocalDateTime (fecha)
            let fechaFormateada = 'N/A';
            if (sesion.fecha) {
                const partes = sesion.fecha.split('T');
                if (partes[0]) {
                    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                    fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
                }
            }

            const profesionalStr = sesion.empleado ? `${sesion.empleado.nombre} ${sesion.empleado.apellidos || ''}` : 'Psicólogo/a de Guardia';

            // Construir la lista de participantes de la sesión (ManyToMany) con botón para quitarlos
            let participantesHTML = '';
            if (sesion.residentes && sesion.residentes.length > 0) { //
                participantesHTML = sesion.residentes.map(res => ` //
                    <span class="inline-flex items-center gap-1 bg-violet-50 text-violet-800 border border-violet-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        👤 ${res.nombre} ${res.apellidos} (Hab. ${res.habitacion || 'N/A'})
                        <button onclick="removerResidenteDeSesion(${sesion.id}, ${res.id})" class="text-violet-400 hover:text-violet-800 font-extrabold ml-1 text-xs">
                            &times;
                        </button>
                    </span>
                `).join(' ');
            } else {
                participantesHTML = `<span class="text-[10px] text-slate-400 italic">Sin participantes asignados a esta sesión.</span>`;
            }

            // Select dinámico para añadir nuevos residentes a la sesión
            let opcionesAnadirHTML = '<option value="">-- Añadir Participante --</option>';
            listaResidentesGlobal.forEach(res => {
                const yaAsiste = sesion.residentes && sesion.residentes.some(p => p.id === res.id); //
                if (!yaAsiste) {
                    opcionesAnadirHTML += `<option value="${res.id}">${res.nombre} ${res.apellidos}</option>`;
                }
            });

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3 shadow-sm border-l-4 border-l-violet-500 hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-150";

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">⚡ ${sesion.tipoRegistro || 'VALORACIÓN'} • ${sesion.categoriaActividad || 'GENERAL'}</span>
                    <span>📅 ${fechaFormateada}</span>
                </div>
                
                <div class="space-y-1.5">
                    <span class="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Residentes Evaluados / Asistentes:</span>
                    <div class="flex flex-wrap gap-1.5">
                        ${participantesHTML}
                    </div>
                </div>

                <div class="text-xs text-slate-700 font-medium bg-slate-50/50 p-3.5 rounded-xl border border-dashed border-slate-200 leading-relaxed whitespace-pre-line select-text">
                    <strong>Evolutivo / Memoria de intervención:</strong><br>
                    <span>${sesion.descripcion || 'Sin descripción detallada redactada.'}</span>
                </div>

                <div class="flex justify-between items-center mt-1 pt-2.5 border-t border-slate-100/60">
                    <span class="text-[9px] text-slate-400 font-medium">Profesional: ${profesionalStr}</span>
                    
                    <div class="flex items-center gap-3">
                        <select onchange="incorporarResidenteASesion(${sesion.id}, this)" class="bg-slate-50 border border-slate-200 text-[10px] px-2 py-1 rounded-lg focus:outline-none focus:border-violet-500 text-slate-600 font-semibold cursor-pointer">
                            ${opcionesAnadirHTML}
                        </select>

                        <button onclick="abrirModalPsico(${sesion.id}, \`${sesion.descripcion ? sesion.descripcion.replace(/`/g, '\\`').replace(/\$/g, '\\$') : ''}\`)" class="text-[10px] text-violet-600 hover:text-violet-800 font-bold tracking-tight">
                            ✏️ Editar Memoria
                        </button>
                        <button onclick="eliminarRegistroPsicologia(${sesion.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                            🗑️ Eliminar Registro
                        </button>
                    </div>
                </div>
            `;

            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error en la red: ${error.message}</p>`;
    }
}

// Intercepta el select de residente lateral y re-enruta el GET específico del controlador
function filtrarSesionesPorResidente() {
    const residenteId = document.getElementById('filtro-residente-psicologia').value;
    if (!residenteId) {
        cargarSesionesPsicologia();
        return;
    }

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const url = `${baseUrl}/api/registros-psicologia/residente/${residenteId}`; //
    cargarSesionesPsicologia(url);
}

// --- CONTROLES PARTICIPANTES MANY-TO-MANY ---

// Añade un residente al array de participantes (POST /api/registros-psicologia/{id}/residentes?residenteId={id})
async function incorporarResidenteASesion(sesionId, select) {
    const residenteId = select.value;
    if (!residenteId) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-psicologia/${sesionId}/residentes?residenteId=${residenteId}`, { //
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error('El servidor rechazó integrar al residente.');

        refrescarVistaModulo();

    } catch (error) {
        console.error(error);
        alert(`Error al añadir participante: ${error.message}`);
    }
}

// Remueve un residente de la lista (DELETE /api/registros-psicologia/{id}/residentes/{residenteId})
async function removerResidenteDeSesion(sesionId, residenteId) {
    if (!confirm('¿Estás seguro de desvincular a este residente de la sesión psicológica?')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-psicologia/${sesionId}/residentes/${residenteId}`, { //
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error('El servidor rechazó quitar al residente de la sesión.');

        refrescarVistaModulo();

    } catch (error) {
        console.error(error);
        alert(`Error al retirar participante: ${error.message}`);
    }
}

// --- MANIPULACIÓN DE DESCRIPCIÓN MEDIANTE MODAL (PATCH) ---

function abrirModalPsico(id, textoActual) {
    sesionSeleccionadaId = id;
    document.getElementById('modal-text-desc-psico').value = textoActual;
    document.getElementById('modal-editar-desc-psico').classList.remove('hidden');
}

function cerrarModalPsico() {
    sesionSeleccionadaId = null;
    document.getElementById('modal-editar-desc-psico').classList.add('hidden');
}

// Lanza la solicitud PATCH al endpoint (/api/registros-psicologia/{id}/descripcion)
async function enviarDescripcionCorregida() {
    if (!sesionSeleccionadaId) return;

    const nuevaDesc = document.getElementById('modal-text-desc-psico').value;
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-psicologia/${sesionSeleccionadaId}/descripcion`, { //
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: nuevaDesc // Recibido como un String en el @RequestBody
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la corrección de la descripción.');

        cerrarModalPsico();
        refrescarVistaModulo();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar la corrección: ${error.message}`);
    }
}

// --- ELIMINACIÓN DE REGISTROS COMPLETOS (DELETE) ---

async function eliminarRegistroPsicologia(id) {
    if (!confirm('⚠️ ¿Estás completamente seguro de eliminar permanentemente este registro de psicología? Se perderán las valoraciones clínicas y actas asociadas de forma irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-psicologia/${id}`, { //
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }); // Enlazado con borrarRegistro del service

        if (!respuesta.ok) throw new Error('El servidor rechazó la anulación física del registro.');

        refrescarVistaModulo();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar la sesión: ${error.message}`);
    }
}

// Helper para refrescar respetando los filtros que el director tenga marcados
function refrescarVistaModulo() {
    const filtroResidente = document.getElementById('filtro-residente-psicologia').value;
    if (filtroResidente) {
        filtrarSesionesPorResidente();
    } else {
        cargarSesionesPsicologia();
    }
}