// Lógica de Registro de Enfermería en Cadena
document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de sesión global
    if (window.Auth && !window.Auth.checkSession()) return;

    // 2. Vincular eventos iniciales de la UI
    document.getElementById('btn-iniciar-flujo').addEventListener('click', iniciarFlujoEnfermeria);
    document.getElementById('btn-guardar-parte').addEventListener('click', guardarRegistroEnfermeria);
    document.getElementById('btn-siguiente').addEventListener('click', siguienteResidente);
    document.getElementById('btn-toggle-historial').addEventListener('click', toggleHistorialClinico);

    // 3. Preparar los selectores con tus Enums reales de Enfermería
    inicializarSelectsConEnums();

    // 4. Solicitar la lista de residentes reales a la API
    obtenerResidentesDesdeApi();
});

let residentesSeleccionados = [];
let indiceActivo = 0;

// Carga los residentes reales de tu base de datos
async function obtenerResidentesDesdeApi() {
    const grid = document.getElementById('grid-residentes');
    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('Error al recuperar los residentes');
        const residentes = await respuesta.json();
        grid.innerHTML = '';

        if (residentes.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center text-sm text-slate-400 italic py-4">No hay residentes registrados en el sistema.</p>`;
            return;
        }

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
            tarjeta.addEventListener('click', () => cambiarEstadoTarjeta(tarjeta, res));
            grid.appendChild(tarjeta);
        });
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="col-span-full text-center text-sm text-red-500 font-medium py-4">Error de conexión con el servidor.</p>`;
    }
}

function cambiarEstadoTarjeta(elemento, residente) {
    const idx = residentesSeleccionados.findIndex(r => r.id === residente.id);
    const avatar = elemento.querySelector('.id-avatar');

    if (idx > -1) {
        residentesSeleccionados.splice(idx, 1);
        elemento.classList.remove('bg-rose-50/60', 'border-rose-400', 'shadow-md', 'ring-2', 'ring-rose-200');
        elemento.classList.add('bg-white', 'border-slate-200');
        if (avatar) {
            avatar.classList.remove('bg-rose-600', 'text-white');
            avatar.classList.add('bg-slate-100', 'text-slate-600');
        }
    } else {
        residentesSeleccionados.push(residente);
        elemento.classList.remove('bg-white', 'border-slate-200');
        elemento.classList.add('bg-rose-50/60', 'border-rose-400', 'shadow-md', 'ring-2', 'ring-rose-200');
        if (avatar) {
            avatar.classList.remove('bg-slate-100', 'text-slate-600');
            avatar.classList.add('bg-rose-600', 'text-white');
        }
    }

    document.getElementById('contador-seleccionados').innerText = `${residentesSeleccionados.length} seleccionados`;
    const btnIniciar = document.getElementById('btn-iniciar-flujo');
    if (residentesSeleccionados.length > 0) {
        btnIniciar.removeAttribute('disabled');
        btnIniciar.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btnIniciar.setAttribute('disabled', 'true');
        btnIniciar.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function iniciarFlujoEnfermeria() {
    indiceActivo = 0;
    document.getElementById('seccion-seleccion').classList.add('hidden');
    document.getElementById('seccion-formularios').classList.remove('hidden');
    establecerResidenteActivo();
}

function establecerResidenteActivo() {
    const residente = residentesSeleccionados[indiceActivo];
    document.getElementById('info-progreso').innerText = `Residente ${indiceActivo + 1} de ${residentesSeleccionados.length}`;
    document.getElementById('nombre-residente-activo').innerText = `${residente.nombre} ${residente.apellidos}`;

    document.getElementById('form-enfermeria').reset();

    // Asegurarnos de cerrar el panel de historial al saltar de residente para que no se quede abierto con datos viejos
    document.getElementById('panel-historial-clinico').classList.add('hidden');
}

// Desplegar/Ocultar Historial Clínico previo mediante fetch dinámico
async function toggleHistorialClinico() {
    const panel = document.getElementById('panel-historial-clinico');
    const contenedor = document.getElementById('contenedor-linea-vida');
    const residente = residentesSeleccionados[indiceActivo];

    panel.classList.toggle('hidden');

    // Si al mutar clases ahora es visible, solicitamos el historial al endpoint GET de tu back
    if (!panel.classList.contains('hidden')) {
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Cargando evolución clínica...</p>`;

        try {
            const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
            const respuesta = await fetch(`${baseUrl}/api/registros-enfermeria/residente/${residente.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!respuesta.ok) throw new Error('No se pudo recuperar el historial clínico');
            const historial = await respuesta.json();
            contenedor.innerHTML = '';

            if (historial.length === 0) {
                contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan registros previos de enfermería para este residente.</p>`;
                return;
            }

            // Pintar los registros ordenados por fecha
            historial.forEach(reg => {
                const fecha = new Date(reg.fechaHora).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const enfermero = reg.enfermero ? `${reg.enfermero.nombre} ${reg.enfermero.apellidos}` : 'Enfermería';

                const item = document.createElement('div');
                item.className = "bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-1 shadow-sm";
                item.innerHTML = `
                    <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                        <span class="text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase tracking-wider">${reg.tipoAction || reg.tipoAccion}</span>
                        <span>${fecha}</span>
                    </div>
                    <p class="text-xs text-slate-700 leading-relaxed font-medium mt-1 select-text">${reg.observacion}</p>
                    <span class="text-[9px] text-slate-400 text-right font-medium block">Firmado: ${enfermero}</span>
                `;
                contenedor.appendChild(item);
            });

        } catch (error) {
            console.error(error);
            contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error al conectar con el servidor.</p>`;
        }
    }
}

// Envía la información clínica al backend respetando tus RequestParams y RequestBody
async function guardarRegistroEnfermeria() {
    const residente = residentesSeleccionados[indiceActivo];
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const enfermeroId = localStorage.getItem('resi_empleado_id') || 1;

    const formData = new FormData(document.getElementById('form-enfermeria'));
    const urlEndpoint = `${baseUrl}/api/registros-enfermeria?residenteId=${residente.id}&enfermeroId=${enfermeroId}`;

    const payloadJson = {
        tipoAccion: formData.get('tipoAccion'),
        observacion: formData.get('observacion')
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

        if (!respuesta.ok) throw new Error('No se pudo guardar la evolución clínica');

        alert(`¡Éxito! Registro clínico guardado correctamente para ${residente.nombre}.`);

        // Si el historial estaba abierto, lo recargamos automáticamente para ver la nueva anotación insertada al vuelo
        const panel = document.getElementById('panel-historial-clinico');
        if (!panel.classList.contains('hidden')) {
            panel.classList.add('hidden');
            toggleHistorialClinico();
        }

    } catch (error) {
        console.error(error);
        alert(`Error al guardar en el servidor: ${error.message}`);
    }
}

function siguienteResidente() {
    if (indiceActivo < residentesSeleccionados.length - 1) {
        indiceActivo++;
        establecerResidenteActivo();
    } else {
        alert('¡Excelente trabajo! Has completado la rueda clínica de enfermería.');
        residentesSeleccionados = [];
        document.getElementById('contador-seleccionados').innerText = '0 seleccionados';

        const btnIniciar = document.getElementById('btn-iniciar-flujo');
        btnIniciar.setAttribute('disabled', 'true');
        btnIniciar.classList.add('opacity-50', 'cursor-not-allowed');

        document.getElementById('seccion-formularios').classList.add('hidden');
        document.getElementById('seccion-seleccion').classList.remove('hidden');
        obtenerResidentesDesdeApi();
    }
}

// Inicializa las opciones amigables de tu enum AccionEnfermeria
function inicializarSelectsConEnums() {
    const selectAccion = document.getElementById('select-tipo-accion');
    if (selectAccion) {
        selectAccion.innerHTML = `
            <option value="CONSTANTES">📌 CONTROL DE CONSTANTES</option>
            <option value="CURAS">🩹 CURAS Y HERIDAS</option>
            <option value="GLUCEMIA">🩸 CONTROL GLUCEMIA (HGT)</option>
            <option value="INCIDENCIA_MEDICA">🚨 INCIDENCIA MÉDICA</option>
            <option value="MEDICACION_PUNTUAL">💊 MEDICACIÓN PUNTUAL</option>
            <option value="OTROS">📝 OTROS REGISTROS</option>
        `;
    }
}
