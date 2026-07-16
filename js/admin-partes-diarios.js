// Lógica de Control del Libro de Partes Diarios
let parteSeleccionadoId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional de Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Vinculación de filtros
    document.getElementById('btn-filtrar-empleado').addEventListener('click', filtrarPorEmpleado);
    document.getElementById('btn-limpiar-partes').addEventListener('click', () => {
        document.getElementById('filtro-empleado-id').value = '';
        cargarPartesDiarios();
    });

    // Acción para guardar del modal (PATCH)
    document.getElementById('btn-guardar-correccion').addEventListener('click', enviarContenidoCorregido);

    // Carga inicial
    cargarPartesDiarios();
});

// Obtiene los partes consumiendo el GET global
async function cargarPartesDiarios(urlEspecifica = null) {
    const contenedor = document.getElementById('contenedor-partes-diarios');
    const txtContador = document.getElementById('contador-partes');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Recuperando partes del archivo general...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');
    const url = urlEspecifica || `${baseUrl}/api/partes-diarios`;

    try {
        const respuesta = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('Fallo al recuperar los partes diarios del servidor.');
        const partes = await respuesta.json();

        contenedor.innerHTML = '';
        txtContador.innerText = `${partes.length} partes registrados`;

        if (partes.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan partes diarios cargados en el sistema.</p>`;
            return;
        }

        // Renderizar las tarjetas de partes
        partes.forEach(parte => {
            // Formatear la fecha LocalDate (YYYY-MM-DD)
            let fechaFormateada = 'N/A';
            if (parte.fecha) {
                fechaFormateada = parte.fecha.split('-').reverse().join('/');
            }

            const creadorStr = parte.creador ? `${parte.creador.nombre} ${parte.creador.apellidos || ''} (ID: ${parte.creador.id})` : 'Personal del Centro';

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3.5 shadow-sm border-l-4 border-l-amber-500 hover:shadow-md transition-all";

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">📅 DÍA DEL PARTE: ${fechaFormateada}</span>
                    <span>Creador: ${creadorStr}</span>
                </div>
                
                <div class="text-xs text-slate-700 font-medium bg-slate-50/50 p-3.5 rounded-xl border border-dashed border-slate-200 leading-relaxed whitespace-pre-line select-text">
                    ${parte.contenido || 'No se ingresó ninguna anotación de resumen para esta fecha.'}
                </div>
                
                <div class="flex justify-end items-center gap-4 pt-2 border-t border-slate-100/60">
                    <button onclick="abrirModalEdicion(${parte.id}, '${fechaFormateada}', '${creadorStr}', \`${parte.contenido ? parte.contenido.replace(/`/g, '\\`').replace(/\$/g, '\\$') : ''}\`)" class="text-[10px] text-amber-600 hover:text-amber-800 font-bold tracking-tight flex items-center gap-1">
                        ✏️ Corregir Contenido
                    </button>
                    <button onclick="eliminarParteDiario(${parte.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight flex items-center gap-1">
                        🗑️ Eliminar Parte
                    </button>
                </div>
            `;
            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error de comunicación: ${error.message}</p>`;
    }
}

// Filtra los partes diarios por la ID del empleado creador
function filtrarPorEmpleado() {
    const empleadoId = document.getElementById('filtro-empleado-id').value.trim();
    if (!empleadoId) {
        alert('Por favor, introduce un ID de empleado válido.');
        return;
    }

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const url = `${baseUrl}/api/partes-diarios/empleado/${empleadoId}`;

    cargarPartesDiarios(url);
}

// --- ACCIONES DE EDICIÓN (PATCH) ---

function abrirModalEdicion(id, fecha, creador, contenido) {
    parteSeleccionadoId = id;

    document.getElementById('modal-fecha-parte').innerText = `Parte del ${fecha}`;
    document.getElementById('modal-creador-parte').innerText = creador;
    document.getElementById('modal-textarea-contenido').value = contenido;

    document.getElementById('modal-editar-parte').classList.remove('hidden');
}

function cerrarModalEdicion() {
    parteSeleccionadoId = null;
    document.getElementById('modal-editar-parte').classList.add('hidden');
    document.getElementById('modal-textarea-contenido').value = '';
}

// Lanza el PATCH para realizar la corrección del texto del parte
async function enviarContenidoCorregido() {
    if (!parteSeleccionadoId) return;

    const nuevoContenido = document.getElementById('modal-textarea-contenido').value;
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        // Tu controller recibe el String corregido en un @RequestBody y lo pasa al service
        const respuesta = await fetch(`${baseUrl}/api/partes-diarios/${parteSeleccionadoId}/contenido`, {
            method: 'PATCH',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: nuevoContenido // Envía la cadena de texto plano o JSON según manejes Jackson
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la corrección del texto.');

        cerrarModalEdicion();

        // Refrescar listado actual de partes
        const filtroEmpleadoId = document.getElementById('filtro-empleado-id').value.trim();
        if (filtroEmpleadoId) {
            filtrarPorEmpleado();
        } else {
            cargarPartesDiarios();
        }

    } catch (error) {
        console.error(error);
        alert(`Error al guardar la corrección: ${error.message}`);
    }
}

// --- ACCIÓN DE ELIMINACIÓN (DELETE) ---

async function eliminarParteDiario(id) {
    if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar permanentemente este resumen diario de la base de datos de la residencia? Esta acción es irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/partes-diarios/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!respuesta.ok) throw new Error('El servidor rechazó la baja física del parte diario.');

        // Refrescar lista actual
        const filtroEmpleadoId = document.getElementById('filtro-empleado-id').value.trim();
        if (filtroEmpleadoId) {
            filtrarPorEmpleado();
        } else {
            cargarPartesDiarios();
        }

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar el parte: ${error.message}`);
    }
}