// Lógica de Gestión de Partes Diarios
document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de seguridad global
    if (window.Auth && !window.Auth.checkSession()) return;

    // 2. Establecer la fecha de hoy por defecto en el formulario
    const inputFecha = document.getElementById('input-fecha');
    if (inputFecha) {
        inputFecha.value = new Date().toISOString().split('T')[0];
    }

    // 3. Vincular eventos de la UI
    document.getElementById('form-parte-diario').addEventListener('submit', guardarParteDiario);

    // Contador de caracteres en tiempo real (Hasta 2000 caracteres)
    document.getElementById('txt-contenido').addEventListener('input', (e) => {
        document.getElementById('char-counter').innerText = `${e.target.value.length} / 2000 caracteres`;
    });

    // 4. Cargar el histórico de partes del servidor
    obtenerHistorialPartes();
});

// Recuperar e inyectar el histórico de partes diarios desde el Backend
async function obtenerHistorialPartes() {
    const contenedor = document.getElementById('lista-partes-diarios');
    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        const respuesta = await fetch(`${baseUrl}/api/partes-diarios`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo obtener el historial');

        const partes = await respuesta.json();
        contenedor.innerHTML = '';

        if (partes.length === 0) {
            contenedor.innerHTML = `<p class="text-center text-sm text-slate-400 italic py-8">No se han registrado partes diarios todavía.</p>`;
            return;
        }

        // Pintar cada bloque de informe en el listado
        partes.forEach(parte => {
            const fechaFormateada = formatearFechaEspanol(parte.fecha);
            const nombreCreador = parte.creador ? `${parte.creador.nombre} ${parte.creador.apellidos}` : 'Empleado General';

            const card = document.createElement('div');
            card.className = "bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 relative group hover:border-slate-300 transition-all";
            card.innerHTML = `
                <div class="flex justify-between items-start gap-4">
                    <div>
                        <span class="text-xs font-bold text-sky-600 block">${fechaFormateada}</span>
                        <span class="text-[10px] text-slate-400 font-medium block">Redactado por: ${nombreCreador}</span>
                    </div>
                    <button onclick="eliminarParteDiario(${parte.id})" class="text-slate-300 hover:text-red-500 p-1 rounded transition-colors" title="Eliminar Parte">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
                <p class="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed pt-1 select-text">${parte.contenido}</p>
            `;
            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-sm text-red-500 font-medium py-8">Error de conexión con el servidor.</p>`;
    }
}

// Registrar el nuevo informe de jornada mediante una petición POST
async function guardarParteDiario(evento) {
    evento.preventDefault();

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    // Sacamos el ID del empleado logueado guardado previamente en el login
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;

    const fechaVal = document.getElementById('input-fecha').value;
    const contenidoVal = document.getElementById('txt-contenido').value;

    // Cuerpo JSON correspondiente exactamente con tu entidad ParteDiario.java
    const payloadJson = {
        fecha: fechaVal,
        contenido: contenidoVal,
        creador: {
            id: parseInt(empleadoId) // Tu controlador asocia la relación ManyToOne usando el ID
        }
    };

    try {
        const respuesta = await fetch(`${baseUrl}/api/partes-diarios`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadJson)
        });

        if (!respuesta.ok) throw new Error('Error al guardar el parte en el servidor');

        alert('¡Perfecto! El parte diario ha sido guardado de forma correcta.');

        // Limpiar el cuadro de texto y refrescar la lista lateral al instante
        document.getElementById('txt-contenido').value = '';
        document.getElementById('char-counter').innerText = "0 / 2000 caracteres";
        obtenerHistorialPartes();

    } catch (error) {
        console.error(error);
        alert(`No se pudo registrar el parte: ${error.message}`);
    }
}

// Eliminar un informe mediante el endpoint DELETE
async function eliminarParteDiario(id) {
    if (!confirm('¿Estás completamente seguro de que deseas eliminar este parte diario del registro historial?')) return;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/partes-diarios/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo eliminar el elemento seleccionado');

        // Refrescar el panel al instante
        obtenerHistorialPartes();

    } catch (error) {
        console.error(error);
        alert(`Error al procesar la eliminación: ${error.message}`);
    }
}

// Función auxiliar para formatear la fecha YYYY-MM-DD a DD/MM/YYYY amigable
function formatearFechaEspanol(fechaString) {
    if (!fechaString) return 'N/A';
    const partes = fechaString.split('-');
    if (partes.length !== 3) return fechaString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}