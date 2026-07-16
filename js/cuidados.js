// Lógica de Cuidados Diarios - Registro Secuencial en Bloque
document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de sesión e inicialización (Patrón del sistema)
    if (window.Auth && !window.Auth.checkSession()) return;

    // 2. Vincular eventos a la interfaz limpia
    document.getElementById('btn-iniciar-flujo').addEventListener('click', iniciarFlujoCuidados);
    document.getElementById('btn-guardar-parte').addEventListener('click', guardarParteActual);
    document.getElementById('btn-siguiente').addEventListener('click', siguienteResidente);

    document.getElementById('tab-higiene').addEventListener('click', () => cambiarPestaña('higiene'));
    document.getElementById('tab-evacuaciones').addEventListener('click', () => cambiarPestaña('evacuaciones'));
    document.getElementById('tab-cambios').addEventListener('click', () => cambiarPestaña('cambios'));

    // Listeners dinámicos para bloquear/desbloquear tipos de evacuación al vuelo
    document.getElementById('select-cant-orina').addEventListener('change', evaluarBloqueoEvacuaciones);
    document.getElementById('select-cant-depo').addEventListener('change', evaluarBloqueoEvacuaciones);

    // 3. Preparar los selectores con tus Enums reales del Backend
    inicializarSelectsConEnums();

    // 4. Solicitar la lista de residentes reales a la API de Spring Boot
    obtenerResidentesDesdeApi();
});

// Variables globales para la gestión de la cola de trabajo
let residentesSeleccionados = [];
let indiceActivo = 0;
let pestañaActiva = 'higiene';

