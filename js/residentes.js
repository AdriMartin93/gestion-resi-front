// Lógica de Gestión del Módulo de Higiene y Limpieza (Fichero Asistencial Residentes)
let API_URL;
let cacheHistoriales = {};
let contactosTemporales = []; // 💾 Almacén temporal para gestionar multi-contactos en el formulario

document.addEventListener('DOMContentLoaded', () => {
    if (!window.Auth.checkSession()) return;

    API_URL = `${window.CONFIG.API_BASE}/api/residentes`;
    cargarResidentes();

    const formResidente = document.getElementById('form-residente');
    if (formResidente) formResidente.addEventListener('submit', guardarResidente);

    const formHistorial = document.getElementById('form-historial');
    if (formHistorial) formHistorial.addEventListener('submit', guardarHistorialMedico);

    const formPauta = document.getElementById('form-pauta');
    if (formPauta) formPauta.addEventListener('submit', guardarNuevaPauta);
});

async function cargarResidentes() {
    const contenedor = document.getElementById('lista-residentes');
    const template = document.getElementById('template-residente');

    const roles = window.Auth.getRoles();
    const esPersonalSanitario = roles.includes('ROLE_DIRECTOR') ||
        roles.includes('ROLE_ENFERMERO') ||
        roles.includes('ROLE_DOCTOR');

    try {
        const tokenLimpio = window.Auth.getToken();
        const response = await fetch(API_URL, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenLimpio}`,
                "Content-Type": "application/json"
            }
        });

        if (response.status === 403) {
            window.Auth.logout();
            return;
        }
        if (!response.ok) throw new Error("Error en la llamada.");

        const residentes = await response.json();
        console.log("👀 ¿QUÉ ME TRAE EL BACKEND?:", residentes);
        contenedor.innerHTML = "";

        if (residentes.length === 0) {
            contenedor.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">No hay residentes registrados activos en el centro.</div>`;
            return;
        }

        residentes.forEach(res => {
            const clon = template.content.cloneNode(true);

            clon.querySelector('.avatar').innerText = res.nombre.charAt(0);
            clon.querySelector('.nombre-completo').innerText = `${res.nombre} ${res.apellidos}`;
            clon.querySelector('.badge-habitacion').innerText = `Hab. ${res.habitacion}`;
            clon.querySelector('.txt-dni').innerText = res.dni;
            clon.querySelector('.txt-tis').innerText = res.tis;
            clon.querySelector('.txt-fecha').innerText = res.fechaNacimiento || 'N/A';
            clon.querySelector('.txt-habitacion').innerText = res.habitacion;

            const contenedorContactos = clon.querySelector('.contenedor-contactos');
            renderizarContactosEnContenedor(res.contactos, contenedorContactos);

            const detallesBox = clon.querySelector('.detalles-box');
            detallesBox.id = `detalles-res-${res.id}`;

            if (esPersonalSanitario) {
                clon.querySelector('.seccion-salud').classList.remove('hidden');
                clon.querySelector('.btn-editar-salud').addEventListener('click', (e) => {
                    e.stopPropagation();
                    abrirModalSalud(res.id, `${res.nombre} ${res.apellidos}`);
                });
            }

            clon.querySelector('.btn-detalles').addEventListener('click', () => {
                const caja = document.getElementById(`detalles-res-${res.id}`);
                if (caja) {
                    const estaOculto = caja.classList.toggle('hidden');
                    if (!estaOculto && esPersonalSanitario) {
                        consultarDatosClinicos(res.id, caja);
                    }
                }
            });

            clon.querySelector('.btn-editar').addEventListener('click', (e) => {
                e.stopPropagation();
                abrirModalEditar(res);
            });

            clon.querySelector('.btn-borrar').addEventListener('click', (e) => {
                e.stopPropagation();
                borrarResidente(res.id);
            });

            contenedor.appendChild(clon);
        });
    } catch (error) {
        console.error("Error al cargar residentes:", error);
        contenedor.innerHTML = `<div class="text-center text-red-500 py-4 alert-premium bg-red-50 border border-red-200 rounded-xl text-sm">Error de conexión con la base asistencial</div>`;
    }
}

