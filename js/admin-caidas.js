// Lógica de Auditoría de Siniestralidad y Registro de Caídas
document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional Exclusivo para Dirección
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Carga inicial del histórico general
    cargarHistoricoGeneralCaidas();
});

// Recupera todas las caídas de la residencia registradas en el servidor
async function cargarHistoricoGeneralCaidas() {
    const contenedor = document.getElementById('contenedor-historico-caidas');
    const txtContador = document.getElementById('contador-caidas');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando libro de incidentes...</p>`;
    const token = localStorage.getItem('resi_token');

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        const respuesta = await fetch(`${baseUrl}/api/caidas`, {
            method: 'GET', // Consume el listado ordenado descendentemente
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo acceder al repositorio de incidentes.');
        const caidas = await respuesta.json();

        contenedor.innerHTML = '';
        txtContador.innerText = `${caidas.length} partes`;

        if (caidas.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan partes de caídas registrados en el centro.</p>`;
            return;
        }

        // El back ya las devuelve ordenadas de la más reciente a la más antigua
        caidas.forEach(c => {
            // Formatear la Fecha y Hora del incidente (LocalDateTime)
            let fechaFormateada = 'N/A';
            if (c.fechaHora) {
                const partes = c.fechaHora.split('T');
                if (partes[0]) {
                    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                    fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
                }
            }

            // Datos de los actores implicados mapeados de las relaciones
            const afectado = c.residente ? `${c.residente.nombre} ${c.residente.apellidos} (Hab. ${c.residente.habitacion || 'N/A'})` : 'Residente de Baja';
            const supervisor = c.empleado ? `${c.empleado.nombre} ${c.empleado.apellidos || ''}` : 'Personal de Turno';

            // Unir en un string los badges de consecuencias utilizando el array del backend
            const badgeConsecuencias = c.consecuencias && c.consecuencias.length > 0
                ? c.consecuencias.map(cons => `<span class="bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-tight inline-block">${cons.replace('_', ' ')}</span>`).join(' ')
                : '<span class="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-tight inline-block">SIN LESIONES APARENTES</span>';

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-sm border-l-4 border-l-red-500 hover:shadow-md transition-all";
            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">👤 AFECTADO: ${afectado}</span>
                    <span>${fechaFormateada}</span>
                </div>
                
                <div class="text-[10px] font-semibold text-slate-500 pl-0.5 mt-0.5">
                    📍 Lugar: ${c.lugar || 'No especificado'} • 🏃 Actividad: ${c.actividad || 'N/A'} • 👟 Calzado: ${c.calzado || 'N/A'} • 👁️ Consciente: ${c.consciente ? 'SÍ' : 'NO'}
                </div>
                
                <div class="text-xs text-slate-700 font-medium bg-slate-50/50 p-2.5 rounded-xl border border-dashed select-text">
                    <strong>Mecánica del accidente:</strong> ${c.descripcionCaida}<br>
                    <strong class="block mt-1 text-red-600">Acciones correctoras inmediatas:</strong> ${c.acciones}
                </div>
                
                <div class="flex flex-wrap gap-1 items-center mt-1 pl-0.5">
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mr-1">Valoración:</span>
                    ${badgeConsecuencias}
                </div>
                
                <div class="flex justify-between items-center mt-1.5 pt-2 border-t border-slate-100/60">
                    <span class="text-[9px] text-slate-400 font-medium">Supervisor: ${supervisor}</span>
                    <button onclick="eliminarRegistroCaida(${c.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                        🗑️ Eliminar Parte
                    </button>
                </div>
            `;
            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error al sincronizar el libro de caídas con el servidor.</p>`;
    }
}

// Envía la orden DELETE al controlador para remover la fila de la tabla `registros_caidas`
async function eliminarRegistroCaida(id) {
    if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar permanentemente este registro de caída del expediente de la residencia? Esta acción es irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/caidas/${id}`, {
            method: 'DELETE', // Enlazado con @DeleteMapping de tu back
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la eliminación del incidente.');

        // Refrescar listado al instante con éxito
        cargarHistoricoGeneralCaidas();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar el parte de caída: ${error.message}`);
    }
}