// Lógica de Gestión y Auditoría de Cuidados Diarios
let tabActiva = 'higiene'; // Posibles valores: 'higiene', 'cambios', 'evacuaciones'

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Seguridad Institucional
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Inicializaciones
    cargarSelectResidentes();
    cargarRegistrosCuidados();

    // Eventos de los botones de filtros
    document.getElementById('btn-aplicar-filtros').addEventListener('click', cargarRegistrosCuidados);
    document.getElementById('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);
});

// Carga de residentes en el combobox lateral de filtrado
async function cargarSelectResidentes() {
    const select = document.getElementById('filtro-residente');
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
        const residentes = await respuesta.json();

        residentes.forEach(res => {
            const opt = document.createElement('option');
            opt.value = res.id;
            opt.innerText = `${res.apellidos}, ${res.nombre} (Hab. ${res.habitacion || 'N/A'})`;
            select.appendChild(opt);
        });

    } catch (error) {
        console.error("Error al cargar los residentes en el filtro:", error);
    }
}

// Cambiar de pestaña (Tab) de forma visual e invocar recarga de datos
function cambiarTab(nuevaTab) {
    tabActiva = nuevaTab;

    // Actualizar estilos visuales de los botones de las pestañas
    const tabs = {
        higiene: document.getElementById('tab-higiene'),
        cambios: document.getElementById('tab-cambios'),
        evacuaciones: document.getElementById('tab-evacuaciones')
    };

    const titulos = {
        higiene: 'Histórico de Higiene',
        cambios: 'Histórico de Cambios Posturales',
        evacuaciones: 'Histórico de Control de Evacuaciones'
    };

    // Remover clases activas de todas las pestañas
    Object.keys(tabs).forEach(key => {
        tabs[key].className = "tab-btn flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-700 transition-all";
    });

    // Añadir clase activa a la pestaña seleccionada
    tabs[nuevaTab].className = "tab-btn flex-1 py-2 text-xs font-bold rounded-lg text-sky-600 transition-all bg-white shadow-sm";
    document.getElementById('titulo-seccion-cuidados').innerText = titulos[nuevaTab];

    cargarRegistrosCuidados();
}

// Limpia los filtros y recarga la pestaña actual
function limpiarFiltros() {
    document.getElementById('filtro-residente').value = '';
    document.getElementById('filtro-fecha').value = '';
    cargarRegistrosCuidados();
}

