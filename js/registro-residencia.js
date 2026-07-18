// Lógica del Registro de la Residencia y Administrador
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-registro');
    if (form) {
        form.addEventListener('submit', ejecutarRegistro);
    }
});


/**
 * Valida un formato estándar de CIF español mediante expresiones regulares.
 */
function validarCIF(cif) {
    const regexCif = /^[A-HJ-NP-SU-W0-9][0-9]{8}$/;
    return regexCif.test(cif);
}

/**
 * Valida formatos estándar de DNI o NIE españoles mediante expresiones regulares.
 */
function validarDNIOId(dni) {
    const regexDniNie = /^[XYZ0-9][0-9]{7}[A-Z]$/;
    return regexDniNie.test(dni);
}

async function ejecutarRegistro(e) {
    e.preventDefault();

    // Normalizamos quitando espacios innecesarios y convirtiendo a mayúsculas
    const cifNormalizado = document.getElementById('emp-cif').value.trim().toUpperCase();
    const dniNormalizado = document.getElementById('adm-dni').value.trim().toUpperCase();
    const contraseña = document.getElementById('adm-pass').value;

    // --- Control de formato en Frontend por si falla la validación HTML5 ---
    if (!validarCIF(cifNormalizado)) {
        alert('Por favor, introduce un formato de CIF válido (Ej: A1234567B).');
        document.getElementById('emp-cif').focus();
        return;
    }

    if (!validarDNIOId(dniNormalizado)) {
        alert('Por favor, introduce un formato de DNI o NIE válido (Ej: 12345678Z).');
        document.getElementById('adm-dni').focus();
        return;
    }

    if (contraseña.length < 6) {
        alert('La contraseña del administrador debe tener al menos 6 caracteres.');
        document.getElementById('adm-pass').focus();
        return;
    }

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
            password: contraseña
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
                // Comprobamos si el servidor nos responde con un JSON de error estructurado
                const contentType = respuesta.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const jsonError = await respuesta.json();
                    // Extrae el mensaje dinámico que envíe tu backend (se adapta a los formatos habituales)
                    textoError = jsonError.mensaje || jsonError.error || jsonError.message || JSON.stringify(jsonError);
                } else {
                    textoError = await respuesta.text();
                }
            } catch (err) {
                textoError = "El navegador bloqueó la lectura del cuerpo del error o el formato de respuesta no es válido.";
            }

            alert(`Fallo en el Servidor (Status ${status}): ${textoError}\n\n👉 MIRA LA CONSOLA DE INTELLIJ PARA VER EL ERROR REAL EN ROJO.`);
        }
    } catch (error) {
        console.error("Error de registro:", error);
        alert('Error de red o conexión denegada con la API.');
    }
}