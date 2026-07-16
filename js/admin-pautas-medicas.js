// Lógica de Gestión de Pautas Médicas y Tratamientos
let listaGlobalResidentes = [];
let residenteSeleccionadoId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Seguridad y Rol
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Buscador en Vivo
    document.getElementById('buscador-pautas-residente').addEventListener('input', filtrarResidentesPautas);

    // Formulario de Nueva Prescripción (Eventos)
    const btnNuevaPauta = document.getElementById('btn-nueva-pauta');
    const btnCancelarForm = document.getElementById('btn-cancelar-formulario');
    const formContenedor = document.getElementById('contenedor-formulario-pauta');
    const form = document.getElementById('form-registrar-pauta');

    btnNuevaPauta.addEventListener('click', () => {
        form.reset();
        // Seteamos la fecha y hora por defecto en el input al momento actual
        const ahora = new Date();
        ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
        document.getElementById('pauta-fecha-hora').value = ahora.toISOString().slice(0, 16);
        formContenedor.classList.remove('hidden');
    });

    btnCancelarForm.addEventListener('click', () => {
        formContenedor.classList.add('hidden');
    });

    form.addEventListener('submit', registrarNuevaPautaServidor);

    // Carga de Residentes Inicial
    cargarResidentesParaPautas();
});

// Obtiene los residentes de alta
async function cargarResidentesParaPautas() {
    const contenedor = document.getElementById('lista-pautas-residentes');
    const txtContador = document.getElementById('contador-residentes');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Sincronizando ficheros...</p>`;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo acceder al listado de residentes.');
        listaGlobalResidentes = await respuesta.json();

        txtContador.innerText = `${listaGlobalResidentes.length} expedientes`;
        renderizarListaResidentesPautas(listaGlobalResidentes);

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error: ${error.message}</p>`;
    }
}

