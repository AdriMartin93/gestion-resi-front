// Lógica de Registro de Medicación Diaria en Cadena
document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de sesión global
    if (window.Auth && !window.Auth.checkSession()) return;

    // 2. Vincular eventos iniciales de la UI
    document.getElementById('btn-iniciar-flujo').addEventListener('click', iniciarFlujoMedicacion);
    document.getElementById('btn-siguiente').addEventListener('click', siguienteResidente);

    // 3. Solicitar la lista de residentes reales a la API
    obtenerResidentesDesdeApi();
});

// Variables globales para el carrusel de reparto
let residentesSeleccionados = [];
let indiceActivo = 0;

// Carga los residentes reales de tu base de datos para pintar las tarjetas
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

        // Renderizar las tarjetas con el estilo premium corporativo
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

// Controla el marcado visual inmediato con el tono azul/morado de sanidad al hacer clic
function cambiarEstadoTarjeta(elemento, residente) {
    const idx = residentesSeleccionados.findIndex(r => r.id === residente.id);
    const avatar = elemento.querySelector('.id-avatar');

    if (idx > -1) {
        // Deseleccionar
        residentesSeleccionados.splice(idx, 1);
        elemento.classList.remove('bg-indigo-50/60', 'border-indigo-400', 'shadow-md', 'ring-2', 'ring-indigo-200');
        elemento.classList.add('bg-white', 'border-slate-200');
        if (avatar) {
            avatar.classList.remove('bg-indigo-600', 'text-white');
            avatar.classList.add('bg-slate-100', 'text-slate-600');
        }
    } else {
        // Seleccionar
        residentesSeleccionados.push(residente);
        elemento.classList.remove('bg-white', 'border-slate-200');
        elemento.classList.add('bg-indigo-50/60', 'border-indigo-400', 'shadow-md', 'ring-2', 'ring-indigo-200');
        if (avatar) {
            avatar.classList.remove('bg-slate-100', 'text-slate-600');
            avatar.classList.add('bg-indigo-600', 'text-white');
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

// Oculta las tarjetas y abre el carrusel de medicación
function iniciarFlujoMedicacion() {
    indiceActivo = 0;
    document.getElementById('seccion-seleccion').classList.add('hidden');
    document.getElementById('seccion-formularios').classList.remove('hidden');
    establecerResidenteActivo();
}

// Actualiza la barra superior y carga la pauta médica real del residente activo
async function establecerResidenteActivo() {
    const residente = residentesSeleccionados[indiceActivo];
    document.getElementById('info-progreso').innerText = `Residente ${indiceActivo + 1} de ${residentesSeleccionados.length}`;
    document.getElementById('nombre-residente-activo').innerText = `${residente.nombre} ${residente.apellidos}`;

    const contenedorMedicamentos = document.getElementById('lista-medicamentos-pautados');
    contenedorMedicamentos.innerHTML = `<p class="col-span-full text-center text-xs text-slate-400 italic py-4">Buscando pauta médica de fármacos...</p>`;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

        // Llamada GET a tu PautaMedicaController
        const respuesta = await fetch(`${baseUrl}/api/pautas-medicas/residente/${residente.id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo cargar la pauta médica');
        const pautas = await respuesta.json();
        contenedorMedicamentos.innerHTML = '';

        if (pautas.length === 0) {
            contenedorMedicamentos.innerHTML = `<p class="col-span-full text-center text-sm text-slate-400 italic py-6">Este residente no tiene medicamentos pautados.</p>`;
            return;
        }

        // Renderizar dinámicamente las pautas de fármacos interactivas
        pautas.forEach(pauta => {
            const item = document.createElement('div');
            item.id = `pauta-card-${pauta.id}`;
            item.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4 transition-all duration-200";
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-indigo-500"></span> ${pauta.medicamento}
                        </h4>
                        <p class="text-xs font-semibold text-slate-500 mt-0.5">Dosis: <span class="text-slate-700">${pauta.dosis}</span></p>
                        ${pauta.observaciones ? `<p class="text-[11px] text-amber-600 bg-amber-50/50 rounded-md p-1.5 mt-2 italic border border-amber-100">Obs: ${pauta.observaciones}</p>` : ''}
                    </div>
                    <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">${pauta.duracion || 'Turno'}</span>
                </div>
                
                <div class="flex items-center gap-2 border-t border-slate-100 pt-3" id="actions-pauta-${pauta.id}">
                    <input type="text" id="obs-${pauta.id}" placeholder="Observaciones de la toma..." class="input-premium py-1.5 text-xs flex-grow bg-slate-50">
                    <button onclick="registrarTomaFármaco(${pauta.id}, 'SI')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors whitespace-nowrap shadow-sm">
                        ✓ Entregado
                    </button>
                    <button onclick="registrarTomaFármaco(${pauta.id}, 'NO')" class="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap shadow-sm" title="Rechazado / No administrado">
                        ✕ No dado
                    </button>
                </div>
            `;
            contenedorMedicamentos.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        contenedorMedicamentos.innerHTML = `<p class="col-span-full text-center text-sm text-red-500 font-medium py-4">Error al conectar con las pautas médicas del servidor.</p>`;
    }
}

// Envía la petición POST directa a tu RegistroMedicacionController
async function registrarTomaFármaco(pautaId, estado) {
    const residente = residentesSeleccionados[indiceActivo];
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;
    const observacionesInput = document.getElementById(`obs-${pautaId}`).value;

    // JSON mapeado con tu entidad e inyectando tu Enum EstadoTarea (SI o NO)
    const payloadJson = {
        estadoTarea: estado,
        observaciones: observacionesInput
    };

    try {
        // Apuntamos al endpoint estructurado de tu controlador de registros
        const respuesta = await fetch(`${baseUrl}/api/medicacion-registros/pauta/${pautaId}/residente/${residente.id}/empleado/${empleadoId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadJson)
        });

        if (!respuesta.ok) throw new Error('No se pudo registrar la toma');

        // Congelar visualmente la tarjeta de la pauta una vez guardada con éxito
        const card = document.getElementById(`pauta-card-${pautaId}`);
        const actions = document.getElementById(`actions-pauta-${pautaId}`);
        if (card && actions) {
            card.classList.add('opacity-40', 'bg-slate-50', 'pointer-events-none');
            actions.innerHTML = `
                <span class="text-xs font-bold ${estado === 'SI' ? 'text-emerald-600' : 'text-rose-600'} flex items-center gap-1 py-1">
                    ${estado === 'SI' ? '✓ Registrado como Entregado' : '✕ Registrado como No Administrado'}
                </span>
            `;
        }
    } catch (error) {
        console.error(error);
        alert(`Error al registrar el fármaco: ${error.message}`);
    }
}

// Avanza al siguiente residente del lote seleccionado
function siguienteResidente() {
    if (indiceActivo < residentesSeleccionados.length - 1) {
        indiceActivo++;
        establecerResidenteActivo();
    } else {
        alert('¡Excelente! Has completado el reparto de medicación de todo el lote.');
        // Resetear para el siguiente lote
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