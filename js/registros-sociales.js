
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth && !window.Auth.checkSession()) return;

    document.getElementById('form-social').addEventListener('submit', guardarRegistroSocial);
    document.getElementById('btn-ver-historial').addEventListener('click', consultarHistorialSocial);

   
    document.getElementById('select-categoria').addEventListener('change', evaluarFormularioDinamico);

    inicializarSelectsConEnums();
    obtenerResidentesDesdeApi();
});

let residentesSeleccionados = [];


function evaluarFormularioDinamico() {
    const categoria = document.getElementById('select-categoria').value;

    const bloqueRecurso = document.getElementById('bloque-recurso');
    const bloqueIntervencion = document.getElementById('bloque-intervencion');
    const bloqueFechas = document.getElementById('bloque-fechas');
    const labelDesc = document.getElementById('label-descripcion');
    const textareaDesc = document.querySelector('textarea[name="gestionesRealizadas"]');

    
    bloqueRecurso.classList.add('hidden');
    bloqueIntervencion.classList.add('hidden');
    bloqueFechas.classList.add('hidden');

    if (categoria === 'RECURSO_PUBLICO') {
        bloqueRecurso.classList.remove('hidden');
        bloqueFechas.classList.remove('hidden');
        labelDesc.innerText = "Gestiones Realizadas / Observaciones sobre el Trámite";
        textareaDesc.placeholder = "Indica la documentación aportada, llamadas a la Delegación de Bienestar Social o pasos siguientes del expediente...";
    } else if (categoria === 'INTERVENCION_FAMILIAR') {
        bloqueIntervencion.classList.remove('hidden');
        labelDesc.innerText = "Resumen de la Intervención Familiar";
        textareaDesc.placeholder = "Detalla los acuerdos alcanzados con la familia, el estado emocional transmitido o demandas solicitadas...";
    } else if (categoria === 'DOCUMENTACION_PERSONAL') {
        labelDesc.innerText = "Gestiones de Documentación Realizadas";
        textareaDesc.placeholder = "Ej: Renovación de DNI caducado, tramitación de duplicado de tarjeta sanitaria (TIS), etc...";
    } else {
        labelDesc.innerText = "Evolución e Integración Social del Residente";
        textareaDesc.placeholder = "Anota cómo ha sido la adaptación al centro, participación en talleres del área social o estado de relaciones institucionales...";
    }
}

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
                    <span class="text-[10px] text-slate-400 font-medium block">Hab. ${res.habitacion || 'N/A'}</span>
                </div>
            `;
            tarjeta.addEventListener('click', () => gestionarSeleccionTarjeta(tarjeta, res));
            grid.appendChild(tarjeta);
        });
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="col-span-full text-center text-xs text-red-500 font-medium py-4">Fallo de red: ${error.message}</p>`;
    }
}

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

    document.getElementById('panel-historial-social').classList.add('hidden');
    const totalSeleccionados = residentesSeleccionados.length;
    document.getElementById('contador-seleccionados').innerText = `${totalSeleccionados} seleccionado`;

    const btnGuardar = document.getElementById('btn-guardar-social');
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
        btnHistorial.className = "w-full bg-white border border-sky-200 hover:border-sky-500 hover:bg-sky-50/10 text-sky-600 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse";
    } else {
        btnHistorial.setAttribute('disabled', 'true');
        btnHistorial.className = "w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs p-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed";
    }
}

