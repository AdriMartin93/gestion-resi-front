document.addEventListener('DOMContentLoaded', () => {
    if (!window.Auth.checkSession()) return;

    // 🔒 REBOTE DE SEGURIDAD EN FRONTEND
    const roles = window.Auth.getRoles();
    if (!roles || !roles.includes('ROLE_DIRECTOR')) {
        alert('Acceso denegado: Este panel de control es exclusivo para el Director General.');
        window.location.href = 'menu.html'; 
        return;
    }
    console.log("Acceso al módulo de administración concedido en cliente.");
});