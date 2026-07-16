// Lógica de Auditoría y Control de Historiales Médicos
let listaGlobalResidentes = [];
let residenteSeleccionadoId = null;
let historialActivo = null; // Guardará el historial actual cargado en memoria

document.addEventListener('DOMContentLoaded', () => {
    // 🔒 Control de Rol Institucional
    if (window.Auth && !window.Auth.checkSession()) return;
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Panel exclusivo de Dirección General.');
        window.location.href = 'menu.html';
        return;
    }

    // Buscador en Vivo de Residentes
    document.getElementById('buscador-clinico-residente').addEventListener('input', filtrarResidentesClinica);

    // Envío del Formulario Completo (PUT)
    document.getElementById('form-historial-clinico').addEventListener('submit', actualizarHistorialCompleto);

    // Añadir Alergia de Forma Dinámica (POST)
    document.getElementById('btn-anadir-alergia').addEventListener('click', procesarAnadirAlergia);

    // Cargar Lista Inicial
    cargarResidentesParaClinica();
});

// Carga el listado de residentes de alta en la columna izquierda
async function cargarResidentesParaClinica() {
    const contenedor = document.getElementById('lista-clinico-residentes');
    const txtContador = document.getElementById('contador-residentes');
    if (!contenedor || !txtContador) return;

    contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Cargando residentes...</p>`;

    try {
        const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
        const respuesta = await fetch(`${baseUrl}/api/residentes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo leer el listado de residentes.');
        listaGlobalResidentes = await respuesta.json();

        txtContador.innerText = `${listaGlobalResidentes.length} expedientes`;
        renderizarFichasResidentesClinica(listaGlobalResidentes);

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error de red: ${error.message}</p>`;
    }
}

// Renderiza las tarjetas reducidas en la barra lateral
function renderizarFichasResidentesClinica(lista) {
    const contenedor = document.getElementById('lista-clinico-residentes');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Ningún expediente coincide.</p>`;
        return;
    }

    lista.forEach(res => {
        const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
        const seleccionado = residenteSeleccionadoId === res.id;

        const item = document.createElement('div');
        item.className = `p-3 cursor-pointer flex items-center justify-between rounded-xl bg-white border border-slate-200 select-none shadow-sm hover:border-cyan-500 hover:bg-cyan-50/5 transition-all ${seleccionado ? 'border-cyan-500 bg-cyan-50/10 shadow-md ring-1 ring-cyan-200' : ''
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

// Filtra la colección de residentes en memoria local
function filtrarResidentesClinica(e) {
    const termino = e.target.value.toLowerCase().trim();
    if (!termino) {
        renderizarFichasResidentesClinica(listaGlobalResidentes);
        return;
    }

    const filtrados = listaGlobalResidentes.filter(res =>
        (res.nombre && res.nombre.toLowerCase().includes(termino)) ||
        (res.apellidos && res.apellidos.toLowerCase().includes(termino)) ||
        (res.habitacion && res.habitacion.toLowerCase().includes(termino)) ||
        (res.dni && res.dni.toLowerCase().includes(termino))
    );

    renderizarFichasResidentesClinica(filtrados);
}

// Selecciona un residente y carga su historial clínico asociado
async function seleccionarResidente(residente) {
    residenteSeleccionadoId = residente.id;

    // Forzar re-pintado de la barra lateral para la selección visual activa
    renderizarFichasResidentesClinica(listaGlobalResidentes);

    // Ocultar panel vacío y mostrar formulario de historial
    document.getElementById('panel-clinico-vacio').classList.add('hidden');
    document.getElementById('expediente-clinico').classList.remove('hidden');

    // Cargar metadatos en cabecera
    document.getElementById('residente-nombre-completo').innerText = `🩺 HISTORIAL DE: ${residente.nombre} ${residente.apellidos}`;
    document.getElementById('residente-meta-datos').innerText = `Habitación: ${residente.habitacion || 'N/A'} • DNI: ${residente.dni || 'N/A'} • TIS: ${residente.tis || 'N/A'}`;

    await cargarHistorialMedicoServidor(residente.id);
}

// Consume el GET por ID de residente
async function cargarHistorialMedicoServidor(residenteId) {
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/historiales-medicos/residente/${residenteId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (respuesta.status === 404) {
            // Si el backend responde 404 porque no existe historial, inicializamos uno nuevo en blanco o le damos formato
            inicializarFichaClinicaVacia();
            return;
        }

        if (!respuesta.ok) throw new Error('No se pudo recuperar el historial clínico.');

        historialActivo = await respuesta.json();
        poblarFormularioHistorial(historialActivo);

    } catch (error) {
        console.error(error);
        alert(`Error al sincronizar historial: ${error.message}`);
    }
}

// Poblar los inputs y pintar el Set de alergias del backend
function poblarFormularioHistorial(historial) {
    document.getElementById('txt-id-historial').innerText = `ID Historial: ${historial.id}`;
    document.getElementById('med-grupo-sanguineo').value = historial.grupoSanguineo || '';
    document.getElementById('med-dieta').value = historial.dieta || '';
    document.getElementById('med-movilidad').value = historial.movilidad || '';
    document.getElementById('med-antecedentes').value = historial.antecedentesClinicos || '';

    pintarBadgesAlergias(historial.alergias);
}

// Prepara la vista en caso de que no tenga historial creado aún (se creará al pulsar guardar)
function inicializarFichaClinicaVacia() {
    historialActivo = null;
    document.getElementById('txt-id-historial').innerText = `ID Historial: NUEVO`;
    document.getElementById('med-grupo-sanguineo').value = '';
    document.getElementById('med-dieta').value = '';
    document.getElementById('med-movilidad').value = '';
    document.getElementById('med-antecedentes').value = '';

    pintarBadgesAlergias([]);
}

// Pinta los badges dinámicos con opción para eliminarlos
function pintarBadgesAlergias(alergiasSet) {
    const contenedor = document.getElementById('contenedor-alergias');
    contenedor.innerHTML = '';

    const alergias = alergiasSet ? Array.from(alergiasSet) : [];

    if (alergias.length === 0) {
        contenedor.innerHTML = `<span class="text-[11px] text-slate-400 italic">No constan alergias conocidas.</span>`;
        return;
    }

    alergias.forEach(alergia => {
        const badge = document.createElement('div');
        badge.className = "flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold tracking-tight";
        badge.innerHTML = `
            <span>⚠️ ${alergia}</span>
            <button type="button" class="text-red-400 hover:text-red-700 font-extrabold text-xs ml-1" onclick="eliminarAlergiaServidor('${alergia}')">
                &times;
            </button>
        `;
        contenedor.appendChild(badge);
    });
}

// Lanza el PUT para guardar/actualizar el expediente completo
async function actualizarHistorialCompleto(e) {
    e.preventDefault();
    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    const payload = {
        grupoSanguineo: document.getElementById('med-grupo-sanguineo').value,
        dieta: document.getElementById('med-dieta').value,
        movilidad: document.getElementById('med-movilidad').value,
        antecedentesClinicos: document.getElementById('med-antecedentes').value
    };

    try {
        let respuesta;
        if (historialActivo && historialActivo.id) {
            // Actualización (PUT /{id})
            respuesta = await fetch(`${baseUrl}/api/historiales-medicos/${historialActivo.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } else {
            // Si el residente no tenía historial clínico, realizamos una creación (POST)
            // Vinculando la relación si es necesaria en el backend
            payload.residente = { id: residenteSeleccionadoId };
            respuesta = await fetch(`${baseUrl}/api/historiales-medicos`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        }

        if (!respuesta.ok) throw new Error('El servidor denegó la actualización del historial.');

        alert('¡Historial clínico guardado con éxito!');
        // Recargar el historial médico actualizado
        await cargarHistorialMedicoServidor(residenteSeleccionadoId);

    } catch (error) {
        console.error(error);
        alert(`Error al procesar la actualización: ${error.message}`);
    }
}

// Inserta una alergia directamente al set usando el POST de la API
async function procesarAnadirAlergia() {
    const input = document.getElementById('input-nueva-alergia');
    const valor = input.value.trim();
    if (!valor) return;

    if (!historialActivo || !historialActivo.id) {
        alert('Debes inicializar y guardar el historial clínico general del residente antes de añadir alergias específicas.');
        return;
    }

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/historiales-medicos/${historialActivo.id}/alergias?nuevaAlergia=${encodeURIComponent(valor)}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo añadir la alergia al expediente.');

        input.value = '';
        // Recargar los datos del expediente para re-pintar
        await cargarHistorialMedicoServidor(residenteSeleccionadoId);

    } catch (error) {
        console.error(error);
        alert(`Error al añadir alergia: ${error.message}`);
    }
}

// Elimina una alergia específica usando la llamada DELETE mapeada en el controller
async function eliminarAlergiaServidor(alergia) {
    if (!confirm(`¿Deseas retirar la alergia a "${alergia}" de la ficha médica de este residente?`)) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const token = localStorage.getItem('resi_token');

    try {
        const respuesta = await fetch(`${baseUrl}/api/historiales-medicos/${historialActivo.id}/alergias?alergiaABorrar=${encodeURIComponent(alergia)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error('No se pudo procesar la baja de la alergia.');

        // Recargar los datos del expediente para re-pintar
        await cargarHistorialMedicoServidor(residenteSeleccionadoId);

    } catch (error) {
        console.error(error);
        alert(`Error al borrar la alergia: ${error.message}`);
    }
}