async function consultarDatosClinicos(residenteId, contenedorCard) {
    const tokenLimpio = window.Auth.getToken();
    const urlHistorial = `${window.CONFIG.API_BASE}/api/historiales-medicos/residente/${residenteId}`;

    try {
        const response = await fetch(urlHistorial, {
            method: "GET",
            headers: { "Authorization": `Bearer ${tokenLimpio}` }
        });

        if (!response.ok) return;
        const hMedico = await response.json();

        cacheHistoriales[residenteId] = hMedico;

        contenedorCard.querySelector('.badge-sangre').innerText = hMedico.grupoSanguineo || 'S/G';
        contenedorCard.querySelector('.txt-movilidad').innerText = hMedico.movilidad || 'No especificada';
        contenedorCard.querySelector('.txt-dieta').innerText = hMedico.dieta || 'Normal';
        contenedorCard.querySelector('.txt-antecedentes').innerText = hMedico.antecedentesClinicos || 'Sin antecedentes registrados.';

        const contAlergias = contenedorCard.querySelector('.contenedor-alergias');
        contAlergias.innerHTML = "";
        if (hMedico.alergias && hMedico.alergias.length > 0) {
            hMedico.alergias.forEach(alergia => {
                contAlergias.innerHTML += `<span class="bg-red-50 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-200">${alergia}</span>`;
            });
        } else {
            contAlergias.innerHTML = `<span class="text-slate-400 text-[10px]">Ninguna conocida</span>`;
        }

        const contPautas = contenedorCard.querySelector('.contenedor-pautas');
        contPautas.innerHTML = "";
        if (hMedico.pautaMedica && hMedico.pautaMedica.length > 0) {
            hMedico.pautaMedica.forEach(pauta => {
                contPautas.innerHTML += `
                    <div class="bg-slate-50 border border-slate-200 p-2 rounded-lg text-[11px] flex justify-between items-start gap-2">
                        <div class="flex-grow">
                            <div class="font-bold text-slate-700">💊 ${pauta.medicamento}</div>
                            <div class="text-slate-500 text-[10px] mt-0.5">
                                Dosis: ${pauta.dosis} | Duración: ${pauta.duracion}
                            </div>
                            ${pauta.observaciones ? `<div class="text-slate-400 text-[9px] italic mt-0.5 border-t border-slate-100 pt-0.5">Obs: ${pauta.observaciones}</div>` : ''}
                        </div>
                        <button onclick="event.stopPropagation(); eliminarPautaMedica(${pauta.id}, ${residenteId})" class="text-slate-300 hover:text-red-500 font-bold px-1 text-xs" title="Eliminar pauta">&times;</button>
                    </div>
                `;
            });
        } else {
            contPautas.innerHTML = `<div class="text-center my-auto text-slate-400 text-[11px] italic py-4">No tiene medicación pautada hoy.</div>`;
        }

    } catch (error) {
        console.error("Error al cargar datos clínicos:", error);
    }
}

// 📌 SUBFORMULARIO: GESTIÓN DE LA LISTA TEMPORAL EN EL MODAL DE RESIDENTE
function agregarContactoALaListaTemporal() {
    const inputNombre = document.getElementById('form-con-nombre');
    const inputParentesco = document.getElementById('form-con-parentesco');
    const inputTelefono = document.getElementById('form-con-telefono');
    const inputEmail = document.getElementById('form-con-email');

    const nombre = inputNombre.value.trim();
    const parentesco = inputParentesco.value.trim();
    const telefono = inputTelefono.value.trim();
    const email = inputEmail.value.trim();

    if (!nombre || !parentesco || !telefono) {
        alert("Por favor, rellena al menos el Nombre, Parentesco y Teléfono del contacto.");
        return;
    }

    // Guardar el objeto en el array dinámico
    contactosTemporales.push({ nombre, parentesco, telefono, email });

    // Limpiar subformulario rápido
    inputNombre.value = "";
    inputParentesco.value = "";
    inputTelefono.value = "";
    inputEmail.value = "";

    renderizarListaContactosTemporales();
}

function eliminarContactoDeListaTemporal(index) {
    contactosTemporales.splice(index, 1);
    renderizarListaContactosTemporales();
}

