// Lógica de Gestión del Protocolo de Caídas (Garantía de Sincronización de Enums)
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth && !window.Auth.checkSession()) return;

    document.getElementById('form-caidas').addEventListener('submit', guardarRegistroCaida);
    document.getElementById('btn-ver-historial').addEventListener('click', consultarHistorialCaidas);

    inicializarSelectsConEnums();
    obtenerResidentesDesdeApi();
});

let residentesSeleccionados = [];

// Obtiene la lista unificada de residentes
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
        grid.innerHTML = `<p class="col-span-full text-center text-xs text-red-500 font-medium py-4">Error de red al instanciar residentes: ${error.message}</p>`;
    }
}

// Mapeo singular estricto de un único afectado
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

    document.getElementById('panel-historial-caidas').classList.add('hidden');
    const totalSeleccionados = residentesSeleccionados.length;
    document.getElementById('contador-seleccionados').innerText = `${totalSeleccionados} seleccionado`;

    const btnGuardar = document.getElementById('btn-guardar-caida');
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
        btnHistorial.className = "w-full bg-white border border-red-200 hover:border-red-500 hover:bg-red-50/10 text-red-600 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse";
    } else {
        btnHistorial.setAttribute('disabled', 'true');
        btnHistorial.className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";
    }
}

// Envía el JSON sanitizado al endpoint POST mapeado con RequestParam
async function guardarRegistroCaida(evento) {
    evento.preventDefault();
    if (residentesSeleccionados.length === 0) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;
    const residenteId = residentesSeleccionados[0].id;
    const urlEndpoint = `${baseUrl}/api/caidas?empleadoId=${empleadoId}&residenteId=${residenteId}`;

    const formData = new FormData(document.getElementById('form-caidas'));

    // Captura dinámica de los checkboxes de consecuencias seleccionados
    const consecuenciasMarcadas = [];
    document.querySelectorAll('input[name="consecuencias"]:checked').forEach(cb => {
        consecuenciasMarcadas.push(cb.value);
    });

    // Construcción limpia adaptada a tu modelo Caidas.java
    const payloadJson = {
        id: null,
        residente: null, // Asignado por el Service
        fechaHora: null, // Asignado por el Service si es null
        lugar: formData.get('lugar'),
        actividad: formData.get('actividad'),
        descripcionCaida: formData.get('descripcionCaida'),
        calzado: formData.get('calzado'),
        consciente: document.getElementById('check-consciente').checked,
        consecuencias: consecuenciasMarcadas, // Se mapea como un Set en el backend
        acciones: formData.get('acciones'),
        empleado: null  // Asignado por el Service
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

        alert(`¡Éxito! Registro de caída guardado correctamente en el expediente.`);

        document.getElementById('form-caidas').reset();
        residentesSeleccionados = [];
        document.getElementById('contador-seleccionados').innerText = '0 seleccionados';

        document.getElementById('btn-guardar-caida').setAttribute('disabled', 'true');
        document.getElementById('btn-guardar-caida').classList.add('btn-disabled');

        document.getElementById('btn-ver-historial').setAttribute('disabled', 'true');
        document.getElementById('btn-ver-historial').className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";

        obtenerResidentesDesdeApi();

    } catch (error) {
        console.error(error);
        alert(`Error al registrar el incidente: ${error.message}`);
    }
}

