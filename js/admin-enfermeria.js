// Lógica de Auditoría de Registros de Enfermería
let listadoGlobalRegistros = [];

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional de Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Vinculación de eventos de filtrado en tiempo real
    document.getElementById('buscador-enfermeria').addEventListener('input', filtrarRegistrosEnMemoria);
    document.getElementById('filtro-fecha-enfermeria').addEventListener('change', filtrarRegistrosEnMemoria);
    document.getElementById('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);

    // Carga inicial de todo el libro de enfermería
    cargarTodosLosRegistros();
});

// Sincroniza y descarga todo el histórico clínico directamente
async function cargarTodosLosRegistros() {
    const contenedor = document.getElementById('contenedor-registros-enfermeria');
    const txtContador = document.getElementById('contador-registros');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando evolutivos con el servidor...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-enfermeria`, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        }); // Llama al JpaRepository.findAllByOrderByFechaHoraDesc() en tu backend

        if (!respuesta.ok) throw new Error('Fallo al obtener los registros de enfermería.');
        listadoGlobalRegistros = await respuesta.json(); // Se guardan en memoria

        txtContador.innerText = `${listadoGlobalRegistros.length} registros`;
        renderizarTarjetasRegistro(listadoGlobalRegistros);

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error de red: ${error.message}</p>`;
    }
}

// Renderiza el listado completo de tarjetas de enfermería
function renderizarTarjetasRegistro(lista) {
    const contenedor = document.getElementById('contenedor-registros-enfermeria');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan registros clínicos que coincidan con los filtros.</p>`;
        return;
    }

    lista.forEach(reg => {
        // Formatear LocalDateTime (YYYY-MM-DDTHH:mm:ss)
        let fechaFormateada = 'N/A';
        if (reg.fechaHora) {
            const partes = reg.fechaHora.split('T');
            if (partes[0]) {
                const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
            }
        }

        const afectadoStr = reg.residente ? `${reg.residente.nombre} ${reg.residente.apellidos} (Hab. ${reg.residente.habitacion || 'N/A'})` : 'Residente Desconocido';
        const enfermeroStr = reg.enfermero ? `${reg.enfermero.nombre} ${reg.enfermero.apellidos || ''}` : 'Equipo Sanitario';

        const tarjeta = document.createElement('div');
        tarjeta.className = "bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3 shadow-sm border-l-4 border-l-rose-500 hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-150";

        tarjeta.innerHTML = `
            <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span class="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">👤 AFECTADO: ${afectadoStr}</span>
                <span>${fechaFormateada}</span>
            </div>
            
            <div class="my-0.5 flex items-center gap-1.5">
                <span class="text-[10px] font-bold text-slate-400 uppercase">Acción:</span>
                <span class="bg-rose-50 text-rose-800 border border-rose-200 text-[9px] px-2.5 py-0.5 rounded-md font-extrabold uppercase tracking-tight">
                     🧪 ${reg.tipoAction || reg.tipoAccion || 'INTERVENCIÓN'}
                </span>
            </div>
            
            <div class="text-xs text-slate-700 font-medium bg-slate-50/50 p-3.5 rounded-xl border border-dashed border-slate-200 leading-relaxed whitespace-pre-line select-text">
                ${reg.observacion || 'Sin observaciones detalladas.'}
            </div>
            
            <div class="flex justify-between items-center mt-1 pt-2 border-t border-slate-100/60">
                <span class="text-[9px] text-slate-400 font-medium">Registrado por: ${enfermeroStr}</span>
                <button onclick="eliminarRegistroEnfermeria(${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                    🗑️ Eliminar Registro
                </button>
            </div>
        `;

        contenedor.appendChild(tarjeta);
    });
}

// Filtra la colección en caliente evitando accesos reiterados de red al servidor
function filtrarRegistrosEnMemoria() {
    const busqueda = document.getElementById('buscador-enfermeria').value.toLowerCase().trim();
    const fechaFiltro = document.getElementById('filtro-fecha-enfermeria').value; // YYYY-MM-DD
    const txtContador = document.getElementById('contador-registros');

    let filtrados = listadoGlobalRegistros;

    // Filtro por texto en varios campos
    if (busqueda) {
        filtrados = filtrados.filter(reg => {
            const residente = reg.residente ? `${reg.residente.nombre} ${reg.residente.apellidos} ${reg.residente.habitacion}`.toLowerCase() : '';
            const enfermero = reg.enfermero ? `${reg.enfermero.nombre} ${reg.enfermero.apellidos}`.toLowerCase() : '';
            const accion = (reg.tipoAction || reg.tipoAccion || '').toLowerCase();
            const observaciones = (reg.observacion || '').toLowerCase();

            return residente.includes(busqueda) ||
                enfermero.includes(busqueda) ||
                accion.includes(busqueda) ||
                observaciones.includes(busqueda);
        });
    }

    // Filtro por fecha (compara la parte de la fecha de LocalDateTime)
    if (fechaFiltro) {
        filtrados = filtrados.filter(reg => {
            if (!reg.fechaHora) return false;
            const fechaReg = reg.fechaHora.split('T')[0]; // Toma 'YYYY-MM-DD'
            return fechaReg === fechaFiltro;
        });
    }

    txtContador.innerText = `${filtrados.length} registros`;
    renderizarTarjetasRegistro(filtrados);
}

// Restaura los inputs y vuelve a pintar la colección completa
function limpiarFiltros() {
    document.getElementById('buscador-enfermeria').value = '';
    document.getElementById('filtro-fecha-enfermeria').value = '';
    filtrarRegistrosEnMemoria();
}

// Envía la orden DELETE al endpoint de tu back (/api/registros-enfermeria/{id})
async function eliminarRegistroEnfermeria(id) {
    if (!confirm('⚠️ ¿Estás totalmente seguro de que deseas eliminar permanentemente este registro de enfermería? Esta acción es irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-enfermeria/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }); // Mapea tu @DeleteMapping

        if (!respuesta.ok) throw new Error('El servidor denegó la baja del registro evolutivo.');

        // Refrescar listado actual directamente
        await cargarTodosLosRegistros();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar: ${error.message}`);
    }
}