async function guardarRegistroSocial(evento) {
    evento.preventDefault();
    if (residentesSeleccionados.length === 0) return;

    const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
    const empleadoId = localStorage.getItem('resi_empleado_id') || 1;
    const residenteId = residentesSeleccionados[0].id;
    const urlEndpoint = `${baseUrl}/api/registros-sociales?residenteId=${residenteId}&empleadoId=${empleadoId}`;

    const formData = new FormData(document.getElementById('form-social'));
    const categoriaActive = formData.get('categoria');

    
    const payloadJson = {
        id: null,
        fechaRegistro: null,
        residente: null,
        trabajadorSocial: null,
        categoria: categoriaActive,
        recursoDetalle: (categoriaActive === 'RECURSO_PUBLICO') ? formData.get('recursoDetalle') : null,
        intervencionDetalle: (categoriaActive === 'INTERVENCION_FAMILIAR') ? formData.get('intervencionDetalle') : null,
        estado: (categoriaActive === 'RECURSO_PUBLICO') ? formData.get('estado') : 'EN_TRAMITE', // Valor basal por defecto si no es recurso público
        gestionesRealizadas: formData.get('gestionesRealizadas'),
        numeroExpediente: (categoriaActive === 'RECURSO_PUBLICO') ? (formData.get('numeroExpediente') || null) : null,
        fechapresentacion: (categoriaActive === 'RECURSO_PUBLICO') ? (formData.get('fechapresentacion') || null) : null,
        fechaVencimiento: (categoriaActive === 'RECURSO_PUBLICO') ? (formData.get('fechaVencimiento') || null) : null,
        alertaSocial: document.getElementById('check-alerta').checked
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

        alert(`¡Éxito! Registro social guardado de forma correcta.`);

        document.getElementById('form-social').reset();
        residentesSeleccionados = [];
        document.getElementById('contador-seleccionados').innerText = '0 seleccionados';

        document.getElementById('btn-guardar-social').setAttribute('disabled', 'true');
        document.getElementById('btn-guardar-social').classList.add('btn-disabled');

        evaluarFormularioDinamico(); 
        obtenerResidentesDesdeApi();

    } catch (error) {
        console.error(error);
        alert(`Error al guardar: ${error.message}`);
    }
}

