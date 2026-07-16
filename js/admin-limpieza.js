// Lógica de Auditoría y Control del Fichero de Limpieza
let listadoGlobalLimpiezas = [];
let tabLimpiezaActiva = 'habitacion'; // 'habitacion', 'comun', 'clinica', 'ropa'

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional de Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Vinculación de eventos de los filtros
    document.getElementById('btn-buscar-limpieza').addEventListener('click', realizarBusqueda);
    document.getElementById('btn-limpiar-filtros-limpieza').addEventListener('click', restaurarFiltros);

    // Carga inicial
    cargarHistorialLimpiezas();
});

// Control visual e intercambio de pestañas
function cambiarTabLimpieza(nuevaTab) {
    tabLimpiezaActiva = nuevaTab;

    const botonesTabs = {
        habitacion: document.getElementById('tab-habitacion'),
        comun: document.getElementById('tab-comun'),
        clinica: document.getElementById('tab-clinica'),
        ropa: document.getElementById('tab-ropa')
    };

    const titulosSeccion = {
        habitacion: 'Registros en Habitaciones',
        comun: 'Registros en Áreas Comunes',
        clinica: 'Registros en Áreas Clínicas',
        ropa: 'Registros de Lavandería y Ropa'
    };

    // Quitar clases activas
    Object.keys(botonesTabs).forEach(key => {
        if (botonesTabs[key]) {
            botonesTabs[key].className = "tab-btn flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-700 transition-all";
        }
    });

    // Poner clase activa a la pestaña actual
    if (botonesTabs[nuevaTab]) {
        botonesTabs[nuevaTab].className = "tab-btn flex-1 py-2 text-xs font-bold rounded-lg text-cyan-600 transition-all bg-white shadow-sm";
    }

    document.getElementById('titulo-seccion-limpieza').innerText = titulosSeccion[nuevaTab];
    renderizarListadoPorTabActiva();
}

// Acción del botón buscar: si se ingresó fecha, consulta el endpoint específico, si no, usa el global
async function realizarBusqueda() {
    const fecha = document.getElementById('filtro-fecha-limpieza').value;
    if (!fecha) {
        cargarHistorialLimpiezas();
        return;
    }

    const contenedor = document.getElementById('contenedor-registros-limpieza');
    if (!contenedor) return;
    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Filtrando registros por día...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/limpiezas/fecha?fecha=${fecha}`, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('Error al filtrar la desinfección por fecha.');
        listadoGlobalLimpiezas = await respuesta.json();

        renderizarListadoPorTabActiva();

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Fallo de red: ${error.message}</p>`;
    }
}

function restaurarFiltros() {
    document.getElementById('filtro-fecha-limpieza').value = '';
    cargarHistorialLimpiezas();
}

// Carga inicial consumiendo el GET global
async function cargarHistorialLimpiezas() {
    const contenedor = document.getElementById('contenedor-registros-limpieza');
    if (!contenedor) return;
    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando registros con el servidor...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/limpiezas`, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo establecer conexión con el módulo de salubridad.');
        listadoGlobalLimpiezas = await respuesta.json();

        renderizarListadoPorTabActiva();

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error en la base de datos: ${error.message}</p>`;
    }
}

// Separa y renderiza las tarjetas basándose en la herencia de tu Backend (JPA Discriminator)
function renderizarListadoPorTabActiva() {
    const contenedor = document.getElementById('contenedor-registros-limpieza');
    const txtContador = document.getElementById('contador-limpiezas');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = '';

    // Filtrar los datos en cliente según la propiedad/tipo de herencia de tu back
    let filtrados = [];
    if (tabLimpiezaActiva === 'habitacion') {
        // En tus subclases pusiste DiscriminatorValue("HABITACION")
        filtrados = listadoGlobalLimpiezas.filter(reg => reg.cambioSabanas !== undefined);
    } else if (tabLimpiezaActiva === 'comun') {
        // DiscriminatorValue("COMUNES")
        filtrados = listadoGlobalLimpiezas.filter(reg => reg.limpiezaAscensores !== undefined);
    } else if (tabLimpiezaActiva === 'clinica') {
        // DiscriminatorValue("CLINICA")
        filtrados = listadoGlobalLimpiezas.filter(reg => reg.desinfecCamillas !== undefined);
    } else if (tabLimpiezaActiva === 'ropa') {
        // DiscriminatorValue("ROPA")
        filtrados = listadoGlobalLimpiezas.filter(reg => reg.lavado !== undefined);
    }

    txtContador.innerText = `${filtrados.length} registros`;

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan partes de esta categoría para los filtros aplicados.</p>`;
        return;
    }

    // Renderizar tarjetas específicas
    filtrados.forEach(reg => {
        let tarjeta = null;
        if (tabLimpiezaActiva === 'habitacion') tarjeta = crearTarjetaHabitacion(reg);
        if (tabLimpiezaActiva === 'comun') tarjeta = crearTarjetaComunes(reg);
        if (tabLimpiezaActiva === 'clinica') tarjeta = crearTarjetaClinica(reg);
        if (tabLimpiezaActiva === 'ropa') tarjeta = crearTarjetaRopa(reg);

        if (tarjeta) contenedor.appendChild(tarjeta);
    });
}

// Formateador de LocalDate
function formatearFecha(fechaString) {
    if (!fechaString) return 'N/A';
    const partes = fechaString.split('-');
    if (partes.length !== 3) return fechaString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// --- RENDERIZADORES DE TARJETAS (MAPPING DE LOS CAMPOS DE CADA SUBCLASE JPA) ---

function crearTarjetaHabitacion(reg) {
    const tarjeta = document.createElement('div');
    tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-cyan-500 hover:shadow-md transition-all";

    const empleadoStr = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Operario de Turno';
    const badges = [
        { label: 'Sábanas', val: reg.cambioSabanas },
        { label: 'Superficies', val: reg.limpiezaSuperficies },
        { label: 'Lavabo', val: reg.limpiezaLavabo },
        { label: 'Reposición', val: reg.reposicion }
    ].map(t => mapearBadgeTarea(t.label, t.val)).join(' ');

    tarjeta.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span class="text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">🛏️ HABITACIONES</span>
            <span>📅 ${formatearFecha(reg.fecha)}</span>
        </div>
        
        <div class="flex flex-wrap gap-1 mt-1">
            ${badges}
        </div>

        ${crearSeccionObservaciones(reg.observaciones)}
        
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <span class="text-[9px] text-slate-400 font-medium">Realizado por: ${empleadoStr}</span>
            <button onclick="eliminarRegistroLimpieza(${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                🗑️ Eliminar Parte
            </button>
        </div>
    `;
    return tarjeta;
}

