// Lógica de Gestión del Módulo de Psicología
document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de seguridad
    if (window.Auth && !window.Auth.checkSession()) return;

    // 2. Enlace de Eventos
    document.getElementById('form-psico').addEventListener('submit', guardarRegistroPsico);
    document.getElementById('btn-ver-historial').addEventListener('click', consultarHistorialPsico);

    // 3. Render Basal de Enums
    inicializarSelectsConEnums();

    // 4. Carga inicial de residentes
    obtenerResidentesDesdeApi();
});

// Variable global de control de lote
let residentesSeleccionados = [];

// Obtiene los residentes desde tu API en Spring Boot
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

        if (!respuesta.ok) throw new Error(`Fallo del servidor (Status: ${respuesta.status})`);
        const residentes = await respuesta.json();
        grid.innerHTML = '';

        if (residentes.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center text-xs text-slate-400 italic py-4">No constan residentes activos en el sistema.</p>`;
            return;
        }

        residentes.forEach(res => {
            const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
            const tarjeta = document.createElement('div');
            // Usamos card-premium de tu style.css para homogeneizar
            tarjeta.className = "card-premium p-4 cursor-pointer text-center flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 select-none shadow-sm";
            tarjeta.innerHTML = `
                <div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-sm mb-1 transition-colors id-avatar">
                    ${iniciales}
                </div>
                <span class="font-bold text-xs text-slate-700 block truncate max-w-full">${res.nombre} ${res.apellidos}</span>
                <span class="text-[10px] text-slate-400 font-medium">Hab. ${res.habitacion || 'N/A'}</span>
            `;
            tarjeta.addEventListener('click', () => gestionarSeleccionTarjeta(tarjeta, res));
            grid.appendChild(tarjeta);
        });
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="col-span-full text-center text-xs text-red-500 font-medium py-4">Fallo de red al instanciar residentes: ${error.message}</p>`;
    }
}

// Manipulación del lote aplicando .card-residente-seleccionado de tu style.css
function gestionarSeleccionTarjeta(elemento, residente) {
    const idx = residentesSeleccionados.findIndex(r => r.id === residente.id);
    const avatar = elemento.querySelector('.id-avatar');

    if (idx > -1) {
        // Deseleccionar
        residentesSeleccionados.splice(idx, 1);
        elemento.classList.remove('card-residente-seleccionado');
        if (avatar) {
            avatar.classList.remove('bg-sky-600', 'text-white');
            avatar.classList.add('bg-slate-100', 'text-slate-600');
        }
    } else {
        // Seleccionar
        residentesSeleccionados.push(residente);
        elemento.classList.add('card-residente-seleccionado');
        if (avatar) {
            avatar.classList.remove('bg-slate-100', 'text-slate-600');
            avatar.classList.add('bg-sky-600', 'text-white');
        }
    }

    // Ocultar panel historial clínico para evitar desajustes si cambia la selección
    document.getElementById('panel-historial-psico').classList.add('hidden');

    const totalSeleccionados = residentesSeleccionados.length;
    document.getElementById('contador-seleccionados').innerText = `${totalSeleccionados} seleccionados`;

    // Evaluar botón de guardar usando .btn-disabled de tu style.css
    const btnGuardar = document.getElementById('btn-guardar-psico');
    if (totalSeleccionados > 0) {
        btnGuardar.removeAttribute('disabled');
        btnGuardar.classList.remove('btn-disabled');
    } else {
        btnGuardar.setAttribute('disabled', 'true');
        btnGuardar.classList.add('btn-disabled');
    }

    // Evaluar botón de historial clínico (Exactamente 1 seleccionado)
    const btnHistorial = document.getElementById('btn-ver-historial');
    if (totalSeleccionados === 1) {
        btnHistorial.removeAttribute('disabled');
        btnHistorial.className = "w-full bg-white border border-sky-200 hover:border-sky-500 hover:bg-sky-50/10 text-sky-600 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse";
    } else {
        btnHistorial.setAttribute('disabled', 'true');
        btnHistorial.className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";
    }
}

// Envío estructurado a /api/registros-psicologia con List<Long> residentesIds en URL
// Reemplaza esta función en tu js/psicologia.js
async function guardarRegistroPsico(evento) {
    evento.preventDefault();

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;

    // Serialización correcta para List<Long> por @RequestParam en Spring Boot
    const queryParamsIds = residentesSeleccionados.map(r => `residentesIds=${r.id}`).join('&');
    const urlEndpoint = `${baseUrl}/api/registros-psicologia?empleadoId=${empleadoId}&${queryParamsIds}`;

    const formData = new FormData(document.getElementById('form-psico'));

    // CONSTRUCCIÓN AJUSTADA A TU ENTIDAD RegistroPsicologia.java
    const payloadJson = {
        id: null,
        fecha: null, // El backend le asignará LocalDateTime.now() si va nulo
        empleado: null, // Se asocia en el Service vía empleadoId
        residentes: [], // Se asocian en el Service vía residentesIds
        tipoRegistro: formData.get('tipoRegistro'),
        categoriaActividad: formData.get('categoriaActividad'),
        descripcion: formData.get('descripcion')
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

        if (!respuesta.ok) throw new Error(`Error en persistencia (Código: ${respuesta.status})`);

        alert(`¡Éxito! Registro de psicología guardado para ${residentesSeleccionados.length} residente(s).`);

        // Reset de UI y lote
        document.getElementById('form-psico').reset();
        residentesSeleccionados = [];
        document.getElementById('contador-seleccionados').innerText = '0 seleccionados';

        document.getElementById('btn-guardar-psico').setAttribute('disabled', 'true');
        document.getElementById('btn-guardar-psico').classList.add('btn-disabled');

        document.getElementById('btn-ver-historial').setAttribute('disabled', 'true');
        document.getElementById('btn-ver-historial').className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";

        obtenerResidentesDesdeApi();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar en el servidor: ${error.message}`);
    }
}