// Recupera todas las caídas, aunque tu Service tiene "findAllByOrderByFechaHoraDesc", 
// filtraremos en el Front para pintar la línea de vida exclusiva del residente seleccionado
async function consultarHistorialCaidas() {
    const panel = document.getElementById('panel-historial-caidas');
    const contenedor = document.getElementById('contenedor-linea-vida');
    const residente = residentesSeleccionados[0];

    if (!residente) return;
    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
        const nodoNombre = document.querySelector('.id-nombre-historial');
        
        if (nodoNombre) nodoNombre.innerText = `Historial de Incidentes: ${residente.nombre}`;
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Buscando registros...</p>`;

        try {
            const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';

            // Consumimos la lista total ordenada de forma decreciente
            const respuesta = await fetch(`${baseUrl}/api/caidas`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!respuesta.ok) throw new Error('Error al procesar la lectura del histórico');
            const todasLasCaidas = await respuesta.json();
            contenedor.innerHTML = '';

            // Filtramos las caídas que pertenecen a este residente específico
            const caidasResidente = todasLasCaidas.filter(c => c.residente && c.residente.id === residente.id);

            if (caidasResidente.length === 0) {
                contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan partes de caídas previos en el expediente.</p>`;
                return;
            }

            caidasResidente.forEach(c => {
                let fFormateada = 'N/A';
                if (c.fechaHora) {
                    const partes = c.fechaHora.split('T');
                    if (partes[0]) {
                        const h = partes[1] ? ` a las ${partes[1].substring(0, 5)}h` : '';
                        fFormateada = partes[0].split('-').reverse().join('/') + h;
                    }
                }

                // Unir en un string los badges de consecuencias utilizando el array del backend
                const badgeConsecuencias = c.consecuencias && c.consecuencias.length > 0
                    ? c.consecuencias.map(cons => `<span class="bg-red-50 text-red-700 border border-red-100 px-1 py-0.5 rounded text-[9px] uppercase font-bold">${cons}</span>`).join(' ')
                    : '<span class="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 py-0.5 rounded text-[9px] uppercase font-bold">SIN LESIONES APARENTES</span>';

                const firmante = c.empleado ? `${c.empleado.nombre} ${c.empleado.apellidos}` : 'Personal de Turno';

                const item = document.createElement('div');
                item.className = "bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-1.5 shadow-sm border-l-4 border-l-red-500";
                item.innerHTML = `
                    <div class="flex justify-between items-center text-[10px] font-bold text-slate-400">
                        <span class="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">📍 ${c.lugar || 'LUGAR NO ESPECIFICADO'}</span>
                        <span>${fFormateada}</span>
                    </div>
                    <div class="text-[10px] font-semibold text-slate-500">
                        🏃 Actividad: ${c.actividad || 'N/A'} • 👟 Calzado: ${c.calzado || 'N/A'} • 👁️ Consciente: ${c.consciente ? 'SÍ' : 'NO'}
                    </div>
                    <p class="text-xs text-slate-700 font-medium bg-slate-50/50 p-2 rounded border border-dashed select-text">
                        <strong>Mecánica:</strong> ${c.descripcionCaida}<br>
                        <strong class="block mt-1 text-red-600">Acciones inmediatas:</strong> ${c.acciones}
                    </p>
                    <div class="flex flex-wrap gap-1 items-center mt-0.5">
                        ${badgeConsecuencias}
                    </div>
                    <span class="text-[9px] text-slate-400 text-right font-medium block">Supervisor: ${firmante}</span>
                `;
                contenedor.appendChild(item);
            });

        } catch (error) {
            console.error(error);
            contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error al sincronizar con el repositorio del servidor.</p>`;
        }
    }
}

// Inicializa las opciones respetando fielmente las constantes mayúsculas de tus Enums
function inicializarSelectsConEnums() {
    const selectCalzado = document.getElementById('select-calzado');
    if (selectCalzado) {
        selectCalzado.innerHTML = `
            <option value="ZAPATILLAS" selected>👟 ZAPATILLAS DE ESTAR POR CASA</option>
            <option value="ZAPATOS">👞 ZAPATOS DE CALLE / ORTOPÉDICOS</option>
            <option value="DESCALZO">👣 DESCALZO / EN CALCETINES</option>
        `;
    }

    const contenedorCons = document.getElementById('contenedor-consecuencias');
    if (contenedorCons) {
        // Mapeamos los keys exactos de tu ConsecuenciaCaida.java de Spring Boot
        const consecuencias = [
            { value: "SIN_LESION", label: "Sin lesiones aparentes" },
            { value: "EROSION", label: "Erosión / Raspadura" },
            { value: "HEMATOMA", label: "Hematoma / Contusión leve" },
            { value: "HERIDA_CON_SUTURA", label: "Herida que requiere sutura" },
            { value: "ESGUINCE_LUXACION", label: "Esguince o luxación" },
            { value: "FRACTURA_CADERA", label: "Fractura de cadera" },
            { value: "FRACTURA_OTRA", label: "Otras fracturas (muñeca, húmero, etc.)" },
            { value: "TRAUMA_CRANEAL", label: "Traumatismo craneoencefálico" },
            { value: "DOLOR_PERSISTENTE", label: "Dolor persistente sin lesión" },
            { value: "FALLECIMIENTO", label: "Fallecimiento" },
            { value: "OTRA", label: "Otra consecuencia" }
        ];

        contenedorCons.innerHTML = consecuencias.map(c => `
            <label class="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg text-xs font-medium text-slate-700 cursor-pointer select-none hover:bg-slate-100/50 transition-colors">
                <input type="checkbox" name="consecuencias" value="${c.value}" class="w-3.5 h-3.5 text-red-600 border-slate-300 rounded focus:ring-red-500">
                <span>${c.label}</span>
            </label>
        `).join('');
    }
}