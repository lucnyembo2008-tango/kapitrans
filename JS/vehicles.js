import { db } from './firebase.js';
import { logAudit } from './audit-log.js';
import { collection, deleteDoc, doc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const searchInput = document.querySelector('.search-input');
    const filters = document.querySelectorAll('.filter-select');
    const filterStatus = filters[0];
    const filterCategory = filters[1];
    const counters = document.querySelectorAll('.vehicles-stats-grid .stat-number');
    let vehicles = [];

    function updateCounters() {
        const values = [
            vehicles.length,
            vehicles.filter((vehicle) => vehicle.statut === 'conforme').length,
            vehicles.filter((vehicle) => vehicle.statut === 'surveiller').length,
            vehicles.filter((vehicle) => vehicle.statut === 'non-conforme').length
        ];
        counters.forEach((counter, index) => {
            counter.textContent = String(values[index] || 0);
        });
    }

    function filterVehicles() {
        const search = (searchInput?.value || '').trim().toLowerCase();
        const status = filterStatus?.value || '';
        const category = filterCategory?.value || '';

        tbody.querySelectorAll('tr[data-vehicle-id]').forEach((row) => {
            const vehicle = vehicles.find((entry) => entry.id === row.dataset.vehicleId);
            if (!vehicle) return;
            const searchableText = [
                vehicle.matricule,
                vehicle.marque,
                vehicle.modele,
                vehicle.proprietaire
            ].join(' ').toLowerCase();
            const matchesSearch = !search || searchableText.includes(search);
            const matchesStatus = !status || vehicle.statut === status;
            const matchesCategory = !category || vehicle.categorie === category;
            row.hidden = !(matchesSearch && matchesStatus && matchesCategory);
        });
    }

    function appendActionButton(container, vehicle, action, label, className, icon) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn-action ${className}`;
        button.dataset.action = action;
        button.dataset.vehicleId = vehicle.id;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
        container.appendChild(button);
    }

    function createVehicleRow(vehicle) {
        const statusLabels = {
            conforme: ['status-conforme', 'Conforme'],
            surveiller: ['status-surveiller', 'À surveiller'],
            'non-conforme': ['status-non-conforme', 'Non conforme']
        };
        const [statusClass, statusLabel] = statusLabels[vehicle.statut] || statusLabels.conforme;
        const row = document.createElement('tr');
        row.dataset.vehicleId = vehicle.id;

        const matriculeCell = document.createElement('td');
        const matricule = document.createElement('strong');
        matricule.className = 'matricule';
        matricule.textContent = vehicle.matricule || '—';
        matriculeCell.appendChild(matricule);

        const makeCell = document.createElement('td');
        makeCell.textContent = [vehicle.marque, vehicle.modele].filter(Boolean).join(' ') || '—';

        const ownerCell = document.createElement('td');
        ownerCell.textContent = vehicle.proprietaire || '—';

        const categoryCell = document.createElement('td');
        categoryCell.textContent = vehicle.categorie || '—';

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${statusClass}`;
        statusBadge.textContent = statusLabel;
        statusCell.appendChild(statusBadge);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-cell';
        appendActionButton(actionsCell, vehicle, 'view', 'Voir', 'btn-view',
            '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>');
        appendActionButton(actionsCell, vehicle, 'edit', 'Modifier', 'btn-edit',
            '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>');
        appendActionButton(actionsCell, vehicle, 'map', 'Mapper', 'btn-map',
            '<path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Zm0-14v14m6-12v14"/>');
        appendActionButton(actionsCell, vehicle, 'delete', 'Supprimer', 'btn-delete',
            '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>');

        row.append(matriculeCell, makeCell, ownerCell, categoryCell, statusCell, actionsCell);
        return row;
    }

    function closeDialog(dialog) {
        if (dialog.open) dialog.close();
    }

    function addDialogHeader(dialog, title) {
        const header = document.createElement('div');
        header.className = 'user-dialog-header';
        const heading = document.createElement('h2');
        heading.textContent = title;
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'user-dialog-close';
        closeButton.setAttribute('aria-label', 'Fermer');
        closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
        closeButton.addEventListener('click', () => closeDialog(dialog));
        header.append(heading, closeButton);
        dialog.appendChild(header);
    }

    function showVehicleDialog(vehicle, editing) {
        const dialog = document.createElement('dialog');
        dialog.className = 'user-dialog';
        addDialogHeader(dialog, editing ? 'Modifier le véhicule' : 'Détails du véhicule');

        if (!editing) {
            const details = document.createElement('dl');
            details.className = 'user-details';
            const fields = [
                ['Matricule', vehicle.matricule],
                ['VIN / numéro de châssis', vehicle.vin],
                ['Marque / modèle', [vehicle.marque, vehicle.modele].filter(Boolean).join(' ')],
                ['Année', vehicle.annee],
                ['Couleur', vehicle.couleur],
                ['Catégorie', vehicle.categorie],
                ['Type', vehicle.type],
                ['Capacité', vehicle.capacite],
                ['Usage', vehicle.usage],
                ['Propriétaire', vehicle.proprietaire],
                ['Conducteur', vehicle.conducteur],
                ['Numéro du permis', vehicle.numeroPermis],
                ['Expiration du permis', vehicle.expirationPermis],
                ['Province', vehicle.province],
                ['Ville', vehicle.ville],
                ['Zone / quartier', vehicle.zone],
                ['Latitude', vehicle.lat],
                ['Longitude', vehicle.lng],
                ['Statut', vehicle.statut]
            ];
            fields.forEach(([label, value]) => {
                const item = document.createElement('div');
                const term = document.createElement('dt');
                term.textContent = label;
                const description = document.createElement('dd');
                description.textContent = value === undefined || value === null || value === '' ? '—' : String(value);
                item.append(term, description);
                details.appendChild(item);
            });
            if (vehicle.permisFichier?.url) {
                const item = document.createElement('div');
                const term = document.createElement('dt');
                term.textContent = 'Fichier du permis';
                const description = document.createElement('dd');
                const link = document.createElement('a');
                link.href = vehicle.permisFichier.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = vehicle.permisFichier.nom || 'Ouvrir le permis';
                description.appendChild(link);
                item.append(term, description);
                details.appendChild(item);
            }
            dialog.appendChild(details);
        } else {
            const form = document.createElement('form');
            form.className = 'user-edit-form';
            const fields = [
                ['matricule', 'Matricule', 'text', true],
                ['vin', 'VIN / numéro de châssis', 'text', true],
                ['marque', 'Marque', 'text', true],
                ['modele', 'Modèle', 'text', true],
                ['annee', 'Année', 'number', false],
                ['couleur', 'Couleur', 'text', false],
                ['categorie', 'Catégorie', 'select', true],
                ['type', 'Type', 'text', false],
                ['capacite', 'Capacité (passagers)', 'number', false],
                ['usage', 'Usage', 'select-usage', false],
                ['proprietaire', 'Propriétaire', 'text', false],
                ['province', 'Province', 'text', false],
                ['ville', 'Ville', 'text', false],
                ['zone', 'Zone / quartier', 'text', false],
                ['lat', 'Latitude', 'number', false],
                ['lng', 'Longitude', 'number', false],
                ['statut', 'Statut', 'select-status', true]
            ];
            const selectOptions = {
                categorie: [
                    ['', 'Sélectionner une catégorie'],
                    ['transport', 'Transport en commun'],
                    ['prive', 'Véhicule privé'],
                    ['camion', 'Camion'],
                    ['moto', 'Moto'],
                    ['taxi', 'Taxi']
                ],
                usage: [
                    ['', 'Sélectionner'],
                    ['public', 'Public'],
                    ['prive', 'Privé'],
                    ['commercial', 'Commercial']
                ],
                statut: [
                    ['conforme', 'Conforme'],
                    ['surveiller', 'À surveiller'],
                    ['non-conforme', 'Non conforme']
                ]
            };

            fields.forEach(([name, labelText, type, required]) => {
                const label = document.createElement('label');
                label.textContent = labelText;
                let input;
                if (type.startsWith('select')) {
                    input = document.createElement('select');
                    const optionKey = type === 'select-usage' ? 'usage' :
                        type === 'select-status' ? 'statut' : 'categorie';
                    selectOptions[optionKey].forEach(([value, text]) => {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent = text;
                        input.appendChild(option);
                    });
                } else {
                    input = document.createElement('input');
                    input.type = type;
                    if (name === 'lat' || name === 'lng') input.step = 'any';
                }
                input.name = name;
                input.required = required;
                input.value = vehicle[name] ?? '';
                label.appendChild(input);
                form.appendChild(label);
            });

            const locationButton = document.createElement('button');
            locationButton.type = 'button';
            locationButton.className = 'btn-secondary';
            locationButton.textContent = 'Utiliser ma position GPS';
            locationButton.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    error.textContent = 'La géolocalisation n’est pas disponible dans ce navigateur.';
                    return;
                }

                locationButton.disabled = true;
                error.textContent = 'Recherche de la position GPS...';
                navigator.geolocation.getCurrentPosition((position) => {
                    form.querySelector('[name="lat"]').value = position.coords.latitude;
                    form.querySelector('[name="lng"]').value = position.coords.longitude;
                    error.textContent = 'Position GPS récupérée. Enregistrez pour mettre à jour le véhicule.';
                    locationButton.disabled = false;
                }, (locationError) => {
                    error.textContent = locationError.code === locationError.PERMISSION_DENIED
                        ? 'Autorisez l’accès à votre position dans les paramètres du navigateur.'
                        : 'Impossible de récupérer la position GPS. Vérifiez la permission et réessayez.';
                    locationButton.disabled = false;
                }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
            });
            form.appendChild(locationButton);

            const error = document.createElement('p');
            error.className = 'vehicle-edit-error';
            error.setAttribute('role', 'alert');
            form.appendChild(error);

            const actions = document.createElement('div');
            actions.className = 'user-dialog-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn-secondary';
            cancel.textContent = 'Annuler';
            cancel.addEventListener('click', () => closeDialog(dialog));
            const save = document.createElement('button');
            save.type = 'submit';
            save.className = 'btn-primary';
            save.textContent = 'Enregistrer';
            actions.append(cancel, save);
            form.appendChild(actions);

            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                save.disabled = true;
                error.textContent = '';
                const values = Object.fromEntries(new FormData(form).entries());
                for (const field of ['annee', 'capacite', 'lat', 'lng']) {
                    if (values[field] !== '') values[field] = Number(values[field]);
                    else if (field === 'lat' || field === 'lng') values[field] = null;
                }
                values.matricule = values.matricule.trim().toUpperCase();
                values.proprietaire = values.proprietaire.trim();

                try {
                    await updateDoc(doc(db, 'vehicles', vehicle.id), values);
                    await logAudit({
                        actionType: 'update',
                        action: 'Modification',
                        entite: 'Véhicule',
                        details: `${values.matricule} — ${values.marque} ${values.modele}`
                    });
                    closeDialog(dialog);
                    dialog.remove();
                    await renderVehicles();
                } catch (updateError) {
                    console.error('Impossible de modifier le véhicule.', updateError);
                    error.textContent = 'La modification a échoué. Vérifiez vos droits et réessayez.';
                    save.disabled = false;
                }
            });
            dialog.appendChild(form);
        }

        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) closeDialog(dialog);
        });
        document.body.appendChild(dialog);
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        dialog.showModal();
    }

    async function renderVehicles() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement...</td></tr>';
        try {
            const querySnapshot = await getDocs(collection(db, 'vehicles'));
            vehicles = querySnapshot.docs.map((vehicleDoc) => ({
                id: vehicleDoc.id,
                ...vehicleDoc.data()
            }));
            updateCounters();
            tbody.replaceChildren();

            if (vehicles.length === 0) {
                const row = tbody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 6;
                cell.style.cssText = 'text-align: center; padding: 2rem; color: #94a3b8;';
                cell.textContent = 'Aucun véhicule enregistré.';
                return;
            }

            vehicles.forEach((vehicle) => tbody.appendChild(createVehicleRow(vehicle)));
            filterVehicles();
        } catch (error) {
            console.error('Erreur Firebase lors du chargement des véhicules :', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement.</td></tr>';
        }
    }

    tbody.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const vehicle = vehicles.find((entry) => entry.id === button.dataset.vehicleId);
        if (!vehicle) return;

        if (button.dataset.action === 'view') {
            showVehicleDialog(vehicle, false);
        } else if (button.dataset.action === 'edit') {
            showVehicleDialog(vehicle, true);
        } else if (button.dataset.action === 'map') {
            window.location.href = `admin-map.html?matricule=${encodeURIComponent(vehicle.matricule || '')}`;
        } else if (button.dataset.action === 'delete') {
            if (!window.confirm(`Supprimer le véhicule ${vehicle.matricule || ''} ?`)) return;
            button.disabled = true;
            try {
                await deleteDoc(doc(db, 'vehicles', vehicle.id));
                await logAudit({
                    actionType: 'delete',
                    action: 'Suppression',
                    entite: 'Véhicule',
                    details: `${vehicle.matricule || '—'} — ${vehicle.marque || ''} ${vehicle.modele || ''}`
                });
                await renderVehicles();
            } catch (error) {
                console.error('Impossible de supprimer le véhicule.', error);
                window.alert('La suppression a échoué. Vérifiez vos droits et réessayez.');
                button.disabled = false;
            }
        }
    });

    searchInput?.addEventListener('input', filterVehicles);
    filterStatus?.addEventListener('change', filterVehicles);
    filterCategory?.addEventListener('change', filterVehicles);

    renderVehicles();
});