async function consultarHistorialSocial() {
    const panel = document.getElementById('panel-historial-social');
    const contenedor = document.getElementById('contenedor-linea-vida');
    const residente = residentesSeleccionados[0];

    if (!residente) return;
    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
        const nodoNombre = document.querySelector('.id-nombre-historial');
        if (nodoNombre) nodoNombre.innerText = `Expediente Social de ${residente.nombre}`;
        contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">Buscando informes históricos...</p>`;

        try {
            const baseUrl = window.Config ? window.Config.API_BASE_URL : 'https://gestorresi-backend.onrender.com';
            const respuesta = await fetch(`${baseUrl}/api/registros-sociales/residente/${residente.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('resi_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!respuesta.ok) throw new Error('Error al leer el historial');
            const tramites = await respuesta.json();
            contenedor.innerHTML = '';

            if (tramites.length === 0) {
                contenedor.innerHTML = `<p class="text-center text-xs text-slate-400 italic py-4">No constan evolutivos en su ficha social.</p>`;
                return;
            }

            tramites.forEach(t => {
                let fRegistro = 'N/A';
                if (t.fechaRegistro) {
                    const partes = t.fechaRegistro.split('T');
                    if (partes[0]) fRegistro = partes[0].split('-').reverse().join('/');
                }

                const vtoTexto = t.fechaVencimiento ? `• Vto: ${t.fechaVencimiento.split('-').reverse().join('/')}` : '';
                const expTexto = t.numeroExpediente ? `[Exp: ${t.numeroExpediente}]` : '';
                const tsNombre = t.trabajadorSocial ? `${t.trabajadorSocial.nombre} ${t.trabajadorSocial.apellidos}` : 'Trabajador/a Social';
                const alertaBadge = t.alertaSocial ? `<span class="bg-red-100 text-red-700 border border-red-200 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">⚠️ ALERTA</span>` : '';

                const tarjetaItem = document.createElement('div');
                tarjetaItem.className = `border p-3 rounded-xl flex flex-col gap-1.5 shadow-sm bg-white ${t.alertaSocial ? 'border-red-300 bg-red-50/10' : 'border-slate-200'}`;
                tarjetaItem.innerHTML = `
                    <div class="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                        <span class="text-sky-600 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded uppercase tracking-wider">${t.categoria || 'EVOLUTIVO'}</span>
                        ${t.categoria === 'RECURSO_PUBLICO' ? `<span class="text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase">${t.estado || 'TRAMITE'}</span>` : ''}
                        ${alertaBadge}
                        <span class="text-slate-400 font-medium ml-auto">${fRegistro} ${vtoTexto}</span>
                    </div>
                    <div class="text-[10px] text-slate-500 font-semibold italic mt-0.5">
                        ${expTexto} ${t.recursoDetalle ? `• Recurso: ${t.recursoDetalle}` : ''} ${t.intervencionDetalle ? `• Familiar: ${t.intervencionDetalle}` : ''}
                    </div>
                    <p class="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50/50 p-2 rounded border border-dashed select-text">${t.gestionesRealizadas}</p>
                    <span class="text-[9px] text-slate-400 text-right font-medium block">Firmado por: ${tsNombre}</span>
                `;
                contenedor.appendChild(tarjetaItem);
            });
        } catch (error) {
            console.error(error);
            contenedor.innerHTML = `<p class="text-center text-xs text-red-500 font-medium py-4">Error de enlace con el servidor.</p>`;
        }
    }
}

function inicializarSelectsConEnums() {
    const selectCat = document.getElementById('select-categoria');
    if (selectCat) {
        selectCat.innerHTML = `
            <option value="INTEGRACION_SOCIAL" selected>🤝 INTEGRACIÓN SOCIAL / SEGUIMIENTO</option>
            <option value="RECURSO_PUBLICO">📜 RECURSO PÚBLICO (DEPENDENCIAS / TRÁMITES)</option>
            <option value="INTERVENCION_FAMILIAR">🏡 INTERVENCIÓN CON FAMILIAS</option>
            <option value="DOCUMENTACION_PERSONAL">📋 DOCUMENTACIÓN PERSONAL / EXPEDIENTES</option>
        `;
    }

    const selectEst = document.getElementById('select-estado');
    if (selectEst) {
        selectEst.innerHTML = `
            <option value="PENDIENTE_INICIAR" selected>⏳ PENDIENTE DE INICIAR / DOCUMENTOS</option>
            <option value="EN_TRAMITE">⚙️ EN TRÁMITE / PRESENTADO</option>
            <option value="PENDIENTE_ADMINISTRACION">🏢 PENDIENTE DE RESOLUCIÓN</option>
            <option value="SUBSANACION_DOCUMENTOS">⚠️ REQUERIMIENTO DE SUBSANACIÓN</option>
            <option value="CONCEDIDO">✅ CONCEDIDO / FAVORABLE</option>
            <option value="DENEGADO">❌ DENEGADO / DESFAVORABLE</option>
        `;
    }

    const selectRec = document.getElementById('select-recurso');
    if (selectRec) {
        selectRec.innerHTML = `
            <option value="GRADO_DEPENDENCIA" selected>📜 GRADO DE DEPENDENCIA</option>
            <option value="PIA_RESIDENCIA">🏢 PIA RESIDENCIA (PLAZA PÚBLICA)</option>
            <option value="PRESTACION_ECONOMICA_PEVS">💰 PRESTACIÓN ECONÓMICA (PEVS)</option>
            <option value="PENSION_NO_CONTRIBUTIVA">👵 PENSIÓN NO CONTRIBUTIVA</option>
            <option value="DISCAPACIDAD">♿ RECONOCIMIENTO DISCAPACIDAD</option>
            <option value="BONO_SOCIAL">⚡ TRAMITACIÓN BONO SOCIAL</option>
        `;
    }

    const selectInt = document.getElementById('select-intervencion');
    if (selectInt) {
        selectInt.innerHTML = `
            <option value="ACOGIDA_INGRESO" selected>🔑 ENTREVISTA DE ACOGIDA AL INGRESO</option>
            <option value="ENTREVISTA_SEGUIMIENTO">🗣️ ENTREVISTA DE SEGUIMIENTO</option>
            <option value="MEDIACION_CONFLICTO">🤝 MEDIACIÓN EN CONFLICTOS</option>
            <option value="DUELO_FAMILIAR">🌱 ACOMPAÑAMIENTO EN EL DUELO</option>
            <option value="REUNION_PLAN_CUIDADOS">📋 REUNIÓN PLAN DE CUIDADOS (PIAI)</option>
        `;
    }

    evaluarFormularioDinamico();
}