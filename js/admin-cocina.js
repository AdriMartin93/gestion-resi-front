// Lógica de Auditoría Sanitaria de Cocina (APPCC)
document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional Exclusivo
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Carga inicial del histórico general
    cargarHistoricoAdminCocina();
});

// Helper para traducir los estados del Enum EstadoTarea en la interfaz del auditor
const traducirEstadoAdminCocina = (estado) => {
    if (estado === 'SI') return 'CORRECTO';
    if (estado === 'NO') return 'INCIDENCIA';
    if (estado === 'NA') return 'N/A';
    return estado || 'N/A';
};

// Consume el listado global ordenado cronológicamente desde el back-end
async function cargarHistoricoAdminCocina() {
    const contenedor = document.getElementById('contenedor-historico-admin-cocina');
    const txtContador = document.getElementById('contador-controles-cocina');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando registros sanitarios...</p>`;
    const token = localStorage.getItem('resi_token');

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        
        const respuesta = await fetch(`${baseUrl}/api/controles-cocina`, {
            method: 'GET', // Enlazado con @GetMapping del controlador de cocina
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo acceder al archivo de inspecciones.');
        const controles = await respuesta.json();
        
        contenedor.innerHTML = '';
        txtContador.innerText = `${controles.length} partes`;

        if (controles.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan partes de control higiénico registrados en el sistema.</p>`;
            return;
        }

        // Pintar tarjetas respetando la ordenación descendente nativa del repositorio
        controles.forEach(c => {
            const fechaFormateada = c.fecha ? c.fecha.split('-').reverse().join('/') : 'N/A';
            const cocinero = c.empleado ? `${c.empleado.nombre} ${c.empleado.apellidos || ''}` : 'Personal de Cocina';
            
            // Analizar de forma exhaustiva si hubo alguna incidencia no resuelta en el turno
            const tieneAlertas = [
                c.superficiesLimpias, c.uniformeCorrecto, c.temperaturaCamaras,
                c.etiquetado, c.muestrasTestigo, c.basuraRetirada, c.lavadoPlatos, c.limpiezaCocina
            ].includes('NO');

            const colorBordeClase = tieneAlertas ? 'border-l-red-500' : 'border-l-yellow-500';
            const badgeTipoClase = tieneAlertas ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100';
            const badgeTexto = tieneAlertas ? '🚨 INCIDENCIA REGISTRADA' : '✅ CONFORME';

            const tarjeta = document.createElement('div');
            tarjeta.className = `bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm border-l-4 ${colorBordeClase} hover:shadow-md transition-all`;
            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold">
                    <span class="${badgeTipoClase} px-2 py-0.5 rounded-lg uppercase tracking-wider border">${badgeTexto}</span>
                    <span class="text-slate-400">${fechaFormateada}</span>
                </div>
                
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50/60 p-3 rounded-xl border border-dashed leading-tight">
                    <div>🧼 Superficies: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.superficiesLimpias)}</span></div>
                    <div>🌡️ Cámaras: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.temperaturaCamaras)}</span></div>
                    <div>🧑‍🍳 Uniforme: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.uniformeCorrecto)}</span></div>
                    <div>🏷️ Etiquetado: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.etiquetado)}</span></div>
                    <div>🧪 Muestras: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.muestrasTestigo)}</span></div>
                    <div>🗑️ Basuras: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.basuraRetirada)}</span></div>
                    <div>🍽️ Vajilla: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.lavadoPlatos)}</span></div>
                    <div>🧹 Estructura: <span class="font-bold text-slate-700">${traducirEstadoAdminCocina(c.limpiezaCocina)}</span></div>
                </div>

                ${c.observaciones ? `
                    <div class="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border select-text">
                        <strong>Medidas Correctoras:</strong> ${c.observaciones}
                    </div>
                ` : ''}

                <div class="flex justify-between items-center mt-0.5 pt-1.5 border-t border-slate-100/60">
                    <span class="text-[9px] text-slate-400 font-medium">Operario: ${cocinero}</span>
                    <button onclick="eliminarControlCocina(${c.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                        🗑️ Eliminar Registro
                    </button>
                </div>
            `;
            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error al sincronizar el archivo higiénico con el servidor.</p>`;
    }
}

// Envía la petición DELETE al controlador para purgar el registro del Plan de Autocontrol
async function eliminarControlCocina(id) {
    if (!confirm('⚠ ¿Estás seguro de que deseas eliminar permanentemente este registro de control de cocina? Borrar partes del libro oficial APPCC puede acarrear sanciones en una inspección real.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/controles-cocina/${id}`, {
            method: 'DELETE', // Enlazado con @DeleteMapping de tu back
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la remoción del registro.');

        // Recargar listado al instante con éxito
        cargarHistoricoAdminCocina();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar la inspección de cocina: ${error.message}`);
    }
}