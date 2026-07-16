// Lógica del Registro de la Residencia y Administrador
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-registro');
    if (form) {
        form.addEventListener('submit', ejecutarRegistro);
    }
});

async function ejecutarRegistro(e) {
    e.preventDefault();

    const cifNormalizado = document.getElementById('emp-cif').value.trim().toUpperCase();
    const dniNormalizado = document.getElementById('adm-dni').value.trim().toUpperCase();

    const payload = {
        empresa: {
            nombreComercial: document.getElementById('emp-nombre').value.trim(),
            cif: cifNormalizado,
            email: document.getElementById('emp-email').value.trim()
        },
        administrador: {
            nombre: document.getElementById('adm-nombre').value.trim(),
            apellidos: document.getElementById('adm-apellidos').value.trim(),
            dni: dniNormalizado,
            nombreUsuario: document.getElementById('adm-usuario').value.trim(),
            email: document.getElementById('adm-email').value.trim(),
            password: document.getElementById('adm-pass').value
        }
    };

    try {
        const respuesta = await fetch(`${window.CONFIG.API_BASE}/auth/register-company`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (respuesta.ok) {
            alert('¡Residencia y Administrador creados con éxito!');
            window.location.href = 'login.html';
        } else {
            const status = respuesta.status;
            let textoError = "";
            try {
                textoError = await respuesta.text();
            } catch (err) {
                textoError = "El navegador bloqueó la lectura del cuerpo del error (CORS/File Origin restriction).";
            }

            alert(`Fallo en el Servidor (Status ${status}): ${textoError}\n\n👉 MIRA LA CONSOLA DE INTELLIJ PARA VER EL ERROR REAL EN ROJO.`);
        }
    } catch (error) {
        console.error("Error de registro:", error);
        alert('Error de red o conexión denegada con la API.');
    }
}
