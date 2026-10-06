// ============================================================
// USERS — KAPITRANS
// ============================================================
// Ce fichier affiche la liste des utilisateurs.
// Seul le compte administrateur est prédéfini.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE TABLEAU
    // ============================================================

    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // ============================================================
    // 2. UTILISATEURS EN DUR
    // ============================================================

    const DEFAULT_USERS = [
        {
            nom: 'KAPITRANS',
            prenom: 'Admin',
            email: 'kapitrans.admin@kapitrans.cd',
            role: 'Administrateur',
            statut: 'Actif',
            id: 'kapitrans.admin@kapitrans.cd'
        }
    ];

    // ============================================================
    // 3. RÉCUPÉRER LES UTILISATEURS CRÉÉS
    // ============================================================

    function readStoredObject(key) {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        if (!value || Array.isArray(value) || typeof value !== 'object') {
            throw new Error(`${key} doit contenir un objet.`);
        }
        return value;
    }

    function getStoredUsers() {
        const stored = readStoredObject('kapitrans-users');

        return Object.entries(stored)
            .filter(function ([email]) { return email.toLowerCase() !== 'kapitrans.admin@kapitrans.cd'; })
            .map(function ([email, user]) {
            const parts = (user.nom || '').split(' ');

            return {
                id: user.id || email.toLowerCase(),
                nom: parts[0] || '',
                prenom: parts.slice(1).join(' ') || '',
                email: email,
                role: formatRole(user.role),
                statut: user.statut || 'Actif'
            };
        });
    }

    function getAllUsers() {
        const overrides = readStoredObject('kapitrans-user-overrides');
        const statuses = readStoredObject('kapitrans-user-statuses');

        return DEFAULT_USERS.concat(getStoredUsers()).map(function (user) {
            const id = user.id || user.email.toLowerCase();
            const updatedUser = overrides[id] || {};

            return {
                ...user,
                ...updatedUser,
                id: id,
                statut: statuses[id] || updatedUser.statut || user.statut || 'Actif'
            };
        });
    }

    // ============================================================
    // 4. FORMATER LE RÔLE
    // ============================================================

    function formatRole(role) {
        if (role === 'ADMIN') return 'Administrateur';
        if (role === 'AGENT') return 'Agent de contrôle';
        if (role === 'GARAGE') return 'Garage';
        if (role === 'SUPERVISEUR') return 'Superviseur';
        if (role === 'DGI') return 'DGI';
        return role;
    }

    // ============================================================
    // 5. CLASSE DU RÔLE
    // ============================================================

    function getRoleClass(role) {
        if (role === 'Administrateur') return 'role-admin';
        if (role === 'Superviseur') return 'role-superviseur';
        if (role === 'Agent de contrôle') return 'role-agent';
        if (role === 'Garage') return 'role-garage';
        if (role === 'DGI') return 'role-dgi';
        return 'role-agent';
    }

    const actionIcons = {
        view: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
        edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>',
        deactivate: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
        activate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
    };

    tbody.replaceChildren();

    function createActionButton(action, user) {
        const button = document.createElement('button');
        const isActive = user.statut === 'Actif';
        const label = action === 'view' ? 'Voir' : action === 'edit' ? 'Modifier' : isActive ? 'Désactiver' : 'Activer';
        const actionName = action === 'toggle' ? (isActive ? 'deactivate' : 'activate') : action;

        button.type = 'button';
        button.className = `btn-action btn-${actionName}`;
        button.dataset.action = action;
        button.dataset.userId = user.id;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = actionIcons[actionName];
        return button;
    }

    // ============================================================
    // 6. AFFICHER LES UTILISATEURS
    // ============================================================

    function renderUsers() {
        const allUsers = getAllUsers();
        const fragment = document.createDocumentFragment();
        const statValues = [
            allUsers.length,
            allUsers.filter(user => user.statut === 'Actif').length,
            new Set(allUsers.map(user => user.role).filter(Boolean)).size,
            allUsers.filter(user => user.statut !== 'Actif').length
        ];
        document.querySelectorAll('.users-stats-grid .stat-number').forEach(function (element, index) {
            element.textContent = String(statValues[index] || 0);
        });

        allUsers.forEach(function (user) {
            const tr = document.createElement('tr');
            const statusClass = user.statut === 'Actif' ? 'status-active' : 'status-inactive';
            tr.dataset.userId = user.id;

            const nameCell = document.createElement('td');
            const name = document.createElement('strong');
            name.textContent = user.nom;
            nameCell.appendChild(name);

            const firstNameCell = document.createElement('td');
            firstNameCell.textContent = user.prenom;

            const emailCell = document.createElement('td');
            emailCell.textContent = user.email;

            const roleCell = document.createElement('td');
            const roleBadge = document.createElement('span');
            roleBadge.className = `role-badge ${getRoleClass(user.role)}`;
            roleBadge.textContent = user.role;
            roleCell.appendChild(roleBadge);

            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge ${statusClass}`;
            statusBadge.textContent = user.statut;
            statusCell.appendChild(statusBadge);

            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-cell';
            actionsCell.append(
                createActionButton('view', user),
                createActionButton('edit', user),
                createActionButton('toggle', user)
            );

            tr.append(nameCell, firstNameCell, emailCell, roleCell, statusCell, actionsCell);
            fragment.appendChild(tr);
        });

        tbody.replaceChildren(fragment);
    }

    const userDialog = document.createElement('dialog');
    userDialog.className = 'user-dialog';
    document.body.appendChild(userDialog);

    function closeUserDialog() {
        if (userDialog.open) userDialog.close();
    }

    function showUserDialog(user, mode) {
        const isEditing = mode === 'edit';
        userDialog.innerHTML = `
            <div class="user-dialog-header">
                <h2>${isEditing ? 'Modifier l’utilisateur' : 'Détails de l’utilisateur'}</h2>
                <button class="user-dialog-close" type="button" aria-label="Fermer">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
                </button>
            </div>
            ${isEditing ? `
                <form class="user-edit-form">
                    <label>Nom<input name="nom" required></label>
                    <label>Prénom<input name="prenom" required></label>
                    <label>Email<input name="email" type="email" required></label>
                    <label>Rôle<select name="role" required>
                        <option>Administrateur</option>
                        <option>Superviseur</option>
                        <option>Agent de contrôle</option>
                        <option>Agent d'enregistrement</option>
                        <option>Garage</option>
                        <option>DGI</option>
                    </select></label>
                    <div class="user-dialog-actions">
                        <button class="btn-secondary user-dialog-cancel" type="button">Annuler</button>
                        <button class="btn-primary" type="submit">Enregistrer</button>
                    </div>
                </form>
            ` : `
                <dl class="user-details">
                    <div><dt>Nom</dt><dd data-field="nom"></dd></div>
                    <div><dt>Prénom</dt><dd data-field="prenom"></dd></div>
                    <div><dt>Email</dt><dd data-field="email"></dd></div>
                    <div><dt>Rôle</dt><dd data-field="role"></dd></div>
                    <div><dt>Statut</dt><dd data-field="statut"></dd></div>
                </dl>
            `}
        `;

        userDialog.querySelector('.user-dialog-close').addEventListener('click', closeUserDialog);
        userDialog.addEventListener('click', function closeOnBackdrop(event) {
            if (event.target === userDialog) closeUserDialog();
        }, { once: true });

        if (isEditing) {
            const form = userDialog.querySelector('.user-edit-form');
            form.elements.nom.value = user.nom;
            form.elements.prenom.value = user.prenom;
            form.elements.email.value = user.email;
            if (![...form.elements.role.options].some(option => option.value === user.role)) {
                const roleOption = document.createElement('option');
                roleOption.value = user.role;
                roleOption.textContent = user.role;
                form.elements.role.appendChild(roleOption);
            }
            form.elements.role.value = user.role;
            userDialog.querySelector('.user-dialog-cancel').addEventListener('click', closeUserDialog);
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                saveUser(user, form);
            });
        } else {
            Object.entries(user).forEach(function ([field, value]) {
                const target = userDialog.querySelector(`[data-field="${field}"]`);
                if (target) target.textContent = value;
            });
        }

        userDialog.showModal();
    }

    function saveUser(user, form) {
        const nom = form.elements.nom.value.trim();
        const prenom = form.elements.prenom.value.trim();
        const email = form.elements.email.value.trim().toLowerCase();
        const role = form.elements.role.value;
        const duplicate = getAllUsers().some(function (otherUser) {
            return otherUser.id !== user.id && otherUser.email.toLowerCase() === email;
        });

        if (duplicate) {
            window.kapitransToast('Cette adresse email est déjà utilisée.', 'error');
            return;
        }

        const overrides = readStoredObject('kapitrans-user-overrides');
        overrides[user.id] = { ...overrides[user.id], nom, prenom, email, role };
        localStorage.setItem('kapitrans-user-overrides', JSON.stringify(overrides));

        const storedUsers = readStoredObject('kapitrans-users');
        const storedKey = Object.keys(storedUsers).find(function (key) {
            return key.toLowerCase() === user.email.toLowerCase() || storedUsers[key].id === user.id;
        });
        if (storedKey) {
            const storedUser = storedUsers[storedKey];
            storedUser.id = user.id;
            storedUser.nom = `${nom} ${prenom}`;
            storedUser.role = {
                Administrateur: 'ADMIN',
                Superviseur: 'SUPERVISEUR',
                'Agent de contrôle': 'AGENT',
                Garage: 'GARAGE',
                DGI: 'DGI'
            }[role] || role;
            delete storedUsers[storedKey];
            storedUsers[email] = storedUser;
            localStorage.setItem('kapitrans-users', JSON.stringify(storedUsers));
        }

        closeUserDialog();
        renderUsers();
        filterUsers();
    }

    tbody.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const user = getAllUsers().find(userEntry => userEntry.id === button.dataset.userId);
        if (!user) return;

        if (button.dataset.action === 'view' || button.dataset.action === 'edit') {
            showUserDialog(user, button.dataset.action);
            return;
        }

        const nextStatus = user.statut === 'Actif' ? 'Inactif' : 'Actif';
        const confirmation = nextStatus === 'Inactif'
            ? `Désactiver le compte de ${user.prenom} ${user.nom} ?`
            : `Réactiver le compte de ${user.prenom} ${user.nom} ?`;
        if (!window.confirm(confirmation)) return;

        const statuses = readStoredObject('kapitrans-user-statuses');
        statuses[user.id] = nextStatus;
        localStorage.setItem('kapitrans-user-statuses', JSON.stringify(statuses));
        renderUsers();
        filterUsers();
    });

    // ============================================================
    // 7. RECHERCHE ET FILTRES
    // ============================================================

    const searchInput = document.querySelector('.search-input');
    const filterRole = document.querySelectorAll('.filter-select')[0];
    const filterStatus = document.querySelectorAll('.filter-select')[1];

    function filterUsers() {
        const search = (searchInput?.value || '').toLowerCase().trim();
        const role = filterRole?.value || '';
        const status = filterStatus?.value || '';

        const rows = tbody.querySelectorAll('tr');

        rows.forEach(function (row) {
            const cells = row.querySelectorAll('td');
            const nom = (cells[0]?.textContent || '').toLowerCase();
            const prenom = (cells[1]?.textContent || '').toLowerCase();
            const email = (cells[2]?.textContent || '').toLowerCase();
            const roleText = (cells[3]?.textContent || '').toLowerCase();
            const statusText = (cells[4]?.textContent || '').toLowerCase();

            const matchSearch = !search ||
                nom.includes(search) ||
                prenom.includes(search) ||
                email.includes(search);

            const roleTerms = {
                admin: 'administrateur',
                superviseur: 'superviseur',
                agent: 'agent',
                enregistreur: "agent d'enregistrement",
                garage: 'garage',
                dgi: 'dgi'
            };
            const matchRole = !role || roleText.includes(roleTerms[role] || role.toLowerCase());
            const matchStatus = !status || statusText.includes(status.toLowerCase());

            if (matchSearch && matchRole && matchStatus) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterUsers);
    }
    if (filterRole) {
        filterRole.addEventListener('change', filterUsers);
    }
    if (filterStatus) {
        filterStatus.addEventListener('change', filterUsers);
    }

    // ============================================================
    // 8. INITIALISATION
    // ============================================================

    renderUsers();

});