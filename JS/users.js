import { db } from './firebase.js';
import { collection, doc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    let users = [];

    // Fonction pour afficher les utilisateurs depuis Firebase
    async function renderUsers() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement des données...</td></tr>';

        try {
            // On va chercher la collection "users" dans Firestore
            const querySnapshot = await getDocs(collection(db, "users"));

            const totalUsers = querySnapshot.size;
            users = querySnapshot.docs.map((userDoc) => ({
                id: userDoc.id,
                ...userDoc.data()
            }));
            const inactiveUsers = users.filter((user) =>
                String(user.statut || '').trim().toLowerCase() === 'inactif'
            ).length;
            const activeUsers = totalUsers - inactiveUsers;
            const availableRoles = new Set(
                users
                    .map((user) => user.role)
                    .filter((role) => typeof role === 'string' && role.trim())
            ).size;
            const counters = document.querySelectorAll('.users-stats-grid .stat-number');
            if (counters.length > 0) {
                counters[0].textContent = totalUsers;
            }
            if (counters.length > 1) {
                counters[1].textContent = activeUsers;
            }
            if (counters.length > 2) {
                counters[2].textContent = availableRoles;
            }
            if (counters.length > 3) {
                counters[3].textContent = inactiveUsers;
            }

            tbody.innerHTML = '';

            if (querySnapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Aucun utilisateur trouvé.</td></tr>';
                return;
            }

            users.forEach((user) => {

                // Formater le rôle pour l'affichage
                let roleLabel = user.role;
                let roleClass = 'role-agent';

                if (user.role === 'ADMIN') { roleLabel = 'Administrateur'; roleClass = 'role-admin'; }
                else if (user.role === 'AGENT') { roleLabel = 'Agent de contrôle'; roleClass = 'role-agent'; }
                else if (user.role === 'GARAGE') { roleLabel = 'Garage'; roleClass = 'role-garage'; }
                else if (user.role === 'SUPERVISEUR') { roleLabel = 'Superviseur'; roleClass = 'role-superviseur'; }
                else if (user.role === 'DGI') { roleLabel = 'DGI'; roleClass = 'role-dgi'; }

                // Séparer le nom et le prénom (le premier mot est le nom, le reste est le prénom)
                const parts = (user.nom || '').split(' ');
                const nom = parts[0] || '—';
                const prenom = parts.slice(1).join(' ') || '—';
                const isInactive = String(user.statut || '').trim().toLowerCase() === 'inactif';
                const statusClass = isInactive ? 'status-inactive' : 'status-active';
                const statusLabel = isInactive ? 'Inactif' : 'Actif';

                const tr = document.createElement('tr');
                tr.dataset.userId = user.id;

                const nameCell = document.createElement('td');
                const nameElement = document.createElement('strong');
                nameElement.textContent = nom;
                nameCell.appendChild(nameElement);

                const firstNameCell = document.createElement('td');
                firstNameCell.textContent = prenom;

                const emailCell = document.createElement('td');
                emailCell.textContent = user.email || '—';

                const roleCell = document.createElement('td');
                const roleBadge = document.createElement('span');
                roleBadge.className = `role-badge ${roleClass}`;
                roleBadge.textContent = roleLabel || '—';
                roleCell.appendChild(roleBadge);

                const statusCell = document.createElement('td');
                const statusBadge = document.createElement('span');
                statusBadge.className = `status-badge ${statusClass}`;
                statusBadge.textContent = statusLabel;
                statusCell.appendChild(statusBadge);

                const actionsCell = document.createElement('td');
                actionsCell.className = 'actions-cell';
                const actionButtons = [
                    {
                        action: 'view',
                        label: 'Voir',
                        className: 'btn-view',
                        icon: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
                    },
                    {
                        action: 'edit',
                        label: 'Modifier',
                        className: 'btn-edit',
                        icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>'
                    },
                    {
                        action: 'toggle-status',
                        label: isInactive ? 'Activer' : 'Désactiver',
                        className: isInactive ? 'btn-activate' : 'btn-delete',
                        icon: isInactive
                            ? '<path d="m5 12 4 4L19 6"/>'
                            : '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'
                    }
                ];
                actionButtons.forEach(({ action, label, className, icon }) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = `btn-action ${className}`;
                    button.dataset.action = action;
                    button.dataset.userId = user.id;
                    button.title = label;
                    button.setAttribute('aria-label', label);
                    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
                    actionsCell.appendChild(button);
                });

                tr.append(nameCell, firstNameCell, emailCell, roleCell, statusCell, actionsCell);
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error("Erreur Firebase :", error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement. Vérifiez la console (F12).</td></tr>';
        }
    }

    const userDialog = document.createElement('dialog');
    userDialog.className = 'user-dialog';
    document.body.appendChild(userDialog);

    function closeUserDialog() {
        if (userDialog.open) userDialog.close();
    }

    function showUserDialog(user, editing) {
        const fullName = user.nom || '';
        const nameParts = fullName.split(' ');
        const nom = nameParts.shift() || '';
        const prenom = nameParts.join(' ');

        userDialog.innerHTML = `
            <div class="user-dialog-header">
                <h2>${editing ? 'Modifier l’utilisateur' : 'Détails de l’utilisateur'}</h2>
                <button class="user-dialog-close" type="button" aria-label="Fermer">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
                </button>
            </div>
            ${editing ? `
                <form class="user-edit-form">
                    <label>Nom<input name="nom" required></label>
                    <label>Prénom<input name="prenom"></label>
                    <label>Email<input name="email" type="email" disabled></label>
                    <label>Rôle<select name="role" required>
                        <option value="ADMIN">Administrateur</option>
                        <option value="SUPERVISEUR">Superviseur</option>
                        <option value="AGENT">Agent de contrôle</option>
                        <option value="GARAGE">Garage</option>
                        <option value="DGI">DGI</option>
                    </select></label>
                    <label>Téléphone<input name="telephone"></label>
                    <label>Zone<input name="zone"></label>
                    <p class="user-edit-error" role="alert"></p>
                    <div class="user-dialog-actions">
                        <button class="btn-secondary user-dialog-cancel" type="button">Annuler</button>
                        <button class="btn-primary" type="submit">Enregistrer</button>
                    </div>
                </form>
            ` : `
                <dl class="user-details">
                    <div><dt>Nom</dt><dd data-field="nom"></dd></div>
                    <div><dt>Email</dt><dd data-field="email"></dd></div>
                    <div><dt>Rôle</dt><dd data-field="role"></dd></div>
                    <div><dt>Statut</dt><dd data-field="statut"></dd></div>
                    <div><dt>Téléphone</dt><dd data-field="telephone"></dd></div>
                    <div><dt>Zone</dt><dd data-field="zone"></dd></div>
                </dl>
            `}
        `;

        userDialog.querySelector('.user-dialog-close').addEventListener('click', closeUserDialog);
        userDialog.querySelector('.user-dialog-cancel')?.addEventListener('click', closeUserDialog);

        if (editing) {
            const form = userDialog.querySelector('.user-edit-form');
            form.elements.nom.value = nom;
            form.elements.prenom.value = prenom;
            form.elements.email.value = user.email || '';
            form.elements.role.value = user.role || 'AGENT';
            form.elements.telephone.value = user.telephone || '';
            form.elements.zone.value = user.zone || '';
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const submitButton = form.querySelector('[type="submit"]');
                submitButton.disabled = true;
                userDialog.querySelector('.user-edit-error').textContent = '';

                try {
                    await updateDoc(doc(db, 'users', user.id), {
                        nom: `${form.elements.nom.value.trim()} ${form.elements.prenom.value.trim()}`.trim(),
                        role: form.elements.role.value,
                        telephone: form.elements.telephone.value.trim(),
                        zone: form.elements.zone.value.trim()
                    });
                    closeUserDialog();
                    await renderUsers();
                } catch (error) {
                    console.error('Impossible de modifier le profil utilisateur.', error);
                    userDialog.querySelector('.user-edit-error').textContent = 'La modification a échoué. Vérifiez vos droits et réessayez.';
                    submitButton.disabled = false;
                }
            });
        } else {
            const roleLabels = {
                ADMIN: 'Administrateur',
                AGENT: 'Agent de contrôle',
                GARAGE: 'Garage',
                SUPERVISEUR: 'Superviseur',
                DGI: 'DGI'
            };
            const fields = {
                nom: user.nom || '—',
                email: user.email || '—',
                role: roleLabels[user.role] || user.role || '—',
                statut: String(user.statut || '').toLowerCase() === 'inactif' ? 'Inactif' : 'Actif',
                telephone: user.telephone || '—',
                zone: user.zone || '—'
            };
            Object.entries(fields).forEach(([field, value]) => {
                userDialog.querySelector(`[data-field="${field}"]`).textContent = value;
            });
        }

        userDialog.showModal();
    }

    tbody.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const user = users.find((entry) => entry.id === button.dataset.userId);
        if (!user) return;

        if (button.dataset.action === 'view') {
            showUserDialog(user, false);
            return;
        }
        if (button.dataset.action === 'edit') {
            showUserDialog(user, true);
            return;
        }

        const isInactive = String(user.statut || '').toLowerCase() === 'inactif';
        const nextStatus = isInactive ? 'Actif' : 'Inactif';
        const userName = user.nom || user.email || 'cet utilisateur';
        if (!window.confirm(`${isInactive ? 'Activer' : 'Désactiver'} le compte de ${userName} ?`)) return;

        button.disabled = true;
        try {
            await updateDoc(doc(db, 'users', user.id), { statut: nextStatus });
            await renderUsers();
        } catch (error) {
            console.error('Impossible de modifier le statut utilisateur.', error);
            window.alert('La modification du statut a échoué. Vérifiez vos droits et réessayez.');
            button.disabled = false;
        }
    });

    // Lancer l'affichage
    renderUsers();
});
