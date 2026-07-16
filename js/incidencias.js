alert("¡El archivo JS está cargado correctamente!");

// Lógica de Gestión del Libro General de Incidencias (Versión Corregida)
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth && !window.Auth.checkSession()) return;

    document.getElementById('form-incidencias').addEventListener('submit', guardarIncidencia);
    document.getElementById('btn-ver-historial').addEventListener('click', consultarHistorialIncidencias);

    // Ejecutamos la inicialización de Enums
    inicializarSelectsConEnums();

    // Ejecutamos la carga de residentes
    obtenerResidentesDesdeApi();
});

let residentesSeleccionados = [];

// Carga la lista inicial de residentes activos
async function obtenerResidentesDesdeApi() {
    const grid = document.getElementById('grid-residentes');
    if (!grid) return;

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
            grid.innerHTML = `<p class="col-span-full text-center text-xs text-slate-400 italic py-4">No constan residentes activos.</p>`;
            return;
        }

        residentes.forEach(res => {
            const iniciales = `${res.nombre[0] || ''}${res.apellidos[0] || ''}`.toUpperCase();
            const tarjeta = document.createElement('div');
            tarjeta.className = "card-premium p-4 cursor-pointer flex items-center gap-4 bg-white border border-slate-200 select-none shadow-sm w-full";
            tarjeta.innerHTML = `
                <div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-sm transition-colors id-avatar shrink-0">
                    ${iniciales}
                </div>
                <div class="text-left truncate w-full">
                    <span class="font-bold text-xs text-slate-700 block truncate">${res.nombre} ${res.apellidos}</span>
                    <span class="text-[10px] text-slate-400 font-medium block">Habitación: ${res.habitacion || 'N/A'}</span>
                </div>
            `;
            tarjeta.addEventListener('click', () => gestionarSeleccionTarjeta(tarjeta, res));
            grid.appendChild(tarjeta);
        });
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="col-span-full text-center text-xs text-red-500 font-medium py-4">Error de red: ${error.message}</p>`;
    }
}

// Control singular del residente asignado al suceso (Efecto RadioButton)
function gestionarSeleccionTarjeta(elemento, residente) {
    const idx = residentesSeleccionados.findIndex(r => r.id === residente.id);

    document.querySelectorAll('#grid-residentes .card-premium').forEach(tarjeta => {
        tarjeta.classList.remove('card-residente-seleccionado');
        const av = tarjeta.querySelector('.id-avatar');
        if (av) {
            av.classList.remove('bg-sky-600', 'text-white');
            av.classList.add('bg-slate-100', 'text-slate-600');
        }
    });

    if (idx > -1) {
        residentesSeleccionados = [];
    } else {
        residentesSeleccionados = [residente];
        elemento.classList.add('card-residente-seleccionado');
        const avatar = elemento.querySelector('.id-avatar');
        if (avatar) {
            avatar.classList.remove('bg-slate-100', 'text-slate-600');
            avatar.classList.add('bg-sky-600', 'text-white');
        }
    }

    document.getElementById('panel-historial-incidencias').classList.add('hidden');
    const totalSeleccionados = residentesSeleccionados.length;
    document.getElementById('contador-seleccionados').innerText = `${totalSeleccionados} seleccionado`;

    const btnGuardar = document.getElementById('btn-guardar-incidencia');
    if (totalSeleccionados === 1) {
        btnGuardar.removeAttribute('disabled');
        btnGuardar.classList.remove('btn-disabled');
    } else {
        btnGuardar.setAttribute('disabled', 'true');
        btnGuardar.classList.add('btn-disabled');
    }

    const btnHistorial = document.getElementById('btn-ver-historial');
    if (totalSeleccionados === 1) {
        btnHistorial.removeAttribute('disabled');
        btnHistorial.className = "w-full bg-white border border-orange-200 hover:border-orange-500 hover:bg-orange-50/10 text-orange-600 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse";
    } else {
        btnHistorial.setAttribute('disabled', 'true');
        btnHistorial.className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";
    }
}

// Envía el JSON unificado al endpoint POST de /api/incidencias
async function guardarIncidencia(evento) {
    evento.preventDefault();
    if (residentesSeleccionados.length === 0) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;
    const urlEndpoint = `${baseUrl}/api/incidencias`;

    const formData = new FormData(document.getElementById('form-incidencias'));

    const payloadJson = {
        id: null,
        residente: { id: residentesSeleccionados[0].id },
        fechaHora: null,
        tipo: formData.get('tipo'),
        descripcion: formData.get('descripcion'),
        empleado: { id: parseInt(empleadoId) }
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

        if (!respuesta.ok) throw new Error(`Fallo de persistencia (Status: ${respuesta.status})`);

        alert(`¡Éxito! Incidencia guardada correctamente en el parte general.`);

        document.getElementById('form-incidencias').reset();
        residentesSeleccionados = [];
        document.getElementById('contador-seleccionados').innerText = '0 seleccionados';

        document.getElementById('btn-guardar-incidencia').setAttribute('disabled', 'true');
        document.getElementById('btn-guardar-incidencia').classList.add('btn-disabled');

        document.getElementById('btn-ver-historial').setAttribute('disabled', 'true');
        document.getElementById('btn-ver-historial').className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";

        obtenerResidentesDesdeApi();

    } catch (error) {
        console.error(error);
        alert(`Error al registrar la incidencia: ${error.message}`);
    }
}

// Consulta el historial filtrando por ID
async function consultarHistorialIncidencias() {
    const panel = document.getElementById('panel-historial-incidencias');
    const contenedor = document.getElementById('contenedor-linea-vida');
    const residente = residentesSeleccionados[0];

    if (!residente) return;
    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
        const nodoNombre = document.querySelector('.id-nombre-historial');
        if (nodoNombre) nodoNombre.innerText = `Historial de Eventos: ${residente.nombre}`;
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Consultando libro de bitácora...</p>`;

        try {
            const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
            const respuesta = await fetch(`${baseUrl}/api/incidencias/residente/${residente.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!respuesta.ok) throw new Error('Error al procesar el histórico clínico');
            const listaIncidencias = await respuesta.json();
            contenedor.innerHTML = '';

            if (listaIncidencias.length === 0) {
                contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan incidencias registradas para este residente.</p>`;
                return;
            }

            listaIncidencias.forEach(inc => {
                let fFormateada = 'N/A';
                if (inc.fechaHora) {
                    const partes = inc.fechaHora.split('T');
                    if (partes[0]) {
                        const h = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                        fFormateada = partes[0].split('-').reverse().join('/') + h;
                    }
                }

                const firmante = inc.empleado ? `${inc.empleado.nombre} ${inc.empleado.apellidos}` : 'Personal de Turno';

                let colorBadge = 'text-amber-700 bg-amber-50 border-amber-100';
                if (inc.tipo === 'URGENCIA_MEDICA') colorBadge = 'text-red-700 bg-red-50 border-red-100';
                if (inc.tipo === 'VISITA' || inc.tipo === 'SALIDA_FAMILIAR') colorBadge = 'text-emerald-700 bg-emerald-50 border-emerald-100';

                const item = document.createElement('div');
                item.className = "bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-1.5 shadow-sm border-l-4 border-l-orange-500";
                item.innerHTML = `
                    <div class="flex justify-between items-center text-[10px] font-bold">
                        <span class="border px-1.5 py-0.5 rounded uppercase tracking-wider ${colorBadge}">${inc.tipo || 'INCIDENCIA'}</span>
                        <span class="text-slate-400 font-medium">${fFormateada}</span>
                    </div>
                    <p class="text-xs text-slate-700 font-medium bg-slate-50/50 p-2 rounded border border-dashed select-text whitespace-pre-line">${inc.descripcion}</p>
                    <span class="text-[9px] text-slate-400 text-right font-medium block">Registrado por: ${firmante}</span>
                `;
                contenedor.appendChild(item);
            });

        } catch (error) {
            console.error(error);
            contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error al comunicar con el servidor.</p>`;
        }
    }
}

// Inyección limpia y corregida de Enums de Incidencias.java
function inicializarSelectsConEnums() {
    const selectTipo = document.getElementById('select-tipo');
    if (selectTipo) {
        selectTipo.innerHTML = `
            <option value="CAIDA" selected>⚠️ CAÍDA / ACCIDENTE</option>
            <option value="URGENCIA_MEDICA">🚨 URGENCIA MÉDICA / CONSTANTES ALTERADAS</option>
            <option value="CAMBIO_EMOCIONAL">🧠 CAMBIO EMOCIONAL / CONDUCTA ANÓMALA</option>
            <option value="SALIDA_FAMILIAR">🚗 SALIDA CON FAMILIARES</option>
            <option value="VISITA">👥 VISITA INSTITUCIONAL / EXTERNA</option>
        `;
    }
}