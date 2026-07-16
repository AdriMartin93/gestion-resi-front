// Lógica de Gestión del Módulo de Higiene y Limpieza
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth && !window.Auth.checkSession()) return;

    // Elementos del DOM
    const selectTipoZona = document.getElementById('select-tipo-zona');
    const formLimpieza = document.getElementById('form-limpieza');
    const btnFiltrarFecha = document.getElementById('btn-filtrar-fecha');
    const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');

    // Listeners
    selectTipoZona.addEventListener('change', renderizarFormularioDinamico);
    formLimpieza.addEventListener('submit', guardarRegistroLimpieza);
    btnFiltrarFecha.addEventListener('click', () => {
        const fecha = document.getElementById('filtro-fecha').value;
        if (fecha) obtenerHistoricoDesdeApi(fecha);
    });
    btnLimpiarFiltro.addEventListener('click', () => {
        document.getElementById('filtro-fecha').value = '';
        obtenerHistoricoDesdeApi();
    });

    // Carga inicial de datos
    obtenerHistoricoDesdeApi();
});

// Configuración de las tareas del backend mapeadas fielmente a sus propiedades Java
const CONFIG_TAREAS_POR_ZONA = {
    HABITACION: [
        { name: 'cambioSabanas', label: 'Cambio de Sábanas / Lencería' },
        { name: 'limpiezaSuperficies', label: 'Polvo y Superficies Mobiliario' },
        { name: 'limpiezaLavabo', label: 'Desinfección de Inodoro y Lavabo' },
        { name: 'reposicion', label: 'Reposición (Jabón, Papel Higiénico...)' }
    ],
    COMUN: [
        { name: 'limpiezaAscensores', label: 'Fregado y Pulsadores de Ascensores' },
        { name: 'limpiezaSillas', label: 'Higienización de Sillas / Sillones Comunes' },
        { name: 'limpiezaSuperficies', label: 'Desinfección de Superficies y zonas comunes' }
    ],
    CLINICA: [
        { name: 'desinfecCamillas', label: 'Desinfección Crítica de Camillas' },
        { name: 'retiradaResBio', label: 'Retirada de Residuos Biosanitarios' },
        { name: 'limpiezaSuperficies', label: 'Superficies de Trabajo / Instrumental' }
    ],
    ROPA: [
        { name: 'lavado', label: 'Lavado Industrial / Clasificación' },
        { name: 'secado', label: 'Ciclo de Secadora Automática' },
        { name: 'planchado', label: 'Planchado / Calandra' },
        { name: 'entrega', label: 'Distribución y Entrega a Planta' }
    ]
};

// Mapeador visual para traducir el Enum EstadoTarea del Back-end a texto amigable
const traducirEstado = (estado) => {
    if (estado === 'SI') return 'REALIZADO';
    if (estado === 'NO') return 'PENDIENTE';
    if (estado === 'NA') return 'N/A';
    return estado || 'N/A';
};

// Genera dinámicamente los selectores basados en el Enum EstadoTarea
function renderizarFormularioDinamico(e) {
    const tipoZona = e.target.value;
    const contenedor = document.getElementById('contenedor-tareas-dinamicas');

    if (!CONFIG_TAREAS_POR_ZONA[tipoZona]) {
        contenedor.classList.add('hidden');
        contenedor.innerHTML = '';
        return;
    }

    contenedor.classList.remove('hidden');
    contenedor.innerHTML = `<h3 class="text-[11px] font-bold text-cyan-800 uppercase tracking-wide mb-2">Checklist Obligatorio (${tipoZona})</h3>`;

    CONFIG_TAREAS_POR_ZONA[tipoZona].forEach(tarea => {
        const div = document.createElement('div');
        div.className = "flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2 last:border-none";
        div.innerHTML = `
            <span class="text-xs font-medium text-slate-700">${tarea.label}</span>
            <select name="${tarea.name}" class="input-premium bg-white py-1 text-xs w-full sm:w-40 font-semibold text-slate-600" required>
                <option value="SI" selected>🟢 REALIZADO</option>
                <option value="NO">🟡 PENDIENTE</option>
                <option value="NA">⚪ NO NECESARIO</option>
            </select>
        `;
        contenedor.appendChild(div);
    });
}

