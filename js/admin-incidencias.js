// Lógica de Auditoría y Control del Libro de Incidencias
let listaGlobalResidentes = [];
let residenteSeleccionadoId = null; // null significa que estamos viendo el histórico global

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control Institucional de Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Vinculación del buscador de la barra de filtros
    document.getElementById('buscador-incidencias-residente').addEventListener('input', filtrarResidentesIncidencias);

    // Botón para restaurar la vista al feed global
    document.getElementById('btn-mostrar-todo').addEventListener('click', () => {
        residenteSeleccionadoId = null;
        document.getElementById('titulo-vista-incidencias').innerText = "Histórico Completo de Eventos";
        renderizarFichasResidentesLateral(listaGlobalResidentes);
        cargarIncidenciasDelServidor();
    });

    // Carga inicial
    cargarDatosIniciales();
});

// Sincroniza residentes y luego trae el libro de incidencias
async function cargarDatosIniciales() {
    await cargarResidentesDesdeServidor();
    await cargarIncidenciasDelServidor();
}

// Consume tu API de residentes para rellenar la barra lateral de filtros
async function cargarResidentesDesdeServidor() {
    const contenedor = document.getElementById('lista-incidencias-residentes');
    const txtContador = document.getElementById('contador-residentes');
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

        if (!respuesta.ok) throw new Error('Fallo al sincronizar el fichero de residentes.');
        listaGlobalResidentes = await respuesta.json();

        if (txtContador) txtContador.innerText = `${listaGlobalResidentes.length} res.`;
        renderizarFichasResidentesLateral(listaGlobalResidentes);

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-[11px] text-red-500 font-medium py-2">Error: ${error.message}</p>`;
    }
}

// Dibuja las mini-tarjetas en la columna izquierda
function renderizarFichasResidentesLateral(lista) {
    const contenedor = document.getElementById('lista-incidencias-residentes');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    lista.forEach(res => {
        const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
        const seleccionado = residenteSeleccionadoId === res.id;

        const item = document.createElement('div');
        item.className = `p-2.5 cursor-pointer flex items-center justify-between rounded-xl bg-white border border-slate-200 select-none shadow-sm hover:border-orange-400 hover:bg-orange-50/5 transition-all ${seleccionado ? 'border-orange-500 bg-orange-50/10 shadow-sm ring-1 ring-orange-200' : ''
            }`;

        item.innerHTML = `
            <div class="flex items-center gap-2.5 truncate">
                <div class="w-7 h-7 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0">
                    ${iniciales}
                </div>
                <div class="truncate text-left">
                    <span class="font-bold text-[11px] text-slate-700 block truncate">${res.nombre} ${res.apellidos}</span>
                    <span class="text-[9px] text-slate-400 block font-medium">Habitación: ${res.habitacion || 'N/A'}</span>
                </div>
            </div>
            <span class="text-[10px] font-bold text-slate-300 px-1">&rarr;</span>
        `;

        item.addEventListener('click', () => {
            residenteSeleccionadoId = res.id;
            document.getElementById('titulo-vista-incidencias').innerText = `Incidencias de: ${res.nombre} ${res.apellidos}`;
            renderizarFichasResidentesLateral(listaGlobalResidentes); // Re-pintar selección activa
            cargarIncidenciasDelServidor();
        });

        contenedor.appendChild(item);
    });
}

// Filtro offline para agilizar la navegación de la barra lateral
function filtrarResidentesIncidencias(e) {
    const termino = e.target.value.toLowerCase().trim();
    if (!termino) {
        renderizarFichasResidentesLateral(listaGlobalResidentes);
        return;
    }

    const filtrados = listaGlobalResidentes.filter(res =>
        (res.nombre && res.nombre.toLowerCase().includes(termino)) ||
        (res.apellidos && res.apellidos.toLowerCase().includes(termino)) ||
        (res.habitacion && res.habitacion.toLowerCase().includes(termino))
    );

    renderizarFichasResidentesLateral(filtrados);
}

// Obtiene los datos del Controller de Incidencias (global o filtrado por residente)
async function cargarIncidenciasDelServidor() {
    const contenedor = document.getElementById('contenedor-feeder-incidencias');
    const txtContador = document.getElementById('contador-incidencias');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Consultando el libro de guardia...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    // Mapeo dinámico de URL según los GET de tu IncidenciaController
    let url = `${baseUrl}/api/incidencias`;
    if (residenteSeleccionadoId) {
        url += `/residente/${residenteSeleccionadoId}`;
    }

    try {
        const respuesta = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo acceder al repositorio de incidencias.');
        const incidencias = await respuesta.json();

        contenedor.innerHTML = '';
        txtContador.innerText = `${incidencias.length} reportes`;

        if (incidencias.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan partes de incidencia registrados en este bloque.</p>`;
            return;
        }

        // Procesar e inyectar tarjetas del feed
        incidencias.forEach(inc => {
            // Formateo manual de LocalDateTime
            let fechaFormateada = 'N/A';
            if (inc.fechaHora) {
                const partes = inc.fechaHora.split('T');
                if (partes[0]) {
                    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                    fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
                }
            }

            const afectadoStr = inc.residente ? `${inc.residente.nombre} ${inc.residente.apellidos} (Hab. ${inc.residente.habitacion || 'N/A'})` : 'Personal / General';
            const informadorStr = inc.empleado ? `${inc.empleado.nombre} ${inc.empleado.apellidos || ''}` : 'Turno de Guardia';

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-orange-500 hover:shadow-md transition-all";

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">👤 AFECTADO: ${afectadoStr}</span>
                    <span>${fechaFormateada}</span>
                </div>
                
                <div class="my-0.5 flex items-center gap-1.5">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Categoría:</span>
                    <span class="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-tight">
                        ⚡ ${inc.tipo || 'ANOMALÍA'}
                    </span>
                </div>
                
                <div class="text-xs text-slate-700 font-medium bg-slate-50/60 p-3 rounded-xl border border-dashed border-slate-200 leading-relaxed select-text">
                    ${inc.descripcion || 'Sin descripción detallada registrada.'}
                </div>
                
                <div class="flex justify-between items-center mt-1 pt-2 border-t border-slate-100">
                    <span class="text-[9px] text-slate-400 font-medium">Reportado por: ${informadorStr}</span>
                    <button onclick="eliminarParteIncidencia(${inc.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                        🗑️ Eliminar Parte
                    </button>
                </div>
            `;

            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error al sincronizar el libro con el servidor.</p>`;
    }
}

// Envía la orden DELETE al endpoint del back (/api/incidencias/{id})
async function eliminarParteIncidencia(id) {
    if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar permanentemente este parte de incidencia? Esta acción purgará el reporte clínico de forma irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/incidencias/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la eliminación física del registro.');

        // Refrescar listado en caliente con el filtro actual
        await cargarIncidenciasDelServidor();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar la incidencia: ${error.message}`);
    }
}