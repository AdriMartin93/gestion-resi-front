// Lógica de Control Sanitario y APPCC de Cocina
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth && !window.Auth.checkSession()) return;

    // Asignar por defecto la fecha del día de hoy en el input
    const inputFecha = document.getElementById('fecha-registro');
    if (inputFecha) {
        inputFecha.value = new Date().toISOString().split('T')[0];
    }

    // Vincular Eventos
    document.getElementById('form-cocina').addEventListener('submit', guardarControlCocina);

    // Cargar registros históricos
    obtenerHistoricoCocinaDesdeApi();
});

// Helper para traducir el Enum EstadoTarea del Back-end a texto amigable
const traducirEstadoCocina = (estado) => {
    if (estado === 'SI') return 'CORRECTO';
    if (estado === 'NO') return 'INCIDENCIA';
    if (estado === 'NA') return 'N/A';
    return estado || 'N/A';
};

// Envía el JSON estructurado al endpoint de CocinaController
async function guardarControlCocina(e) {
    e.preventDefault();

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;
    const token = localStorage.getItem('resi_token');

    const formElement = document.getElementById('form-cocina');
    const formData = new FormData(formElement);

    // Construcción limpia adaptada punto por punto a ControlCocina.java
    const payloadJson = {
        id: null,
        fecha: document.getElementById('fecha-registro').value,
        empleado: { id: parseInt(empleadoId) }, // Mapeo ManyToOne con Empleado
        superficiesLimpias: formData.get('superficiesLimpias'),
        uniformeCorrecto: formData.get('uniformeCorrecto'),
        temperaturaCamaras: formData.get('temperaturaCamaras'),
        etiquetado: formData.get('etiquetado'),
        muestrasTestigo: formData.get('muestrasTestigo'),
        basuraRetirada: formData.get('basuraRetirada'),
        lavadoPlatos: formData.get('lavadoPlatos'),
        limpiezaCocina: formData.get('limpiezaCocina'),
        observaciones: formData.get('observaciones') || ""
    };

    try {
        const respuesta = await fetch(`${baseUrl}/api/controles-cocina`, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadJson)
        });

        if (!respuesta.ok) throw new Error(`Fallo de persistencia (Status: ${respuesta.status})`);

        alert('¡Éxito! El control de cocina ha sido guardado correctamente.');

        // Limpiar cuadro de texto de observaciones
        document.getElementById('observaciones').value = '';

        // Refrescar listado
        obtenerHistoricoCocinaDesdeApi();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar el registro APPCC: ${error.message}`);
    }
}

// Carga todas las inspecciones del repositorio ordenadas descendentemente
async function obtenerHistoricoCocinaDesdeApi() {
    const contenedor = document.getElementById('contenedor-historico-cocina');
    const contador = document.getElementById('contador-controles');
    if (!contenedor || !contador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Cargando registros sanitarios...</p>`;
    const token = localStorage.getItem('resi_token');

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        const respuesta = await fetch(`${baseUrl}/api/controles-cocina`, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo leer el repositorio de cocina');
        const controles = await respuesta.json();
        contenedor.innerHTML = '';
        contador.innerText = `${controles.length} partes`;

        if (controles.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan inspecciones higiénicas previas.</p>`;
            return;
        }

        // Pintar tarjetas (el back ya los devuelve ordenados por fecha desc)
        controles.forEach(c => {
            const fechaFormateada = c.fecha ? c.fecha.split('-').reverse().join('/') : 'N/A';
            const firmante = c.empleado ? `${c.empleado.nombre} ${c.empleado.apellidos || ''}` : 'Cocinero de Turno';

            // Evaluamos si hay alguna incidencia severa para cambiar dinámicamente el color del borde
            const tieneIncidencias = [
                c.superficiesLimpias, c.uniformeCorrecto, c.temperaturaCamaras,
                c.etiquetado, c.muestrasTestigo, c.basuraRetirada, c.lavadoPlatos, c.limpiezaCocina
            ].includes('NO');

            const colorBordeClase = tieneIncidencias ? 'border-l-red-500' : 'border-l-yellow-500';
            const badgeTipoClase = tieneIncidencias ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100';
            const badgeTexto = tieneIncidencias ? '🚨 CON INCIDENCIAS' : '✅ CONFORME';

            const tarjeta = document.createElement('div');
            tarjeta.className = `bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-1.5 shadow-sm border-l-4 ${colorBordeClase}`;
            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold">
                    <span class="${badgeTipoClase} px-1.5 py-0.5 rounded uppercase tracking-wider border">${badgeTexto}</span>
                    <span class="text-slate-400">${fechaFormateada}</span>
                </div>
                
                <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-semibold text-slate-500 bg-slate-50 p-2 rounded border border-dashed leading-tight">
                    <div>🧼 Superficies: <span class="text-slate-700">${traducirEstadoCocina(c.superficiesLimpias)}</span></div>
                    <div>🌡️ Cámaras: <span class="text-slate-700">${traducirEstadoCocina(c.temperaturaCamaras)}</span></div>
                    <div>🧑‍🍳 Uniforme: <span class="text-slate-700">${traducirEstadoCocina(c.uniformeCorrecto)}</span></div>
                    <div>🏷️ Etiquetado: <span class="text-slate-700">${traducirEstadoCocina(c.etiquetado)}</span></div>
                    <div>🧪 Muestras: <span class="text-slate-700">${traducirEstadoCocina(c.muestrasTestigo)}</span></div>
                    <div>🗑️ Basura: <span class="text-slate-700">${traducirEstadoCocina(c.basuraRetirada)}</span></div>
                    <div>🍽️ Lavado: <span class="text-slate-700">${traducirEstadoCocina(c.lavadoPlatos)}</span></div>
                    <div>🧹 General: <span class="text-slate-700">${traducirEstadoCocina(c.limpiezaCocina)}</span></div>
                </div>

                ${c.observaciones ? `
                    <p class="text-[11px] text-slate-600 italic bg-white p-1.5 rounded border select-text">
                        <strong>Obs:</strong> ${c.observaciones}
                    </p>
                ` : ''}

                <div class="flex justify-between items-center mt-0.5">
                    <span class="text-[9px] text-slate-400 font-medium">Inspector: ${firmante}</span>
                    <button onclick="eliminarControlCocina(${c.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
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

// Llama al método DELETE del controlador para remover el parte de inspección
async function eliminarControlCocina(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este registro de control de cocina?')) return;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'h+ttps://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/controles-cocina/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('resi_token')}` }
        });

        if (!respuesta.ok) throw new Error('Fallo al eliminar el registro en el servidor');

        obtenerHistoricoCocinaDesdeApi();
    } catch (error) {
        console.error(error);
        alert(`Error al eliminar: ${error.message}`);
    }
}