function renderizarListaContactosTemporales() {
    const contenedor = document.getElementById('lista-contactos-temporal');
    contenedor.innerHTML = "";

    contactosTemporales.forEach((con, index) => {
        contenedor.innerHTML += `
            <div class="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex justify-between items-center text-xs">
                <div>
                    <strong class="text-slate-700">${con.nombre}</strong> 
                    <span class="text-slate-400 text-[10px]">(${con.parentesco})</span>
                    <span class="text-slate-500 ml-2">📞 ${con.telefono}</span>
                </div>
                <button type="button" onclick="eliminarContactoDeListaTemporal(${index})" class="text-red-500 font-bold hover:text-red-700 px-1">&times;</button>
            </div>
        `;
    });
}

// 🏢 MODAL PRINCIPAL: EXPEDIENTES GENERALES
function abrirModalCrear() {
    const form = document.getElementById('form-residente');
    form.reset();
    document.getElementById('residente-id').value = "";
    contactosTemporales = []; // Limpiar la lista al crear uno nuevo
    renderizarListaContactosTemporales();

    document.getElementById('modal-titulo').innerText = "Registrar Residente";
    document.getElementById('modal-residente').classList.remove('hidden');
}

function abrirModalEditar(res) {
    document.getElementById('residente-id').value = res.id;
    document.getElementById('modal-res-nombre').value = res.nombre;
    document.getElementById('modal-res-apellidos').value = res.apellidos;
    document.getElementById('modal-res-dni').value = res.dni;
    document.getElementById('modal-res-tis').value = res.tis;
    document.getElementById('modal-res-fecha').value = res.fechaNacimiento || "";
    document.getElementById('modal-res-habitacion').value = res.habitacion;

    contactosTemporales = res.contactos ? [...res.contactos] : [];
    renderizarListaContactosTemporales();

    document.getElementById('modal-titulo').innerText = "Editar Expediente Residente";
    document.getElementById('modal-residente').classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modal-residente').classList.add('hidden');
    contactosTemporales = [];
}

async function guardarResidente(e) {
    e.preventDefault();
    const id = document.getElementById('residente-id').value;
    const tokenLimpio = window.Auth.getToken();

    // 🔒 Sincronizamos con el modelo SQL: forzamos el flag "activo: true"
    const payload = {
        nombre: document.getElementById('modal-res-nombre').value.trim(),
        apellidos: document.getElementById('modal-res-apellidos').value.trim(),
        dni: document.getElementById('modal-res-dni').value.trim(),
        tis: document.getElementById('modal-res-tis').value.trim(),
        fechaNacimiento: document.getElementById('modal-res-fecha').value,
        habitacion: document.getElementById('modal-res-habitacion').value.trim(),
        activo: true // <-- Crucial para que Spring Boot lo persista como alta válida
    };

    payload.contactos = contactosTemporales;

    try {
        let res;
        if (id) {
            res = await fetch(`${API_URL}/${id}`, {
                // Sigue apuntando a Patch o Put según tu back
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${tokenLimpio}`
                },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${tokenLimpio}`
                },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            cerrarModal();
            cargarResidentes();
        } else {
            const errorMsg = await res.text();
            alert(errorMsg || "Error de validación en el servidor.");
        }
    } catch (err) {
        boxContentError("Error al guardar el residente:", err);
    }
}

// 🏥 MODAL CLÍNICO
let residenteIdSeleccionadoGlobal = null;

function abrirModalSalud(residenteId, nombreCompleto) {
    residenteIdSeleccionadoGlobal = residenteId;
    document.getElementById('modal-salud-nombre').innerText = nombreCompleto;
    document.getElementById('form-pauta').reset();

    const datosHistorial = cacheHistoriales[residenteId];

    if (datosHistorial) {
        document.getElementById('modal-historial-id').value = datosHistorial.id;
        document.getElementById('modal-his-sangre').value = datosHistorial.grupoSanguineo || "";
        document.getElementById('modal-his-movilidad').value = datosHistorial.movilidad || "";
        document.getElementById('modal-his-dieta').value = datosHistorial.dieta || "";
        document.getElementById('modal-his-antecedentes').value = datosHistorial.antecedentesClinicos || "";
    } else {
        alert("Por favor, despliega la tarjeta del residente al menos una vez para cargar los datos médicos.");
        return;
    }

    document.getElementById('modal-salud').classList.remove('hidden');
}

function cerrarModalSalud() {
    document.getElementById('modal-salud').classList.add('hidden');
    residenteIdSeleccionadoGlobal = null;
}

async function guardarHistorialMedico(e) {
    e.preventDefault();
    const tokenLimpio = window.Auth.getToken();
    const idHistorial = document.getElementById('modal-historial-id').value;

    const payload = {
        grupoSanguineo: document.getElementById('modal-his-sangre').value.trim(),
        movilidad: document.getElementById('modal-his-movilidad').value.trim(),
        dieta: document.getElementById('modal-his-dieta').value.trim(),
        antecedentesClinicos: document.getElementById('modal-his-antecedentes').value.trim()
    };

    try {
        const url = `${window.CONFIG.API_BASE}/api/historiales-medicos/${idHistorial}`;
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${tokenLimpio}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Historial médico actualizado.");
            const card = document.getElementById(`detalles-res-${residenteIdSeleccionadoGlobal}`);
            if (card) consultarDatosClinicos(residenteIdSeleccionadoGlobal, card);
        } else {
            alert("Error al actualizar la ficha clínica.");
        }
    } catch (err) {
        console.error(err);
    }
}