function crearTarjetaComunes(reg) {
    const tarjeta = document.createElement('div');
    tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-teal-500 hover:shadow-md transition-all";

    const empleadoStr = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Operario de Turno';
    const badges = [
        { label: 'Ascensores', val: reg.limpiezaAscensores },
        { label: 'Sillas/Sillones', val: reg.limpiezaSillas },
        { label: 'Superficies', val: reg.limpiezaSuperficies }
    ].map(t => mapearBadgeTarea(t.label, t.val)).join(' ');

    tarjeta.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span class="text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">🛋️ ZONAS COMUNES</span>
            <span>📅 ${formatearFecha(reg.fecha)}</span>
        </div>
        
        <div class="flex flex-wrap gap-1 mt-1">
            ${badges}
        </div>

        ${crearSeccionObservaciones(reg.observaciones)}
        
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <span class="text-[9px] text-slate-400 font-medium">Realizado por: ${empleadoStr}</span>
            <button onclick="eliminarRegistroLimpieza(${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                🗑️ Eliminar Parte
            </button>
        </div>
    `;
    return tarjeta;
}

function crearTarjetaClinica(reg) {
    const tarjeta = document.createElement('div');
    tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-rose-500 hover:shadow-md transition-all";

    const empleadoStr = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Operario de Turno';
    const badges = [
        { label: 'Desinfección Camillas', val: reg.desinfecCamillas },
        { label: 'Residuos Biológicos', val: reg.retiradaResBio },
        { label: 'Superficies', val: reg.limpiezaSuperficies }
    ].map(t => mapearBadgeTarea(t.label, t.val)).join(' ');

    tarjeta.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span class="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">🩺 ÁREA CLÍNICA</span>
            <span>📅 ${formatearFecha(reg.fecha)}</span>
        </div>
        
        <div class="flex flex-wrap gap-1 mt-1">
            ${badges}
        </div>

        ${crearSeccionObservaciones(reg.observaciones)}
        
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <span class="text-[9px] text-slate-400 font-medium">Realizado por: ${empleadoStr}</span>
            <button onclick="eliminarRegistroLimpieza(${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                🗑️ Eliminar Parte
            </button>
        </div>
    `;
    return tarjeta;
}

function crearTarjetaRopa(reg) {
    const tarjeta = document.createElement('div');
    tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-amber-500 hover:shadow-md transition-all";

    const empleadoStr = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Operario de Turno';
    const badges = [
        { label: 'Lavado', val: reg.lavado },
        { label: 'Secado', val: reg.secado },
        { label: 'Planchado', val: reg.planchado },
        { label: 'Entrega', val: reg.entrega }
    ].map(t => mapearBadgeTarea(t.label, t.val)).join(' ');

    tarjeta.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span class="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">🧺 LAVANDERÍA</span>
            <span>📅 ${formatearFecha(reg.fecha)}</span>
        </div>
        
        <div class="flex flex-wrap gap-1 mt-1">
            ${badges}
        </div>

        ${crearSeccionObservaciones(reg.observaciones)}
        
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <span class="text-[9px] text-slate-400 font-medium">Realizado por: ${empleadoStr}</span>
            <button onclick="eliminarRegistroLimpieza(${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                🗑️ Eliminar Parte
            </button>
        </div>
    `;
    return tarjeta;
}

// Helpers visuales
function mapearBadgeTarea(label, estado) {
    const completado = estado === 'REALIZADO' || estado === 'HECHO' || estado === 'SI';
    const color = completado
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : 'bg-slate-50 text-slate-400 border-slate-100';
    return `<span class="border px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-tight inline-block ${color}">${label}: ${estado || 'N/R'}</span>`;
}

function crearSeccionObservaciones(observaciones) {
    if (!observaciones) return '';
    return `
        <div class="text-[11px] text-slate-600 font-medium bg-slate-50/70 p-2 rounded-xl border border-dashed border-slate-200 mt-1">
            <strong>Observaciones:</strong> ${observaciones}
        </div>
    `;
}

// --- ACCIÓN DE ELIMINACIÓN (DELETE) ---

async function eliminarRegistroLimpieza(id) {
    if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar permanentemente este registro de limpieza de la base de datos?')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/limpiezas/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la baja física de la higienización.');

        // Forzar recarga completa offline/online
        await cargarHistorialLimpiezas();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar: ${error.message}`);
    }
}