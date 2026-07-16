// Lógica del Panel/Menú Principal e Integración de Fichajes Reales
document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión activa
    if (window.Auth && !window.Auth.checkSession()) return;

    // Obtener y mostrar nombre del usuario decodificado
    const username = window.Auth ? window.Auth.getUsername() : 'Usuario';
    document.getElementById('user-display').innerText = username;
    document.getElementById('welcome-username').innerText = username;

    // Sincronizar el estado real del fichaje con la Base de Datos al entrar
    comprobarEstadoFichajeServidor();
});

// Realiza un GET al servidor para comprobar si el usuario tiene un turno abierto
async function comprobarEstadoFichajeServidor() {
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/fichajes/estado`, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo verificar el estado de asistencia.');
        const estaTrabajando = await respuesta.json(); // Devuelve true o false desde el controlador

        // Sincronizamos la interfaz basándonos en la realidad del servidor
        actualizarBotonFicharUI(estaTrabajando);

    } catch (error) {
        console.error("Error al comprobar fichaje:", error);
        // Fallback defensivo a localStorage en caso de caída de red momentánea
        const fallback = localStorage.getItem('resi_trabajando') === 'true';
        actualizarBotonFicharUI(fallback);
    }
}

// Se encarga EXCLUSIVAMENTE de renderizar los colores y textos del botón en el DOM
function actualizarBotonFicharUI(estaTrabajando) {
    const btn = document.getElementById('btn-fichar');
    if (!btn) return;

    // Guardamos en local un espejo del estado solo para consultas rápidas de interfaz
    localStorage.setItem('resi_trabajando', estaTrabajando);

    if (estaTrabajando) {
        btn.className = "w-full sm:w-auto px-6 py-3 rounded-xl font-bold shadow-md transition-all duration-200 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm bg-red-600 hover:bg-red-700 text-white";
        btn.innerHTML = `
            <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            Fichar Salida
        `;
    } else {
        btn.className = "w-full sm:w-auto px-6 py-3 rounded-xl font-bold shadow-md transition-all duration-200 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white";
        btn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            Fichar Entrada
        `;
    }
}


async function alternarFichaje() {
    const btn = document.getElementById('btn-fichar');
    if (!btn) return;

    
    btn.disabled = true;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/fichajes/alternar`, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('El servidor rechazó la solicitud de fichaje.');
        const resultadoTexto = await respuesta.text(); // Devuelve "ENTRADA_REGISTRADA" o "SALIDA_REGISTRADA"

        if (resultadoTexto === "ENTRADA_REGISTRADA") {
            actualizarBotonFicharUI(true);
            alert('🚀 ¡Buen turno! Has fichado la Entrada correctamente en el servidor.');
        } else if (resultadoTexto === "SALIDA_REGISTRADA") {
            actualizarBotonFicharUI(false);
            alert('🛌 ¡Buen descanso! Has fichado la Salida correctamente en el servidor.');
        }

    } catch (error) {
        console.error(error);
        alert(`❌ Error al fichar: ${error.message}`);
    } finally {
        // Volver a habilitar el botón
        btn.disabled = false;
    }
}

function cerrarSesion() {
    if (window.Auth) {
        window.Auth.logout();
    }
}