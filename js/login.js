document.addEventListener('DOMContentLoaded', () => {
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

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const textoOriginalBtn = submitBtn ? submitBtn.innerText : 'Iniciar Sesión';

    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value;

    if (!usernameInput || !passwordInput) {
        errorAlert.innerText = "Por favor, introduce tu usuario y contraseña.";
        errorAlert.classList.remove('hidden');
        return;
    }

    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Conectando con el servidor...";
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
    }

    
    const temporizadorRender = setTimeout(() => {
        errorAlert.className = "bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 alert-premium text-xs font-medium rounded-lg space-y-1 block";
        errorAlert.innerHTML = `
            <div class="font-bold flex items-center gap-1">
                <span>⏳</span> Despertando servidor en Render...
            </div>
            <p class="text-[11px] leading-relaxed">
                El entorno gratuito de Render suspende los contenedores inactivos. El arranque de la API (Spring Boot) puede demorarse entre 30 y 50 segundos. Por favor, no cierres la ventana.
            </p>
        `;
    }, 3000);

    try {
        const response = await fetch(`${window.CONFIG.API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombreUsuario: usernameInput, password: passwordInput })
        });

        clearTimeout(temporizadorRender);

        if (response.ok) {
            const data = await response.json();
            const tokenGenerado = data.token;
            // Guardamos el token de forma centralizada y limpia
            window.Auth.saveToken(tokenGenerado);
            window.location.href = "menu.html";
        } else {
            const mensajeError = await response.text();
            restaurarAlertaError(errorAlert, mensajeError || "Credenciales incorrectas.");
        }
    } catch (error) {
        clearTimeout(temporizadorRender);
        console.error("Error de login:", error);
        restaurarAlertaError(errorAlert, "Error de red al conectar con el servidor. Si el servidor estaba suspendido, inténtalo de nuevo en unos segundos.");
    } finally {
        clearTimeout(temporizadorRender);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = textoOriginalBtn;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }
}


function restaurarAlertaError(contenedor, mensaje) {
    contenedor.className = "bg-red-50 border border-red-200 text-red-700 px-4 py-3 alert-premium text-xs font-medium";
    contenedor.innerText = mensaje;
    contenedor.classList.remove('hidden');
}