// ============================================================
// LOGIN — KAPITRANS
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    const form = document.querySelector('.login-form');
    if (!form) return;

    const DEFAULT_USERS = {
        'admin@kapitrans.cd': {
            password: 'kapitrans243',
            redirect: 'admin-dashboard.html',
            nom: 'Kapitrans Admin',
            role: 'ADMIN'
        }
    };

    function getAllUsers() {
        const storedUsers = JSON.parse(localStorage.getItem('kapitrans-users') || '{}');
        if (!storedUsers || Array.isArray(storedUsers) || typeof storedUsers !== 'object') {
            throw new Error('Le registre des utilisateurs doit contenir un objet valide.');
        }
        const userStatuses = JSON.parse(localStorage.getItem('kapitrans-user-statuses') || '{}');
        if (!userStatuses || Array.isArray(userStatuses) || typeof userStatuses !== 'object') {
            throw new Error('Les statuts des utilisateurs doivent contenir un objet valide.');
        }
        Object.keys(storedUsers).forEach(function (email) {
            if (userStatuses[email]) storedUsers[email].statut = userStatuses[email];
        });
        return Object.assign({}, storedUsers, DEFAULT_USERS);
    }

    function showNotice(type, message) {
        window.kapitransToast(message, type);
    }

    function clearNotice() {
        document.querySelector('.kapitrans-toast')?.remove();
    }

    // Vider les champs au chargement
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';

    // Vider les champs si bouton retour
    window.addEventListener('pageshow', function (event) {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        clearNotice();
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim().toLowerCase();
        const password = document.getElementById('password').value.trim();

        clearNotice();

        if (!username || !password) {
            showNotice('error', 'Veuillez remplir tous les champs.');
            return;
        }

        let user;
        try {
            user = getAllUsers()[username];
        } catch (error) {
            console.error('Impossible de lire les utilisateurs enregistrés.', error);
            showNotice('error', 'Impossible de lire les comptes enregistrés. Vérifiez le stockage local.');
            return;
        }

        if (user && String(user.statut || 'Actif').toLowerCase() !== 'inactif' && user.password === password) {
            showNotice('success', 'Connexion réussie. Redirection en cours.');

            localStorage.setItem('kapitrans-user', JSON.stringify({
                email: username,
                nom: user.nom,
                role: user.role
            }));

            setTimeout(function () {
                window.location.href = user.redirect;
            }, 1600);
        } else {
            showNotice('error', 'Nom d\'utilisateur ou mot de passe incorrect.');
        }
    });

});