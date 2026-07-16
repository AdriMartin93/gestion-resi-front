let API_URL;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.Auth.checkSession()) return;

    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Este módulo es exclusivo para el Director General.');
        window.location.href = 'menu.html';
        return;
    }

    API_URL = `${window.CONFIG.API_BASE}/api/empleados`;
    cargarEmpleados();

    const form = document.getElementById('form-empleado');
    if (form) {
        form.addEventListener('submit', guardarEmpleado);
    }
});

async function cargarEmpleados() {
    const contenedor = document.getElementById('lista-empleados');
    const template = document.getElementById('template-empleado');

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
        if (!response.ok) throw new Error("Error de servidor.");

        const empleados = await response.json();
        contenedor.innerHTML = "";

        if (empleados.length === 0) {
            contenedor.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">No hay empleados registrados.</div>`;
            return;
        }

        empleados.forEach(emp => {
            // ✂️ Clonamos el nodo del molde HTML limpio
            const clon = template.content.cloneNode(true);

            // ✏️ Inyectamos los textos de forma segura usando clases de referencia
            clon.querySelector('.avatar').innerText = emp.nombre.charAt(0);
            clon.querySelector('.nombre-completo').innerText = `${emp.nombre} ${emp.apellidos}`;
            clon.querySelector('.txt-username').innerText = emp.nombreUsuario;
            clon.querySelector('.txt-dni').innerText = emp.dni;
            clon.querySelector('.txt-email').innerText = emp.email;
            clon.querySelector('.txt-telefono').innerText = emp.telefono || 'N/A';

            // 🎯 Manejo interno de los IDs para el colapsable desplegable
            const detallesBox = clon.querySelector('.detalles-box');
            detallesBox.id = `detalles-${emp.id}`;
            
            clon.querySelector('.btn-detalles').addEventListener('click', () => {
                alternarDetalles(emp.id);
            });

            // 🛠️ Configuración limpia de los botones de acción
            clon.querySelector('.btn-editar').addEventListener('click', (e) => {
                e.stopPropagation(); // Evita que se abra el desplegable al pulsar editar
                abrirModalEditar(emp);
            });

            clon.querySelector('.btn-borrar').addEventListener('click', (e) => {
                e.stopPropagation(); // Evita que se abra el desplegable al pulsar borrar
                borrarEmpleado(emp.id);
            });

            // 🏅 Renderizado e inyección de los badges de roles
            const contenedorBadges = clon.querySelector('.contenedor-badges-roles');
            if (emp.roles && emp.roles.length > 0) {
                emp.roles.forEach(rol => {
                    const nombreLimpio = rol.replace('ROLE_', '').toLowerCase();
                    const capitalizado = nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1);
                    
                    const badge = document.createElement('span');
                    badge.className = "inline-block bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-200 mr-1 mt-1";
                    badge.innerText = capitalizado;
                    contenedorBadges.appendChild(badge);
                });
            } else {
                contenedorBadges.innerHTML = '<span class="text-slate-400">Sin roles asignados</span>';
            }

            // 📦 Insertamos el clon completado en la lista real
            contenedor.appendChild(clon);
        });
    } catch (error) {
        console.error("Error al cargar empleados:", error);
        contenedor.innerHTML = `<div class="text-center text-red-500 py-4 alert-premium bg-red-50 border border-red-200 rounded-xl">Error de conexión con la API</div>`;
    }
}

function alternarDetalles(id) {
    const el = document.getElementById(`detalles-${id}`);
    if (el) el.classList.toggle('hidden');
}

function abrirModalCrear() {
    const form = document.getElementById('form-empleado');
    form.reset();
    document.getElementById('empleado-id').value = "";
    document.getElementById('modal-emp-password').required = true;
    document.getElementById('modal-titulo').innerText = "Registrar Empleado";
    document.getElementById('modal-empleado').classList.remove('hidden');
}

function abrirModalEditar(emp) {
    document.getElementById('empleado-id').value = emp.id;
    document.getElementById('modal-emp-nombre').value = emp.nombre;
    document.getElementById('modal-emp-apellidos').value = emp.apellidos;
    document.getElementById('modal-emp-username').value = emp.nombreUsuario;
    document.getElementById('modal-emp-dni').value = emp.dni;
    document.getElementById('modal-emp-email').value = emp.email;
    document.getElementById('modal-emp-telefono').value = emp.telefono || "";
    document.getElementById('modal-emp-password').required = false;
    document.getElementById('modal-titulo').innerText = "Editar Empleado";

    const checkboxes = document.querySelectorAll('input[name="emp-roles"]');
    checkboxes.forEach(cb => {
        cb.checked = emp.roles && emp.roles.includes(cb.value);
    });

    document.getElementById('modal-empleado').classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modal-empleado').classList.add('hidden');
}

async function guardarEmpleado(e) {
    e.preventDefault();
    const id = document.getElementById('empleado-id').value;
    const roles = [];
    document.querySelectorAll('input[name="emp-roles"]:checked').forEach(cb => roles.push(cb.value));

    const tokenLimpio = window.Auth.getToken();

    const payload = {
        nombre: document.getElementById('modal-emp-nombre').value.trim(),
        apellidos: document.getElementById('modal-emp-apellidos').value.trim(),
        nombreUsuario: document.getElementById('modal-emp-username').value.trim(),
        dni: document.getElementById('modal-emp-dni').value.trim(),
        email: document.getElementById('modal-emp-email').value.trim(),
        telefono: document.getElementById('modal-emp-telefono').value.trim(),
        roles: roles
    };

    const pass = document.getElementById('modal-emp-password').value;
    if (pass) payload.password = pass;

    try {
        const res = await fetch(id ? `${API_URL}/${id}` : API_URL, {
            method: id ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${tokenLimpio}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModal();
            cargarEmpleados();
        } else {
            const errorMsg = await res.text();
            alert(errorMsg || "Error al procesar la solicitud.");
        }
    } catch (err) {
        console.error("Error al guardar:", err);
        alert("Error de red.");
    }
}

async function borrarEmpleado(id) {
    if (!confirm("¿Eliminar empleado?")) return;
    const tokenLimpio = window.Auth.getToken();
    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${tokenLimpio}` }
        });
        if (res.ok) {
            cargarEmpleados();
        } else {
            const errorMsg = await res.text();
            alert(errorMsg || "Error al eliminar.");
        }
    } catch (err) {
        console.error("Error al borrar:", err);
        alert("Error de conexión.");
    }
}