// Función centralizadora para consultar los endpoints del Controller de Cuidados
async function cargarRegistrosCuidados() {
    const contenedor = document.getElementById('contenedor-historico-cuidados');
    const txtContador = document.getElementById('contador-cuidados');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando registros con el servidor...</p>`;

    const residenteId = document.getElementById('filtro-residente').value;
    const fecha = document.getElementById('filtro-fecha').value;
    const token = localStorage.getItem('resi_token');
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

    // Determinar la URL correcta según la API de tu back
    let url = `${baseUrl}/api/cuidados`;

    if (tabActiva === 'higiene') url += '/higiene';
    else if (tabActiva === 'cambios') url += '/cambios-posturales';
    else if (tabActiva === 'evacuaciones') url += '/evacuaciones';

    if (residenteId) {
        url += `/residente/${residenteId}`;
    }

    // Si hay fecha se añade como queryparam (?fecha=YYYY-MM-DD)
    if (fecha) {
        url += `?fecha=${fecha}`;
    }

    try {
        const respuesta = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('Error al conectar con la base de datos de cuidados.');
        const datos = await respuesta.json();

        contenedor.innerHTML = '';
        txtContador.innerText = `${datos.length} registros`;

        if (datos.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan registros para los criterios de búsqueda especificados.</p>`;
            return;
        }

        datos.forEach(reg => {
            let tarjeta = null;
            if (tabActiva === 'higiene') {
                tarjeta = crearTarjetaHigiene(reg);
            } else if (tabActiva === 'cambios') {
                tarjeta = crearTarjetaCambioPostural(reg);
            } else if (tabActiva === 'evacuaciones') {
                tarjeta = crearTarjetaEvacuaciones(reg);
            }
            if (tarjeta) contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error en el servidor: ${error.message}</p>`;
    }
}

// Formateador de LocalDateTime
function formatearFechaHora(fechaHoraString) {
    if (!fechaHoraString) return 'N/A';
    const partes = fechaHoraString.split('T');
    if (!partes[0]) return 'N/A';
    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
    return partes[0].split('-').reverse().join('/') + hora;
}

// --- GENERADORES DINÁMICOS DE TARJETAS ---

function crearTarjetaHigiene(reg) {
    const tarjeta = document.createElement('div');
    tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-sky-500 hover:shadow-md transition-all";

    const residenteStr = reg.residente ? `${reg.residente.nombre} ${reg.residente.apellidos} (Hab. ${reg.residente.habitacion || 'N/A'})` : 'Residente Desconocido';
    const empleadoStr = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Personal del Centro';

    // Mapear los booleanos/Estados del back (EstadoTarea)
    const tareas = [
        { label: 'Ducha', val: reg.ducha },
        { label: 'H. Íntima', val: reg.higieneIntima },
        { label: 'H. Bucal', val: reg.higieneBucal },
        { label: 'Afeitado', val: reg.afeitado },
        { label: 'Hidratación', val: reg.hidratacionPiel },
        { label: 'Corte Uñas', val: reg.corteUnas },
        { label: 'Levantar', val: reg.levantarResidente }
    ];

    const badgesTareas = tareas.map(t => {
        const color = t.val === 'REALIZADO' || t.val === 'HECHO' || t.val === 'SI'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : 'bg-slate-50 text-slate-400 border-slate-100';
        return `<span class="border px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-tight inline-block ${color}">${t.label}: ${t.val || 'N/R'}</span>`;
    }).join(' ');

    tarjeta.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span class="text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">👤 RESIDENTE: ${residenteStr}</span>
            <span>${formatearFechaHora(reg.fechaHora)}</span>
        </div>
        
        <div class="flex flex-wrap gap-1 mt-1">
            ${badgesTareas}
        </div>
        
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <span class="text-[9px] text-slate-400 font-medium">Registrado por: ${empleadoStr}</span>
            <button onclick="eliminarRegistro('higiene', ${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                🗑️ Eliminar Registro
            </button>
        </div>
    `;
    return tarjeta;
}

function crearTarjetaCambioPostural(reg) {
    const tarjeta = document.createElement('div');
    tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-indigo-500 hover:shadow-md transition-all";

    const residenteStr = reg.residente ? `${reg.residente.nombre} ${reg.residente.apellidos} (Hab. ${reg.residente.habitacion || 'N/A'})` : 'Residente Desconocido';
    const empleadoStr = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Personal del Centro';

    tarjeta.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span class="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">👤 RESIDENTE: ${residenteStr}</span>
            <span>${formatearFechaHora(reg.fechaHora)}</span>
        </div>
        
        <div class="my-1 flex items-center gap-2">
            <span class="text-xs font-bold text-slate-600">Posición:</span>
            <span class="bg-indigo-100 text-indigo-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-indigo-200 uppercase">${reg.posicion || 'NO DEF'}</span>
        </div>

        <div class="text-xs text-slate-700 font-medium bg-slate-50/50 p-2 rounded-xl border border-dashed select-text">
            <strong>Observaciones:</strong> ${reg.observaciones || 'Sin anotaciones.'}
        </div>
        
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <span class="text-[9px] text-slate-400 font-medium">Registrado por: ${empleadoStr}</span>
            <button onclick="eliminarRegistro('cambios-posturales', ${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                🗑️ Eliminar Registro
            </button>
        </div>
    `;
    return tarjeta;
}

function crearTarjetaEvacuaciones(reg) {
    const tarjeta = document.createElement('div');
    tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-amber-500 hover:shadow-md transition-all";

    const residenteStr = reg.residente ? `${reg.residente.nombre} ${reg.residente.apellidos} (Hab. ${reg.residente.habitacion || 'N/A'})` : 'Residente Desconocido';
    const empleadoStr = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Personal del Centro';

    tarjeta.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span class="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">👤 RESIDENTE: ${residenteStr}</span>
            <span>${formatearFechaHora(reg.fechaHora)}</span>
        </div>
        
        <div class="grid grid-cols-2 gap-4 my-1">
            <div class="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                <span class="text-[9px] font-bold text-slate-400 block uppercase">💦 Orina</span>
                <span class="text-xs font-bold text-slate-700">Tipo: ${reg.orina || 'N/A'} • Cantidad: ${reg.cantOrina || 'N/A'}</span>
            </div>
            <div class="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                <span class="text-[9px] font-bold text-slate-400 block uppercase">💩 Deposición</span>
                <span class="text-xs font-bold text-slate-700">Tipo: ${reg.depo || 'N/A'} • Cantidad: ${reg.cantDepo || 'N/A'}</span>
            </div>
        </div>
        
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <span class="text-[9px] text-slate-400 font-medium">Registrado por: ${empleadoStr}</span>
            <button onclick="eliminarRegistro('evacuaciones', ${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                🗑️ Eliminar Registro
            </button>
        </div>
    `;
    return tarjeta;
}

// --- ACCIÓN DE ELIMINACIÓN (DELETE) ---

async function eliminarRegistro(modulo, id) {
    if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar permanentemente este registro del histórico? Esta acción no se puede deshacer.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/cuidados/${modulo}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!respuesta.ok) throw new Error('El servidor rechazó la solicitud de eliminación.');

        // Refrescar el listado inmediatamente
        cargarRegistrosCuidados();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar el registro: ${error.message}`);
    }
}