// Carga los residentes reales de la base de datos para pintar las tarjetitas
async function obtenerResidentesDesdeApi() {
    const grid = document.getElementById('grid-residentes');

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        // Hacemos el GET al controlador de residentes
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

        // Renderizamos cada tarjeta con tus datos reales del modelo
        residentes.forEach(res => {
            const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
            const tarjeta = document.createElement('div');
            // Clases base iniciales usando tu estilo premium
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
        grid.innerHTML = `<p class="col-span-full text-center text-sm text-red-500 font-medium py-4">Error de conexión con el servidor de datos.</p>`;
    }
}

// Controla el marcado visual inmediato mediante inyección explícita de Tailwind
function cambiarEstadoTarjeta(elemento, residente) {
    const idx = residentesSeleccionados.findIndex(r => r.id === residente.id);
    const avatar = elemento.querySelector('.id-avatar');

    if (idx > -1) {
        // Deseleccionar (Vuelve al estado original blanco)
        residentesSeleccionados.splice(idx, 1);
        elemento.classList.remove('bg-sky-50/60', 'border-sky-500', 'shadow-md', 'ring-2', 'ring-sky-200');
        elemento.classList.add('bg-white', 'border-slate-200');
        if (avatar) {
            avatar.classList.remove('bg-sky-600', 'text-white');
            avatar.classList.add('bg-slate-100', 'text-slate-600');
        }
    } else {
        // Seleccionar (Ensombrece con tono azul premium e ilumina el avatar de forma contundente)
        residentesSeleccionados.push(residente);
        elemento.classList.remove('bg-white', 'border-slate-200');
        elemento.classList.add('bg-sky-50/60', 'border-sky-500', 'shadow-md', 'ring-2', 'ring-sky-200');
        if (avatar) {
            avatar.classList.remove('bg-slate-100', 'text-slate-600');
            avatar.classList.add('bg-sky-600', 'text-white');
        }
    }

    // Actualizar los contadores de la cabecera
    document.getElementById('contador-seleccionados').innerText = `${residentesSeleccionados.length} seleccionados`;

    // Habilitar/Deshabilitar botón de inicio
    const btnIniciar = document.getElementById('btn-iniciar-flujo');
    if (residentesSeleccionados.length > 0) {
        btnIniciar.removeAttribute('disabled');
        btnIniciar.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btnIniciar.setAttribute('disabled', 'true');
        btnIniciar.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// Oculta por completo la sección de tarjetas e inicializa el flujo asistencial
function iniciarFlujoCuidados() {
    indiceActivo = 0;
    document.getElementById('seccion-seleccion').classList.add('hidden');
    document.getElementById('seccion-formularios').classList.remove('hidden');
    cambiarPestaña('higiene');
    establecerResidenteActivo();
}

// Controla si se activan o desactivan los selectores según si ha evacuado o no
function evaluarBloqueoEvacuaciones() {
    const selectCantOrina = document.getElementById('select-cant-orina');
    const selectTipoOrina = document.getElementById('select-tipo-orina');

    // Si la cantidad es NULA (es decir, el usuario dejó marcado el "NO"), bloqueamos el tipo de orina
    if (selectCantOrina.value === "NULA") {
        selectTipoOrina.value = "NORMAL"; // Valor basal por defecto de tu Enum
        selectTipoOrina.classList.add('opacity-50', 'pointer-events-none');
    } else {
        selectTipoOrina.classList.remove('opacity-50', 'pointer-events-none');
    }

    const selectCantDepo = document.getElementById('select-cant-depo');
    const selectTipoDepo = document.getElementById('select-tipo-depo');

    // Si la cantidad es NULA (el usuario dejó el "NO"), bloqueamos el tipo de deposición
    if (selectCantDepo.value === "NULA") {
        selectTipoDepo.value = "NORMAL"; // Valor basal por defecto de tu Enum
        selectTipoDepo.classList.add('opacity-50', 'pointer-events-none');
    } else {
        selectTipoDepo.classList.remove('opacity-50', 'pointer-events-none');
    }
}

// Actualiza los textos de la barra de control para apuntar al residente de turno
function establecerResidenteActivo() {
    const residente = residentesSeleccionados[indiceActivo];
    document.getElementById('info-progreso').innerText = `Residente ${indiceActivo + 1} de ${residentesSeleccionados.length}`;
    document.getElementById('nombre-residente-activo').innerText = `${residente.nombre} ${residente.apellidos}`;

    document.getElementById('form-higiene').reset();
    document.getElementById('form-evacuaciones').reset();
    document.getElementById('form-cambios').reset();

    // Forzar que los bloqueos y selectores se evalúen correctamente al cambiar de ficha
    evaluarBloqueoEvacuaciones();
}

// Guarda la información del formulario activo hacia tu backend
async function guardarParteActual() {
    const residente = residentesSeleccionados[indiceActivo];
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;

    let urlEndpoint = '';
    let payloadJson = {};

    if (pestañaActiva === 'higiene') {
        urlEndpoint = `${baseUrl}/api/cuidados/higiene/residente/${residente.id}/empleado/${empleadoId}`;
        const formData = new FormData(document.getElementById('form-higiene'));
        payloadJson = {
            higieneIntima: formData.get('higieneIntima'),
            ducha: formData.get('ducha'),
            higieneBucal: formData.get('higieneBucal'),
            corteUnas: formData.get('corteUnas'),
            afeitado: formData.get('afeitado'),
            hidratacionPiel: formData.get('hidratacionPiel'),
            levantarResidente: formData.get('levantarResidente')
        };
    } else if (pestañaActiva === 'evacuaciones') {
        urlEndpoint = `${baseUrl}/api/cuidados/evacuaciones/residente/${residente.id}/empleado/${empleadoId}`;
        const formData = new FormData(document.getElementById('form-evacuaciones'));
        payloadJson = {
            cantOrina: formData.get('cantOrina'), // Mandará NULA si marcaron NO, o la cantidad real
            orina: formData.get('orina'),         // Tipo de orina
            cantDepo: formData.get('cantDepo'),   // Mandará NULA si marcaron NO, o la cantidad real
            depo: formData.get('depo')            // Tipo de deposición
        };
    } else if (pestañaActiva === 'cambios') {
        urlEndpoint = `${baseUrl}/api/cuidados/cambios-posturales/residente/${residente.id}/empleado/${empleadoId}`;
        const formData = new FormData(document.getElementById('form-cambios'));
        payloadJson = {
            posicion: formData.get('posicion'),
            observaciones: formData.get('observaciones')
        };
    }

    try {
        const respuesta = await fetch(urlEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadJson)
        });

        if (!respuesta.ok) throw new Error('No se pudo registrar el parte');

        alert(`¡Éxito! Parte de ${pestañaActiva.toUpperCase()} guardado correctamente para ${residente.nombre}.`);

    } catch (error) {
        console.error(error);
        alert(`Error al guardar el registro en el servidor: ${error.message}`);
    }
}

// Avanzar en la cola de residentes seleccionados
function siguienteResidente() {
    if (indiceActivo < residentesSeleccionados.length - 1) {
        indiceActivo++;
        establecerResidenteActivo();
    } else {
        alert('¡Excelente trabajo! Has completado el registro de todos los residentes asignados al lote.');
        // Reiniciar la vista y devolver la selección limpia
        residentesSeleccionados = [];
        document.getElementById('contador-seleccionados').innerText = '0 seleccionados';

        const btnIniciar = document.getElementById('btn-iniciar-flujo');
        btnIniciar.setAttribute('disabled', 'true');
        btnIniciar.classList.add('opacity-50', 'cursor-not-allowed');

        document.getElementById('seccion-formularios').classList.add('hidden');
        document.getElementById('seccion-seleccion').classList.remove('hidden');
        obtenerResidentesDesdeApi(); // Recarga limpias las tarjetas
    }
}

// Control visual interactivo de los subpaneles asistenciales
function cambiarPestaña(tipo) {
    pestañaActiva = tipo;

    document.querySelectorAll('.panel-cuidados').forEach(p => p.classList.add('hidden'));
    document.getElementById(`panel-${tipo}`).classList.remove('hidden');

    ['higiene', 'evacuaciones', 'cambios'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (t === tipo) {
            btn.className = "tab-btn px-5 py-3 text-sm font-semibold border-b-2 border-sky-600 text-sky-600 transition-all";
        } else {
            btn.className = "tab-btn px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-600 transition-all";
        }
    });
}

