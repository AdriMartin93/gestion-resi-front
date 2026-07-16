// Lógica de Gestión de Sesiones de Fisioterapia (Individuales o Grupales)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de seguridad global (Patrón del sistema)
    if (window.Auth && !window.Auth.checkSession()) return;

    // 2. Vincular eventos de la interfaz
    document.getElementById('form-fisio').addEventListener('submit', guardarSesionFisio);
    document.getElementById('btn-ver-historial').addEventListener('click', consultarHistorialFisio);

    // 3. Preparar el selector con tus Enums reales de ActividadFisio
    inicializarSelectsConEnums();

    // 4. Solicitar la lista de residentes reales a la API de Spring Boot
    obtenerResidentesDesdeApi();
});

// Variables globales para el control de selección en bloque
let residentesSeleccionados = [];

// Recupera los residentes reales de la base de datos
async function obtenerResidentesDesdeApi() {
    const grid = document.getElementById('grid-residentes');
    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        // Petición idéntica a Cuidados y Enfermería (Sencilla e infalible)
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error(`Error en el servidor (Código: ${respuesta.status})`);
        const residentes = await respuesta.json();
        grid.innerHTML = '';

        if (residentes.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center text-sm text-slate-400 italic py-4">No hay residentes registrados en el sistema.</p>`;
            return;
        }

        // Renderizar las tarjetas de residentes
        residentes.forEach(res => {
            const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
            const tarjeta = document.createElement('div');
            tarjeta.className = "card-premium p-4 cursor-pointer text-center flex flex-col items-center justify-center gap-1 bg-white border-slate-200 transition-all duration-200 select-none";
            tarjeta.innerHTML = `
                <div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-sm mb-1 transition-colors id-avatar">
                    ${iniciales}
                </div>
                <span class="font-bold text-sm text-slate-700 block truncate max-w-full">${res.nombre} ${res.apellidos}</span>
                <span class="text-[10px] text-slate-400 font-medium">Hab. ${res.habitacion || 'N/A'}</span>
            `;
            tarjeta.addEventListener('click', () => gestionarSeleccionTarjeta(tarjeta, res));
            grid.appendChild(tarjeta);
        });
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="col-span-full text-center text-sm text-red-500 font-medium py-4">Error al cargar la lista: ${error.message}</p>`;
    }
}

// Controla la selección múltiple iluminando las tarjetas con el color verde azulado (Teal) de fisioterapia
function gestionarSeleccionTarjeta(elemento, residente) {
    const idx = residentesSeleccionados.findIndex(r => r.id === residente.id);
    const avatar = elemento.querySelector('.id-avatar');

    if (idx > -1) {
        // Deseleccionar
        residentesSeleccionados.splice(idx, 1);
        elemento.classList.remove('bg-teal-50/60', 'border-teal-500', 'shadow-md', 'ring-2', 'ring-teal-200');
        elemento.classList.add('bg-white', 'border-slate-200');
        if (avatar) {
            avatar.classList.remove('bg-teal-600', 'text-white');
            avatar.classList.add('bg-slate-100', 'text-slate-600');
        }
    } else {
        // Seleccionar
        residentesSeleccionados.push(residente);
        elemento.classList.remove('bg-white', 'border-slate-200');
        elemento.classList.add('bg-teal-50/60', 'border-teal-500', 'shadow-md', 'ring-2', 'ring-teal-200');
        if (avatar) {
            avatar.classList.remove('bg-slate-100', 'text-slate-600');
            avatar.classList.add('bg-teal-600', 'text-white');
        }
    }

    // Cerrar panel de historial clínico para evitar inconsistencias si cambia la selección
    document.getElementById('panel-historial-fisio').classList.add('hidden');

    // Actualizar contadores en UI
    const totalSeleccionados = residentesSeleccionados.length;
    document.getElementById('contador-seleccionados').innerText = `${totalSeleccionados} seleccionados`;

    // 1. Controlar botón del Formulario (Se activa si hay AL MENOS 1 residente marcado)
    const btnGuardar = document.getElementById('btn-guardar-fisio');
    if (totalSeleccionados > 0) {
        btnGuardar.removeAttribute('disabled');
        btnGuardar.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btnGuardar.setAttribute('disabled', 'true');
        btnGuardar.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // 2. Controlar botón de Historial (Solo tiene sentido consultar el historial si hay EXACTAMENTE 1 residente marcado)
    const btnHistorial = document.getElementById('btn-ver-historial');
    if (totalSeleccionados === 1) {
        btnHistorial.removeAttribute('disabled');
        btnHistorial.className = "w-full bg-white border border-teal-200 hover:border-teal-500 hover:bg-teal-50/10 text-teal-600 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse";
    } else {
        btnHistorial.setAttribute('disabled', 'true');
        btnHistorial.className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";
    }
}

// Envía la sesión grupal o individual al backend mapeando múltiples parámetros 'residentesIds'
async function guardarSesionFisio(evento) {
    evento.preventDefault();

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;

    // Convertimos la lista de seleccionados en: residentesIds=1&residentesIds=2
    // Esta es la forma correcta de enviar un 'List<Long>' por @RequestParam en Spring Boot
    const paramsResidentes = residentesSeleccionados.map(r => `residentesIds=${r.id}`).join('&');

    const formData = new FormData(document.getElementById('form-fisio'));
    const urlEndpoint = `${baseUrl}/api/registros-fisio?empleadoId=${empleadoId}&${paramsResidentes}`;

    const payloadJson = {
        actividadFisio: formData.get('actividadFisio'),
        observaciones: formData.get('observaciones')
    };

    try {
        const respuesta = await fetch(urlEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadJson)
        });

        if (!respuesta.ok) throw new Error(`Error en el servidor al guardar (Código: ${respuesta.status})`);

        alert(`¡Éxito! Sesión registrada correctamente para los ${residentesSeleccionados.length} residentes.`);

        // Limpiar formulario y reiniciar selección
        document.getElementById('form-fisio').reset();
        residentesSeleccionados = [];
        document.getElementById('contador-seleccionados').innerText = '0 seleccionados';

        document.getElementById('btn-guardar-fisio').setAttribute('disabled', 'true');
        document.getElementById('btn-guardar-fisio').classList.add('opacity-50', 'cursor-not-allowed');

        document.getElementById('btn-ver-historial').setAttribute('disabled', 'true');
        document.getElementById('btn-ver-historial').className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";

        obtenerResidentesDesdeApi();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar en el servidor: ${error.message}`);
    }
}