// Renderiza los residentes en la barra lateral
function renderizarListaResidentesPautas(lista) {
    const contenedor = document.getElementById('lista-pautas-residentes');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Ningún residente coincide.</p>`;
        return;
    }

    lista.forEach(res => {
        const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
        const seleccionado = residenteSeleccionadoId === res.id;

        const item = document.createElement('div');
        item.className = `p-3 cursor-pointer flex items-center justify-between rounded-xl bg-white border border-slate-200 select-none shadow-sm hover:border-indigo-500 hover:bg-indigo-50/5 transition-all ${seleccionado ? 'border-indigo-500 bg-indigo-50/10 shadow-md ring-1 ring-indigo-200' : ''
            }`;

        item.innerHTML = `
            <div class="flex items-center gap-3 truncate">
                <div class="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                    ${iniciales}
                </div>
                <div class="truncate text-left">
                    <span class="font-bold text-xs text-slate-700 block truncate">${res.nombre} ${res.apellidos}</span>
                    <span class="text-[10px] text-slate-400 block font-medium">Hab: ${res.habitacion || 'N/A'} • DNI: ${res.dni || 'N/A'}</span>
                </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 px-2">&rarr;</span>
        `;

        item.addEventListener('click', () => seleccionarResidente(res));
        contenedor.appendChild(item);
    });
}

// Filtro rápido en memoria local
function filtrarResidentesPautas(e) {
    const termino = e.target.value.toLowerCase().trim();
    if (!termino) {
        renderizarListaResidentesPautas(listaGlobalResidentes);
        return;
    }

    const filtrados = listaGlobalResidentes.filter(res =>
        (res.nombre && res.nombre.toLowerCase().includes(termino)) ||
        (res.apellidos && res.apellidos.toLowerCase().includes(termino)) ||
        (res.habitacion && res.habitacion.toLowerCase().includes(termino))
    );

    renderizarListaResidentesPautas(filtrados);
}

// Evento al pulsar en un residente
async function seleccionarResidente(residente) {
    residenteSeleccionadoId = residente.id;

    // Pintar selección activa
    renderizarListaResidentesPautas(listaGlobalResidentes);

    // Ocultar panel vacío y mostrar panel activo
    document.getElementById('panel-pautas-vacio').classList.add('hidden');
    document.getElementById('panel-pautas-activo').classList.remove('hidden');
    document.getElementById('contenedor-formulario-pauta').classList.add('hidden'); // Ocultar formulario de pautas pasadas

    // Poblar metadatos del residente
    document.getElementById('residente-nombre-pautas').innerText = `💊 TRATAMIENTO DE: ${residente.nombre} ${residente.apellidos}`;
    document.getElementById('residente-meta-pautas').innerText = `Habitación: ${residente.habitacion || 'N/A'} • TIS: ${residente.tis || 'N/A'} • DNI: ${residente.dni || 'N/A'}`;

    await cargarPautasDelResidente();
}

// Trae las pautas médicas del residente seleccionado
async function cargarPautasDelResidente() {
    const contenedor = document.getElementById('contenedor-tratamientos-listado');
    if (!contenedor) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-6">Obteniendo tratamientos farmacológicos...</p>`;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/pautas-medicas/residente/${residenteSeleccionadoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }); // Mapea el GET /residente/{residenteId}[cite: 30]

        if (!respuesta.ok) throw new Error('No se pudo sincronizar el archivo de pautas médicas.');
        const pautas = await respuesta.json(); // Trae las pautas pautadas[cite: 30]

        contenedor.innerHTML = '';

        if (pautas.length === 0) {
            contenedor.innerHTML = `
                <div class="bg-white border border-slate-200 p-8 rounded-2xl text-center text-slate-400 italic text-xs shadow-sm">
                    ⚠️ No constan pautas médicas ni fármacos activos asignados para este residente.
                </div>
            `;
            return;
        }

        pautas.forEach(pauta => {
            let fechaFormateada = 'N/A';
            if (pauta.fechaHora) {
                const partes = pauta.fechaHora.split('T');
                if (partes[0]) {
                    const hora = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                    fechaFormateada = partes[0].split('-').reverse().join('/') + hora;
                }
            }

            const tarjeta = document.createElement('div');
            tarjeta.className = "bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm border-l-4 border-l-indigo-500 hover:shadow-md transition-all";

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span class="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">📦 FÁRMACO ACTIVADO</span>
                    <span>Pautado desde: ${fechaFormateada}</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                        <span class="text-[9px] font-bold text-slate-400 block uppercase">Medicamento / Principio Activo</span>
                        <span class="text-xs font-bold text-slate-700 block">${pauta.medicamento || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="text-[9px] font-bold text-slate-400 block uppercase">Dosis y Pauta</span>
                        <span class="text-xs font-semibold text-indigo-600 block">${pauta.dosis || 'N/A'}</span>
                    </div>
                </div>

                <div class="text-[11px] text-slate-500 font-medium">
                    ⏱️ <strong class="text-slate-600">Duración prescrita:</strong> ${pauta.duracion || 'Crónico / Indefinido'}
                </div>

                ${pauta.observaciones ? `
                    <div class="text-[10px] text-slate-500 italic bg-slate-50 px-2.5 py-1.5 rounded-lg border border-dashed leading-relaxed">
                        ⚠️ <strong>Instrucciones:</strong> ${pauta.observaciones}
                    </div>
                ` : ''}

                <div class="flex justify-end pt-2 border-t border-slate-100/60 mt-1">
                    <button onclick="eliminarPautaMedica(${pauta.id})" class="text-[10px] text-red-500 hover:text-red-700 font-bold tracking-tight">
                        🗑️ Retirar / Anular Tratamiento
                    </button>
                </div>
            `;

            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-6">Error al conectar con la base de datos de tratamientos.</p>`;
    }
}

// Envía la orden POST para pautar un medicamento
async function registrarNuevaPautaServidor(e) {
    e.preventDefault();

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    const payload = {
        medicamento: document.getElementById('pauta-medicamento').value,
        dosis: document.getElementById('pauta-dosis').value,
        fechaHora: document.getElementById('pauta-fecha-hora').value,
        duracion: document.getElementById('pauta-duracion').value,
        observaciones: document.getElementById('pauta-observaciones').value
    };

    try {
        const respuesta = await fetch(`${baseUrl}/api/pautas-medicas/residente/${residenteSeleccionadoId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }); // Mapea el POST /residente/{residenteId}[cite: 30]

        if (!respuesta.ok) throw new Error('El servidor rechazó el alta de la pauta médica.');

        document.getElementById('contenedor-formulario-pauta').classList.add('hidden');
        document.getElementById('form-registrar-pauta').reset();

        alert('¡Nueva pauta médica establecida con éxito!');
        await cargarPautasDelResidente();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar la pauta: ${error.message}`);
    }
}

// Envía la orden DELETE para anular el tratamiento
async function eliminarPautaMedica(id) {
    if (!confirm('⚠ ¿Estás totalmente seguro de que deseas anular y eliminar permanentemente esta pauta médica? El residente dejará de tener asignado este fármaco en su plan diario.')) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/pautas-medicas/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }); // Mapea el DELETE /{id}[cite: 30]

        if (!respuesta.ok) throw new Error('El servidor rechazó dar de baja la pauta médica.');

        await cargarPautasDelResidente();

    } catch (error) {
        console.error(error);
        alert(`Error al retirar el tratamiento: ${error.message}`);
    }
}