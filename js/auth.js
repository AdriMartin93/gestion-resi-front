window.Auth = {
    getToken() {
        return localStorage.getItem('resi_token');
    },

    saveToken(token) {
        if (!token) return;
        localStorage.setItem('resi_token', token.trim());
    },

    removeToken() {
        localStorage.removeItem('resi_token');
        localStorage.removeItem('resi_trabajando');
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    getUsername() {
        const token = this.getToken();
        if (!token) return 'Usuario';
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            return payload.sub || payload.username || payload.name || 'Usuario';
        } catch (error) {
            console.warn("Token no descifrable:", error);
            return 'Usuario';
        }
    },

    getRoles() {
        const token = this.getToken();
        if (!token) return [];
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            return payload.roles || payload.authorities || []; 
        } catch (error) {
            console.warn("No se pudieron extraer los roles:", error);
            return [];
        }
    },

    checkSession() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    logout() {
        this.removeToken();
        window.location.href = 'login.html';
    }
};