async function guardarRegistroLimpieza(e) {
    e.preventDefault();

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;
    const tipoZona = document.getElementById('select-tipo-zona').value;
    const token = localStorage.getItem('resi_token');

    let subEndpoint = '';
    if (tipoZona === 'HABITACION') subEndpoint = '/api/limpiezas/habitacion';
    else if (tipoZona === 'COMUN') subEndpoint = '/api/limpiezas/comun';
    else if (tipoZona === 'CLINICA') subEndpoint = '/api/limpiezas/clinica';
    else if (tipoZona === 'ROPA') subEndpoint = '/api/limpiezas/ropa';

    const formElement = document.getElementById('form-limpieza');
    const formData = new FormData(formElement);

    // Construcción estructurada adaptada a tus clases abstractas y relaciones de Spring Boot
    const payloadJson = {
        id: null,
        empleado: { id: parseInt(empleadoId) }, // Relación ManyToOne limpia con Empleado
        fecha: null,
        observaciones: formData.get('observaciones') || ""
    };

    // Extraemos de forma segura el valor de los inputs dinámicos inyectados en el DOM
    CONFIG_TAREAS_POR_ZONA[tipoZona].forEach(tarea => {
        const selectElement = formElement.querySelector(`select[name="${tarea.name}"]`);
        if (selectElement) {
            payloadJson[tarea.name] = selectElement.value;
        }
    });

    try {
        const respuesta = await fetch(`${baseUrl}${subEndpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadJson)
        });

        if (!respuesta.ok) throw new Error(`Error de persistencia de limpieza (Status: ${respuesta.status})`);

        alert('¡Éxito! El registro de limpieza se ha guardado y clasificado correctamente.');

        // Resetear interfaz
        formElement.reset();
        document.getElementById('contenedor-tareas-dinamicas').classList.add('hidden');
        document.getElementById('contenedor-tareas-dinamicas').innerHTML = '';

        // Recargar histórico general
        obtenerHistoricoDesdeApi();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar el parte de limpieza: ${error.message}`);
    }
}

