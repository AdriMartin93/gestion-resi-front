// Lógica de Auditoría y Control del Fichero de Residentes
let listaGlobalResidentes = [];
let residenteSeleccionadoId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Vinculación del Buscador en Vivo
    document.getElementById('buscador-admin-residente').addEventListener('input', filtrarResidentesEnMemoria);

    // Vinculación del Envío del Formulario
    document.getElementById('form-actualizar-residente').addEventListener('submit', actualizarExpedienteResidente);

    // Vinculación del Botón Eliminar
    document.getElementById('btn-eliminar-residente').addEventListener('click', darDeBajaResidente);

    // Carga de Datos desde la API
    cargarResidentesDesdeServidor();
});

// Consume el GET global para traer el listado ordenado
async function cargarResidentesDesdeServidor() {
    const listaContenedor = document.getElementById('lista-admin-residentes');
    const txtContador = document.getElementById('contador-residentes');
    listaContenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Sincronizando expedientes...</p>`;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('Fallo al leer la tabla de residentes.');
        listaGlobalResidentes = await respuesta.json();

        txtContador.innerText = `${listaGlobalResidentes.length} expedientes`;
        renderizarFichasResidentes(listaGlobalResidentes);

    } catch (error) {
        console.error(error);
        listaContenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error de red: ${error.message}</p>`;
    }
}

// Renderiza las tarjetas reducidas con avatar en la columna izquierda
function renderizarFichasResidentes(lista) {
    const listaContenedor = document.getElementById('lista-admin-residentes');
    listaContenedor.innerHTML = '';

    if (lista.length === 0) {
        listaContenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Ningún expediente coincide con los criterios.</p>`;
        return;
    }

    lista.forEach(res => {
        const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();

        const item = document.createElement('div');
        item.className = `card-premium p-3 cursor-pointer flex items-center justify-between bg-white border border-slate-200 select-none shadow-sm hover:border-emerald-500 hover:bg-emerald-50/5 ${residenteSeleccionadoId === res.id ? 'border-emerald-500 bg-emerald-50/10 shadow-md ring-1 ring-emerald-200' : ''}`;

        item.innerHTML = `
            <div class="flex items-center gap-3 truncate">
                <div class="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0 id-avatar-mini">
                    ${iniciales}
                </div>
                <div class="truncate text-left">
                    <span class="font-bold text-xs text-slate-700 block truncate">${res.nombre} ${res.apellidos}</span>
                    <span class="text-[10px] text-slate-400 block font-medium">Hab: ${res.habitacion || 'N/A'} • DNI: ${res.dni || 'N/A'}</span>
                </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 px-2">&rarr;</span>
        `;

        item.addEventListener('click', () => abrirFichaDeEdicion(res));
        listaContenedor.appendChild(item);
    });
}

// Filtra la colección local reduciendo accesos innecesarios a la base de datos
function filtrarResidentesEnMemoria(e) {
    const termino = e.target.value.toLowerCase().trim();
    if (!termino) {
        renderizarFichasResidentes(listaGlobalResidentes);
        return;
    }

    const filtrados = listaGlobalResidentes.filter(res => {
        return (res.nombre && res.nombre.toLowerCase().includes(termino)) ||
            (res.apellidos && res.apellidos.toLowerCase().includes(termino)) ||
            (res.habitacion && res.habitacion.toLowerCase().includes(termino)) ||
            (res.dni && res.dni.toLowerCase().includes(termino));
    });

    renderizarFichasResidentes(filtrados);
}

// Al hacer clic, carga los valores dentro de los inputs del formulario derecho
function abrirFichaDeEdicion(residente) {
    residenteSeleccionadoId = residente.id;

    // Refrescar clases visuales de selección de la columna izquierda
    cargarResidentesDesdeServidor; // Recargar solo re-pinta si lo deseamos, pero mejor manipulamos el DOM en caliente o renderizamos de nuevo
    renderizarFichasResidentes(listaGlobalResidentes);

    document.getElementById('panel-vacio-residente').classList.add('hidden');
    document.getElementById('formulario-edicion-residente').classList.remove('hidden');

    document.getElementById('txt-id-residente').innerText = `ID: ${residente.id}`;
    document.getElementById('edit-nombre').value = residente.nombre || '';
    document.getElementById('edit-apellidos').value = residente.apellidos || '';
    document.getElementById('edit-dni').value = residente.dni || '';
    document.getElementById('edit-tis').value = residente.tis || '';
    document.getElementById('edit-habitacion').value = residente.habitacion || '';
    document.getElementById('edit-fechaNacimiento').value = residente.fechaNacimiento || '';
}

// Lanza un PATCH asíncrono modificado con actualización parcial
async function actualizarExpedienteResidente(e) {
    e.preventDefault();
    if (!residenteSeleccionadoId) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

    const payloadPatch = {
        nombre: document.getElementById('edit-nombre').value,
        apellidos: document.getElementById('edit-apellidos').value,
        dni: document.getElementById('edit-dni').value,
        tis: document.getElementById('edit-tis').value,
        habitacion: document.getElementById('edit-habitacion').value,
        fechaNacimiento: document.getElementById('edit-fechaNacimiento').value
    };

    try {
        const respuesta = await fetch(`${baseUrl}/api/residentes/${residenteSeleccionadoId}`, {
            method: 'PATCH', // Enlazado con @PatchMapping del backend
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadPatch)
        });

        if (!respuesta.ok) throw new Error('Error al modificar los campos del expediente.');

        alert('¡Cambios guardados con éxito! El expediente ha sido actualizado en la base de datos.');

        // Recargar listado manteniendo la visualización
        await cargarResidentesDesdeServidor();

    } catch (error) {
        console.error(error);
        alert(`Error al procesar la actualización: ${error.message}`);
    }
}

// Lanza un DELETE al identificador asignado
async function darDeBajaResidente() {
    if (!residenteSeleccionadoId) return;
    const nombreCompleto = document.getElementById('edit-nombre').value;

    if (!confirm(`⚠ ¿Estás seguro de que deseas eliminar de forma PERMANENTE el expediente de ${nombreCompleto}? Esta acción borrará su historial clínico asociado.`)) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

    try {
        const respuesta = await fetch(`${baseUrl}/api/residentes/${residenteSeleccionadoId}`, {
            method: 'DELETE', // Enlazado con @DeleteMapping del backend
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo procesar la baja en el repositorio.');

        alert('El expediente ha sido borrado definitivamente del sistema.');

        // Limpiar formulario derecho y volver al panel vacío
        residenteSeleccionadoId = null;
        document.getElementById('form-actualizar-residente').reset();
        document.getElementById('formulario-edicion-residente').classList.add('hidden');
        document.getElementById('panel-vacio-residente').classList.remove('hidden');

        // Recargar lista izquierda
        cargarResidentesDesdeServidor();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar: ${error.message}`);
    }
}