// Consulta el histórico clínico previo filtrando por el residente seleccionado
async function consultarHistorialFisio() {
    const panel = document.getElementById('panel-historial-fisio');
    const contenedor = document.getElementById('contenedor-linea-vida');
    const residente = residentesSeleccionados[0];

    if (!residente) return;

    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
        const elementoNombre = document.querySelector('.id-nombre-historial');
        if (elementoNombre) {
            elementoNombre.innerText = `Historial de ${residente.nombre}`;
        }
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Buscando sesiones previas...</p>`;    

        try {
            const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

            // Llamada GET a tu endpoint: /api/registros-fisio/residente/{residenteId}
            const respuesta = await fetch(`${baseUrl}/api/registros-fisio/residente/${residente.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!respuesta.ok) throw new Error('No se pudo recuperar el historial');
            const sesiones = await respuesta.json();
            contenedor.innerHTML = '';

            if (sesiones.length === 0) {
                contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan registros de fisioterapia previos.</p>`;
                return;
            }

            sesiones.forEach(sesion => {
                const fechaPartes = sesion.fechaRegistro.split('-');
                const fechaFormateada = `${fechaPartes[2]}/${fechaPartes[1]}/${fechaPartes[0]}`;
                const fisioNombre = sesion.empleado ? `${sesion.empleado.nombre} ${sesion.empleado.apellidos}` : 'Fisioterapeuta';

                const item = document.createElement('div');
                item.className = "bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-1 shadow-sm";
                item.innerHTML = `
                    <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                        <span class="text-teal-600 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded uppercase tracking-wider">${sesion.actividadFisio}</span>
                        <span>${fechaFormateada}</span>
                    </div>
                    <p class="text-xs text-slate-700 leading-relaxed font-medium mt-1 select-text">${sesion.observaciones}</p>
                    <span class="text-[9px] text-slate-400 text-right font-medium block">Tratamiento por: ${fisioNombre}</span>
                `;
                contenedor.appendChild(item);
            });

        } catch (error) {
            console.error(error);
            contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error al conectar con el servidor.</p>`;
        }
    }
}

// Inicializa las opciones del selector mapeando los Enums de ActividadFisio EXACTOS de tu backend
function inicializarSelectsConEnums() {
    const selectActividad = document.getElementById('select-actividad');
    if (selectActividad) {
        selectActividad.innerHTML = `
            <option value="GIMNASIA_GRUPAL">🧘 GIMNASIA GRUPAL / TALLER</option>
            <option value="REEDUCACION_MARCHA">🚶 REEDUCACIÓN DE MARCHA / BIPEDESTACIÓN</option>
            <option value="CINESITERAPIA">💪 CINESITERAPIA (MOVILIZACIONES)</option>
            <option value="MASOTERAPIA">💆 MASOTERAPIA / TRATAMIENTO MANUAL</option>
            <option value="TERAPIA_OCUPACIONAL">🎨 TERAPIA OCUPACIONAL</option>
        `;
    }
}