// Rellena los selectores del DOM respetando las mayúsculas exactas de tus Enums de Java
function inicializarSelectsConEnums() {
    // 1. EstadoTarea (SI, NO, NA) para Higiene
    const opcionesHigiene = `
        <option value="SI">SÍ</option>
        <option value="NO">NO</option>
        <option value="NA">NO PROCEDE (N/A)</option>
    `;
    ['higieneIntima', 'ducha', 'higieneBucal', 'corteUnas', 'afeitado', 'hidratacionPiel', 'levantarResidente'].forEach(campo => {
        const select = document.querySelector(`select[name="${campo}"]`);
        if (select) select.innerHTML = opcionesHigiene;
    });

    // 2. CantidadOrina (Por defecto NULA mapeado como un claro "NO" visual)
    const selectCantOrina = document.getElementById('select-cant-orina');
    if (selectCantOrina) {
        selectCantOrina.innerHTML = `
            <option value="NULA" selected>NO</option>
            <option value="POCA">SÍ, POCA</option>
            <option value="NORMAL">SÍ, NORMAL</option>
            <option value="MUCHA">SÍ, MUCHA</option>
        `;
    }

    // 3. TipoOrina
    const selectTipoOrina = document.getElementById('select-tipo-orina');
    if (selectTipoOrina) {
        selectTipoOrina.innerHTML = `
            <option value="NORMAL">NORMAL</option>
            <option value="CONCENTRADA">CONCENTRADA</option>
            <option value="TURBIA">TURBIA</option>
            <option value="HEMATURIA">HEMATURIA</option>
        `;
    }

    // 4. CantidadDepo (Por defecto NULA mapeado como un claro "NO" visual)
    const selectCantDepo = document.getElementById('select-cant-depo');
    if (selectCantDepo) {
        selectCantDepo.innerHTML = `
            <option value="NULA" selected>NO</option>
            <option value="POCA">SÍ, POCA</option>
            <option value="NORMAL">SÍ, NORMAL</option>
            <option value="MUCHA">SÍ, MUCHA</option>
        `;
    }

    // 5. TipoDepo
    const selectTipoDepo = document.getElementById('select-tipo-depo');
    if (selectTipoDepo) {
        selectTipoDepo.innerHTML = `
            <option value="NORMAL">NORMAL</option>
            <option value="DURA">DURA</option>
            <option value="LIQUIDA">LÍQUIDA</option>
            <option value="PASTOSA">PASTOSA</option>
            <option value="SEMILIQUIDA">SEMILÍQUIDA</option>
        `;
    }

    // 6. Posiciones para Cambios Posturales (Enum Posiciones.java con sus nombres exactos)
    const selectPosicion = document.querySelector('select[name="posicion"]');
    if (selectPosicion) {
        selectPosicion.innerHTML = `
            <option value="DECUBITO_SUPINO">BOCA ARRIBA (SUPINO)</option>
            <option value="DECUBITO_LATERAL_IZQ">LATERAL IZQUIERDO</option>
            <option value="DECUBITO_LATERAL_DER">LATERAL DERECHO</option>
            <option value="FOWLERR">FOWLER (SENTADO)</option>
        `;
    }
}