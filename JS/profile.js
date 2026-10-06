// ============================================================
// PROFILE — KAPITRANS
// ============================================================
// Ce fichier gère le profil de l'agent connecté.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER L'UTILISATEUR CONNECTÉ
    // ============================================================

    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
    } catch (error) {
        console.error('Impossible de lire la session utilisateur.', error);
    }
    let records = {};
    try {
        records = JSON.parse(localStorage.getItem('kapitrans-users') || '{}');
    } catch (error) {
        console.error('Impossible de lire les utilisateurs enregistrés.', error);
    }
    const record = user?.email ? records[user.email] || {} : {};
    const fullName = record.nom || user?.nom || 'Utilisateur';
    const nameParts = fullName.trim().split(/\s+/);

    // ============================================================
    // 2. METTRE À JOUR LES INFOS DU PROFIL
    // ============================================================

    // Nom complet
    const nameEl = document.querySelector('.profile-name');
    if (nameEl) nameEl.textContent = fullName;

    // Rôle
    const roleEl = document.querySelector('.profile-role');
    if (roleEl) roleEl.textContent = formatRole(user?.role || record.role);

    // Avatar (initiales)
    const avatarEl = document.querySelector('.profile-avatar span');
    if (avatarEl) avatarEl.textContent = getInitials(fullName);

    // Badge de rôle
    const roleBadgeEl = document.querySelector('.profile-info-value .role-badge');
    if (roleBadgeEl) {
        roleBadgeEl.textContent = formatRole(user?.role || record.role);
        roleBadgeEl.className = 'role-badge ' + getRoleClass(user?.role || record.role);
    }

    // Email
    const emailEls = document.querySelectorAll('.profile-info-value');
    emailEls.forEach(function (el) {
        if (el.textContent.includes('@')) {
            el.textContent = user?.email || '—';
        }
    });
    const profileValues = document.querySelectorAll('.profile-info-grid .profile-info-value');
    const values = [
        nameParts[0] || '—',
        nameParts.slice(1).join(' ') || '—',
        user?.email || '—',
        record.telephone || '—',
        '—',
        '—',
        '',
        record.zone || '—',
        '—',
        '—'
    ];
    profileValues.forEach(function (element, index) {
        if (index === 6) return;
        element.textContent = values[index] || '—';
    });

    let history = [];
    try {
        const storedHistory = JSON.parse(localStorage.getItem('kapitrans-history') || '[]');
        if (Array.isArray(storedHistory)) history = window.kapitransHistory.forCurrentAgent(storedHistory);
    } catch (error) {
        console.error('Impossible de lire les statistiques du profil.', error);
    }
    const today = new Date().toDateString();
    const profileStats = document.querySelectorAll('.profile-stat-value');
    const conforming = history.filter(function (entry) { return entry.statut === 'conforme'; }).length;
    const todayCount = history.filter(function (entry) {
        return entry.date && new Date(entry.date).toDateString() === today;
    }).length;
    [history.length, conforming, history.length - conforming, todayCount].forEach(function (value, index) {
        if (profileStats[index]) profileStats[index].textContent = String(value);
    });

    // ============================================================
    // 3. FONCTION : FORMATER LE RÔLE
    // ============================================================

    function formatRole(role) {
        if (!role) return '—';
        if (role === 'ADMIN') return 'Administrateur';
        if (role === 'AGENT') return 'Agent de contrôle';
        if (role === 'GARAGE') return 'Garage';
        if (role === 'SUPERVISEUR') return 'Superviseur';
        if (role === 'DGI') return 'DGI';
        return role;
    }

    // ============================================================
    // 4. FONCTION : INITIALES
    // ============================================================

    function getInitials(fullName) {
        if (!fullName) return '??';
        const parts = fullName.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    // ============================================================
    // 5. FONCTION : CLASSE DU RÔLE
    // ============================================================

    function getRoleClass(role) {
        if (role === 'ADMIN') return 'role-admin';
        if (role === 'SUPERVISEUR') return 'role-superviseur';
        if (role === 'AGENT') return 'role-agent';
        if (role === 'GARAGE') return 'role-garage';
        if (role === 'DGI') return 'role-dgi';
        return 'role-agent';
    }

    // ============================================================
    // 6. BOUTON "MODIFIER MON PROFIL"
    // ============================================================

    const editBtn = document.querySelector('.profile-actions .btn-secondary');
    if (editBtn) {
        editBtn.addEventListener('click', function () {
            showNotification('Fonction de modification à venir', 'edit');
        });
    }

    // ============================================================
    // 7. BOUTON "CHANGER MON MOT DE PASSE"
    // ============================================================

    const passwordBtn = document.querySelectorAll('.profile-actions .btn-secondary')[1];
    if (passwordBtn) {
        passwordBtn.addEventListener('click', function () {
            const newPassword = prompt('Entrez votre nouveau mot de passe :');
            if (!newPassword || newPassword.length < 6) {
                if (newPassword) showNotification('Le mot de passe doit contenir au moins 6 caractères.', 'error');
                return;
            }

            // Mettre à jour dans localStorage
            const users = JSON.parse(localStorage.getItem('kapitrans-users') || '{}');
            if (users[user.email]) {
                users[user.email].password = newPassword;
                localStorage.setItem('kapitrans-users', JSON.stringify(users));
                showNotification('Mot de passe modifié avec succès', 'success');
            }
        });
    }

    // ============================================================
    // 8. AFFICHER UNE NOTIFICATION
    // ============================================================

    function showNotification(message, iconName) {
        const type = iconName === 'error' ? 'error' : iconName === 'success' ? 'success' : 'info';
        window.kapitransToast(message, type, iconName);
    }

});