// Lógica de Inicio de Sesión
document.addEventListener('DOMContentLoaded', () => {
    // Limpieza de sesión al cargar la página de login
    window.Auth.removeToken();

    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', ejecutarLogin);
    }
});

async function ejecutarLogin(e) {
    e.preventDefault();
    const errorAlert = document.getElementById('error-alert');
    errorAlert.classList.add('hidden');
    errorAlert.innerText = '';

    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value;

    if (!usernameInput || !passwordInput) {
        errorAlert.innerText = "Por favor, introduce tu usuario y contraseña.";
        errorAlert.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${window.CONFIG.API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombreUsuario: usernameInput, password: passwordInput })
        });

        if (response.ok) {
            const data = await response.json();
            const tokenGenerado = data.token;
            // Guardamos el token de forma centralizada y limpia
            window.Auth.saveToken(tokenGenerado);
            window.location.href = "menu.html";
        } else {
            const mensajeError = await response.text();
            errorAlert.innerText = mensajeError || "Credenciales incorrectas.";
            errorAlert.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error de login:", error);
        errorAlert.innerText = "Error de red al conectar con el servidor.";
        errorAlert.classList.remove('hidden');
    }
}