// Consume /api/registros-psicologia/residente/{residenteId}
async function consultarHistorialPsico() {
    const panel = document.getElementById('panel-historial-psico');
    const contenedor = document.getElementById('contenedor-linea-vida');
    const residente = residentesSeleccionados[0];

    if (!residente) return;

    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
        const nodoNombre = document.querySelector('.id-nombre-historial');
        if (nodoNombre) nodoNombre.innerText = `Evolutivos de ${residente.nombre} ${residente.apellidos}`;

        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Recuperando diario clínico...</p>`;

        try {
            const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

            const respuesta = await fetch(`${baseUrl}/api/registros-psicologia/residente/${residente.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!respuesta.ok) throw new Error('Fallo al obtener el historial clínico');
            const informes = await respuesta.json();
            contenedor.innerHTML = '';

            if (informes.length === 0) {
                contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan evolutivos del área de psicología.</p>`;
                return;
            }

            informes.forEach(inf => {
                let fechaFormateada = 'N/A';
                if (inf.fecha) {
                    const partes = inf.fecha.split('T');
                    if (partes[0]) {
                        const subPartes = partes[0].split('-');
                        fechaFormateada = `${subPartes[2]}/${subPartes[1]}/${subPartes[0]}`;
                    }
                }

                const facultativo = inf.empleado ? `${inf.empleado.nombre} ${inf.empleado.apellidos}` : 'Psicólogo/a';

                const tarjetaItem = document.createElement('div');
                tarjetaItem.className = "bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-1.5 shadow-sm";
                tarjetaItem.innerHTML = `
                    <div class="flex justify-between items-center text-[10px] font-bold">
                        <span class="text-sky-600 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded uppercase tracking-wider">${inf.tipoRegistro || 'INTERVENCIÓN'}</span>
                        <span class="text-slate-400 bg-slate-50 border px-1.5 py-0.5 rounded">${inf.categoriaActividad || 'GENERAL'}</span>
                        <span class="text-slate-400 font-medium">${fechaFormateada}</span>
                    </div>
                    <p class="text-xs text-slate-700 leading-relaxed font-medium mt-0.5 select-text bg-slate-50/50 p-2 rounded border border-dashed">${inf.descripcion}</p>
                    <span class="text-[9px] text-slate-400 text-right font-medium block">Facultativo: ${facultativo}</span>
                `;
                contenedor.appendChild(tarjetaItem);
            });

        } catch (error) {
            console.error(error);
            contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error de enlace con el repositorio clínico.</p>`;
        }
    }
}

function inicializarSelectsConEnums() {
    const selectTipo = document.getElementById('select-tipo-registro');
    if (selectTipo) {
        selectTipo.innerHTML = `
            <option value="INDIVIDUAL" selected>🎯 SESIÓN INDIVIDUAL</option>
            <option value="TALLER_GRUPAL">👥 TALLER / INTERVENCION GRUPAL</option>
            <option value="CONDUCTA">⚠️ PROTOCOLO DE CONDUCTA</option>
        `;
    }

    const selectCat = document.getElementById('select-categoria');
    if (selectCat) {
        selectCat.innerHTML = `
            <option value="ESTIMULACION_COGNITIVA" selected>🧩 ESTIMULACIÓN COGNITIVA</option>
            <option value="ORIENTACIO_REALIDAD">🧭 ORIENTACIÓN A LA REALIDAD</option>
            <option value="APOYO_EMOCIONAL">❤️ APOYO EMOCIONAL</option>
            <option value="REMINISCENCIA">⏳ TERAPIA DE REMINISCENCIA</option>
            <option value="AGITACION_PSICOMOTRIZ">⚡ AGITACIÓN PSICOMOTRIZ</option>
            <option value="AGRESIVIDAD">💥 GESTIÓN DE AGRESIVIDAD</option>
            <option value="DESORIENTACION">🌀 crisis de DESORIENTACIÓN</option>
            <option value="APATIA_SEVERA">🥀 APATÍA SEVERA / AISLAMIENTO</option>
        `;
    }
}