async function guardarNuevaPauta(e) {
    e.preventDefault();
    const tokenLimpio = window.Auth.getToken();

    const payload = {
        medicamento: document.getElementById('modal-pau-medicamento').value.trim(),
        dosis: document.getElementById('modal-pau-dosis').value.trim(),
        duracion: document.getElementById('modal-pau-duracion').value.trim(),
        observaciones: document.getElementById('modal-pau-obs').value.trim()
    };

    try {
        const url = `${window.CONFIG.API_BASE}/api/pautas-medicas/residente/${residenteIdSeleccionadoGlobal}`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${tokenLimpio}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById('form-pauta').reset();
            alert("Nueva pauta añadida correctamente.");
            const card = document.getElementById(`detalles-res-${residenteIdSeleccionadoGlobal}`);
            if (card) consultarDatosClinicos(residenteIdSeleccionadoGlobal, card);
        } else {
            alert("No se pudo añadir la pauta médica.");
        }
    } catch (err) {
        console.error(err);
    }
}

async function eliminarPautaMedica(pautaId, residenteId) {
    if (!confirm("¿Deseas retirar esta pauta farmacológica?")) return;
    const tokenLimpio = window.Auth.getToken();

    try {
        const url = `${window.CONFIG.API_BASE}/api/pautas-medicas/${pautaId}`;
        const res = await fetch(url, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${tokenLimpio}` }
        });

        if (res.ok) {
            const card = document.getElementById(`detalles-res-${residenteId}`);
            if (card) consultarDatosClinicos(residenteId, card);
        } else {
            alert("Error al suprimir la pauta.");
        }
    } catch (err) {
        console.error(err);
    }
}

async function borrarResidente(id) {
    // 🔄 Adaptado profesionalmente para reflejar la baja lógica (Soft Delete)
    if (!confirm("¿Deseas dar de baja el expediente de este residente? Sus registros históricos clínicos se conservarán de forma segura.")) return;
    const tokenLimpio = window.Auth.getToken();
    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: "DELETE", // Enlazado con @DeleteMapping en tu controlador
            headers: { "Authorization": `Bearer ${tokenLimpio}` }
        });
        if (res.ok) {
            cargarResidentes(); // Recarga la cuadrícula (ahora vendrá limpia sin el residente inactivo)
        } else {
            alert("Fallo al dar de baja el expediente asistencial.");
        }
    } catch (err) {
        console.error(err);
    }
}

// Función reutilizable que clona el template de contactos sin meter HTML en JS
function renderizarContactosEnContenedor(arrayContactos, contenedorDOM) {
    const templateContacto = document.getElementById('template-contacto');
    contenedorDOM.innerHTML = "";

    if (arrayContactos && arrayContactos.length > 0) {
        arrayContactos.forEach(con => {
            const clonCon = templateContacto.content.cloneNode(true);

            clonCon.querySelector('.txt-con-nombre').innerText = con.nombre;
            clonCon.querySelector('.txt-con-parentesco').innerText = `(${con.parentesco})`;
            clonCon.querySelector('.txt-con-telefono').innerText = `📞 ${con.telefono}`;
            clonCon.querySelector('.txt-con-email').innerText = con.email ? `✉️ ${con.email}` : '';

            contenedorDOM.appendChild(clonCon);
        });
    } else {
        contenedorDOM.innerHTML = `<span class="text-slate-400 italic text-[10px]">Sin contactos de emergencia vinculados.</span>`;
    }
}

function boxContentError(msg, err) {
    console.error(msg, err);
}