// ============================================================
// CREATE USER — KAPITRANS
// ============================================================
// Ce fichier enregistre un nouvel utilisateur dans localStorage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE FORMULAIRE
    // ============================================================

    const form = document.getElementById('create-user-form');
    if (!form) return;

    // ============================================================
    // 2. ÉCOUTER LA SOUMISSION
    // ============================================================

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // ============================================================
        // 3. RÉCUPÉRER LES VALEURS
        // ============================================================

        const nom = form.querySelector('input[name="nom"]').value.trim();
        const prenom = form.querySelector('input[name="prenom"]').value.trim();
        const email = form.querySelector('input[name="email"]').value.trim().toLowerCase();
        const telephone = form.querySelector('input[name="telephone"]').value.trim();
        const role = form.querySelector('select[name="role"]').value;
        const zone = form.querySelector('input[name="zone"]').value.trim();
        const password = form.querySelector('input[name="password"]').value;
        const passwordConfirm = form.querySelector('input[name="password-confirm"]').value;

        // ============================================================
        // 4. VÉRIFIER LES CHAMPS
        // ============================================================

        if (!nom || !prenom || !email || !role || !password) {
            showMessage('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }

        if (email === 'kapitrans.admin@kapitrans.cd') {
            showMessage('Cette adresse est réservée au compte administrateur prédéfini.', 'error');
            return;
        }

        if (password !== passwordConfirm) {
            showMessage('Les mots de passe ne correspondent pas.', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage('Le mot de passe doit contenir au moins 6 caractères.', 'error');
            return;
        }

        // ============================================================
        // 5. DÉFINIR LA REDIRECTION SELON LE RÔLE
        // ============================================================

        let redirect = 'agent-search.html';
        let roleLabel = 'AGENT';

        if (role === 'Administrateur') {
            redirect = 'admin-dashboard.html';
            roleLabel = 'ADMIN';
        } else if (role === 'Superviseur') {
            redirect = 'admin-dashboard.html';
            roleLabel = 'SUPERVISEUR';
        } else if (role === 'Agent de contrôle') {
            redirect = 'agent-search.html';
            roleLabel = 'AGENT';
        } else if (role === 'Garage') {
            redirect = 'admin-dashboard.html';
            roleLabel = 'GARAGE';
        } else if (role === 'DGI') {
            redirect = 'admin-dashboard.html';
            roleLabel = 'DGI';
        }

        // ============================================================
        // 6. CRÉER L'UTILISATEUR
        // ============================================================

        const newUser = {
            password: password,
            redirect: redirect,
            nom: nom + ' ' + prenom,
            role: roleLabel,
            telephone: telephone,
            zone: zone,
            statut: 'Actif',
            dateCreation: new Date().toISOString()
        };

        // ============================================================
        // 7. VÉRIFIER SI L'EMAIL EXISTE DÉJÀ
        // ============================================================

        const users = JSON.parse(localStorage.getItem('kapitrans-users') || '{}');

        if (users[email]) {
            showMessage('Cet email est déjà utilisé.', 'error');
            return;
        }

        // ============================================================
        // 8. AJOUTER L'UTILISATEUR
        // ============================================================

        users[email] = newUser;
        localStorage.setItem('kapitrans-users', JSON.stringify(users));
        let auditFailed = false;
        try {
            const session = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
            window.kapitransAudit?.add(session?.nom, 'Création utilisateur', 'create', 'USER', email);
        } catch (error) {
            auditFailed = true;
            console.error('Utilisateur enregistré, mais le journal d’audit n’a pas pu être actualisé.', error);
        }

        // ============================================================
        // 9. SUCCÈS
        // ============================================================

        showMessage(auditFailed
            ? 'Utilisateur créé, mais le journal d’audit n’a pas pu être actualisé.'
            : 'Utilisateur créé avec succès !', 'success');

        // Rediriger après 1,5 seconde
        setTimeout(function () {
            window.location.href = 'admin-users.html';
        }, 1500);
    });

    // ============================================================
    // 10. AFFICHER UN MESSAGE
    // ============================================================

    function showMessage(message, type) {
        window.kapitransToast(message, type);
    }

});