// Consume los endpoints GET para pintar de forma polimórfica los feeds de trazabilidad
async function obtenerHistoricoDesdeApi(fechaFiltro = null) {
    const contenedor = document.getElementById('contenedor-historico-limpieza');
    const contador = document.getElementById('contador-registros');
    if (!contenedor || !contador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Cargando histórico...</p>`;
    const token = localStorage.getItem('resi_token');

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        let urlEndpoint = `${baseUrl}/api/limpiezas`;
        if (fechaFiltro) {
            urlEndpoint = `${baseUrl}/api/limpiezas/fecha?fecha=${fechaFiltro}`;
        }

        const respuesta = await fetch(urlEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo leer el repositorio de limpieza');
        const registros = await respuesta.json();
        contenedor.innerHTML = '';
        contador.innerText = `${registros.length} partes`;

        if (registros.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan partes firmados en este periodo.</p>`;
            return;
        }

        // Iterar en reversa para listar los partes más recientes en el extremo superior
        registros.reverse().forEach(reg => {
            const fechaFormateada = reg.fecha ? reg.fecha.split('-').reverse().join('/') : 'N/A';
            const supervisor = reg.empleado ? `${reg.empleado.nombre} ${reg.empleado.apellidos || ''}` : 'Operario de Turno';

            let tipoBadge = 'GENERAL';
            let colorClase = 'border-l-slate-400';
            let colorBadge = 'bg-slate-100 text-slate-700 border-slate-200';
            let desgloseTareas = [];

            // Identificación polimórfica basándonos en atributos únicos de cada subclase
            if (reg.cambioSabanas !== undefined) {
                tipoBadge = '🛏️ HABITACIÓN';
                colorClase = 'border-l-indigo-500';
                colorBadge = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                desgloseTareas = [
                    `Camas: ${traducirEstado(reg.cambioSabanas)}`, `Superficies: ${traducirEstado(reg.limpiezaSuperficies)}`,
                    `Lavabo: ${traducirEstado(reg.limpiezaLavabo)}`, `Amenities: ${traducirEstado(reg.reposicion)}`
                ];
            } else if (reg.limpiezaAscensores !== undefined) {
                tipoBadge = '🛋️ ZONAS COMUNES';
                colorClase = 'border-l-amber-500';
                colorBadge = 'bg-amber-50 text-amber-700 border-amber-100';
                desgloseTareas = [
                    `Ascensores: ${traducirEstado(reg.limpiezaAscensores)}`, `Sillas: ${traducirEstado(reg.limpiezaSillas)}`,
                    `Superficies: ${traducirEstado(reg.limpiezaSuperficies)}`
                ];
            } else if (reg.desinfecCamillas !== undefined) {
                tipoBadge = '🩺 ÁREA CLÍNICA';
                colorClase = 'border-l-red-500';
                colorBadge = 'bg-red-50 text-red-700 border-red-100';
                desgloseTareas = [
                    `Camillas: ${traducirEstado(reg.desinfecCamillas)}`, `Biorriesgo: ${traducirEstado(reg.retiradaResBio)}`,
                    `Superficies: ${traducirEstado(reg.limpiezaSuperficies)}`
                ];
            } else if (reg.lavado !== undefined) {
                tipoBadge = '🧺 LAVANDERÍA';
                colorClase = 'border-l-teal-500';
                colorBadge = 'bg-teal-50 text-teal-700 border-teal-100';
                desgloseTareas = [
                    `Lavado: ${traducirEstado(reg.lavado)}`, `Secado: ${traducirEstado(reg.secado)}`,
                    `Plancha: ${traducirEstado(reg.planchado)}`, `Entrega: ${traducirEstado(reg.entrega)}`
                ];
            }

            const tarjeta = document.createElement('div');
            tarjeta.className = `bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-1.5 shadow-sm border-l-4 ${colorClase}`;
            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold">
                    <span class="${colorBadge} px-1.5 py-0.5 rounded uppercase tracking-wider border">${tipoBadge}</span>
                    <span>${fechaFormateada}</span>
                </div>
                <div class="text-[10px] font-semibold text-slate-500 bg-slate-50 p-2 rounded border border-dashed leading-normal">
                    ${desgloseTareas.map(t => `<span class="inline-block mr-2">🔹 ${t}</span>`).join('')}
                </div>
                ${reg.observaciones ? `
                    <p class="text-[11px] text-slate-600 italic bg-white p-1.5 rounded border select-text">
                        <strong>Obs:</strong> ${reg.observaciones}
                    </p>
                ` : ''}
                <div class="flex justify-between items-center mt-1">
                    <span class="text-[9px] text-slate-400 font-medium">Limpiador: ${supervisor}</span>
                    <button onclick="eliminarParteLimpieza(${reg.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                        Eliminar
                    </button>
                </div>
            `;
            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error al sincronizar el histórico con el servidor.</p>`;
    }
}

// Permite eliminar registros usando el DELETE mapeado en tu controlador
async function eliminarParteLimpieza(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este registro de limpieza del cuadrante?')) return;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/limpiezas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('resi_token')}` }
        });

        if (!respuesta.ok) throw new Error('Fallo al eliminar el parte en el servidor');

        obtenerHistoricoDesdeApi();
    } catch (error) {
        console.error(error);
        alert(`Error al eliminar: ${error.message}`);
    }
}