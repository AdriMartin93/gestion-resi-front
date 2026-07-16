// Lógica de Auditoría de Animación Sociocultural
document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional Exclusivo
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Carga inicial del repositorio
    cargarHistoricoAnimacion();
});

// Recupera todas las sesiones ordenadas descendentemente por fecha y hora
async function cargarHistoricoAnimacion() {
    const contenedor = document.getElementById('contenedor-historico-animacion');
    const txtContador = document.getElementById('contador-animacion');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Sincronizando registros con el servidor...</p>`;
    const token = localStorage.getItem('resi_token');

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        const respuesta = await fetch(`${baseUrl}/api/registros-animacion`, {
            method: 'GET', // Enlazado con @GetMapping de tu back
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo acceder al repositorio de animación.');
        const sesiones = await respuesta.json();

        contenedor.innerHTML = '';
        txtContador.innerText = `${sesiones.length} sesiones`;

        if (sesiones.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">No constan registros de actividades socioculturales firmados en el sistema.</p>`;
            return;
        }

        // Pintar las tarjetas. Tu back ya las devuelve ordenadas desc
        sesiones.forEach(ses => {
            // Formatear Fecha y Hora de la actividad (LocalDateTime)
            let fechaFormateada = 'N/A';
            if (ses.fechaHora) {
                const partes = ses.fechaHora.split('T');
                if (partes[0]) {
                    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                    fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
                }
            }

            const monitor = ses.empleado ? `${ses.empleado.nombre} ${ses.empleado.apellidos || ''}` : 'Animador TASS';

            // Generar los badges de los residentes participantes de forma segura
            let htmlParticipantes = '';
            if (ses.participantes && ses.participantes.length > 0) {
                htmlParticipantes = ses.participantes.map(p => `
                    <span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-tight inline-block whitespace-nowrap">
                        👤 ${p.nombre} ${p.apellidos || ''} (Hab. ${p.habitacion || 'N/A'})
                    </span>
                `).join(' ');
            } else {
                htmlParticipantes = `<span class="text-slate-400 italic text-[10px]">Sin participantes inscritos en esta sesión.</span>`;
            }

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm border-l-4 border-l-pink-500 hover:shadow-md transition-all";
            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-pink-700 bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">🎪 TALLER / ACTIVIDAD</span>
                    <span>${fechaFormateada}</span>
                </div>
                
                <div class="text-xs text-slate-700 font-bold bg-slate-50/50 p-2.5 rounded-xl border border-dashed select-text">
                    <span class="text-[10px] text-slate-400 uppercase block font-bold tracking-wide mb-0.5">Descripción de la Dinámica:</span>
                    ${ses.actividadRealizada}
                </div>

                ${ses.observaciones ? `
                    <div class="text-[11px] text-slate-500 leading-relaxed pl-1 select-text">
                        <strong>Evolución / Incidencias:</strong> ${ses.observaciones}
                    </div>
                ` : ''}

                <div class="flex flex-col gap-1 border-t border-slate-100 pt-2">
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Lista de Asistencia (${ses.participantes ? ses.participantes.length : 0}):</span>
                    <div class="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pr-1">
                        ${htmlParticipantes}
                    </div>
                </div>

                <div class="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100/60">
                    <span class="text-[9px] text-slate-400 font-medium">Responsable: ${monitor}</span>
                    <button onclick="eliminarRegistroAnimacion(${ses.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight flex items-center gap-1">
                        ❌ Eliminar Parte
                    </button>
                </div>
            `;
            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error al sincronizar las actividades de animación con el servidor.</p>`;
    }
}

// Envía la orden DELETE al controlador para purgar la fila en la tabla de base de datos
async function eliminarRegistroAnimacion(id) {
    if (!confirm('⚠ ¿Estás seguro de que deseas eliminar permanentemente este registro de animación del histórico? Esta acción desvinculará las asistencias guardadas de los residentes de forma irreversible.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/registros-animacion/${id}`, {
            method: 'DELETE', // Enlazado con @DeleteMapping de tu back
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!respuesta.ok) throw new Error('El servidor denegó la remoción del registro.');

        // Refrescar listado al instante con éxito
        cargarHistoricoAnimacion();

    } catch (error) {
        console.error(error);
        alert(`Error al eliminar la sesión de animación: ${error.message}`);
    }
}