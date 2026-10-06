// ============================================================
// VEHICLES — KAPITRANS
// ============================================================
// Ce fichier affiche la liste des véhicules.
// Tous les véhicules sont chargés depuis localStorage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE TABLEAU
    // ============================================================

    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    tbody.replaceChildren();

    // ============================================================
    // 3. RÉCUPÉRER LES VÉHICULES CRÉÉS
    // ============================================================

    function readStoredValue(key, fallback) {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    }

    async function geocodeVehicleZone(zone, vehicle) {
        const province = String(vehicle.province || 'kinshasa').replace(/(^|-)([a-z])/g, function (match, separator, letter) {
            return separator + letter.toUpperCase();
        });
        const query = [zone, vehicle.ville, province, 'République démocratique du Congo'].filter(Boolean).join(', ');
        const params = new URLSearchParams({
            q: query,
            format: 'jsonv2',
            limit: '1',
            countrycodes: 'cd'
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: { 'Accept-Language': 'fr' }
        });
        if (!response.ok) throw new Error(`Géocodage refusé (${response.status}).`);
        const results = await response.json();
        const latitude = Number(results[0]?.lat);
        const longitude = Number(results[0]?.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new Error('Zone introuvable.');
        }
        return { latitude: latitude, longitude: longitude };
    }

    function getAllVehicles() {
        const stored = readStoredValue('kapitrans-vehicles', {});
        if (!stored || Array.isArray(stored) || typeof stored !== 'object') {
            throw new Error('Le registre des véhicules doit contenir un objet.');
        }
        const documents = readStoredValue('kapitrans-documents', []);
        if (!Array.isArray(documents)) throw new Error('Le registre des documents doit contenir une liste.');
        return Object.entries(stored).map(function ([storageKey, vehicle]) {
            const matricule = vehicle.matricule || storageKey;
            const relatedStatuses = documents
                .filter(documentRecord => String(documentRecord.matricule || '').toUpperCase() === String(matricule).toUpperCase())
                .map(getDocumentStatus);
            const embeddedStatuses = Object.values(vehicle.documents || {})
                .filter(documentRecord => documentRecord && (documentRecord.numero || documentRecord.expiration || documentRecord.dateExpiration))
                .map(getDocumentStatus);
            const statuses = [vehicle.statut || 'conforme', ...relatedStatuses, ...embeddedStatuses];
            const status = statuses.includes('non-conforme') ? 'non-conforme' :
                statuses.includes('surveiller') ? 'surveiller' : 'conforme';
            return {
                matricule: matricule,
                marque: [vehicle.marque, vehicle.modele].filter(Boolean).join(' '),
                proprietaire: typeof vehicle.proprietaire === 'string' ? vehicle.proprietaire : vehicle.proprietaire?.nom || '',
                categorie: vehicle.categorie || '',
                statut: status,
                province: vehicle.province || 'kinshasa',
                ville: vehicle.ville || '',
                zone: vehicle.zone || '',
                lat: vehicle.lat == null ? '' : String(vehicle.lat),
                lng: vehicle.lng == null ? '' : String(vehicle.lng),
                zoneGeocodeKey: vehicle.zoneGeocodeKey || '',
                _key: storageKey,
                _source: 'stored'
            };
        });
    }

    function getDocumentStatus(documentRecord) {
        const expiration = documentRecord.dateExpiration || documentRecord.expiration;
        if (expiration) {
            const date = String(expiration);
            const expiry = new Date(date + (date.length === 10 ? 'T23:59:59' : ''));
            if (!Number.isNaN(expiry.getTime())) {
                const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
                return days < 0 ? 'non-conforme' : days < 30 ? 'surveiller' : 'conforme';
            }
        }
        if (documentRecord.statut === 'expire') return 'non-conforme';
        if (documentRecord.statut === 'bientot') return 'surveiller';
        if (documentRecord.statut === 'non-conforme' || documentRecord.statut === 'surveiller') return documentRecord.statut;
        return documentRecord.statut === 'valide' || documentRecord.statut === 'conforme' ? 'conforme' : 'surveiller';
    }

    // ============================================================
    // 4. FORMATER LE STATUT
    // ============================================================

    function getStatusBadge(statut) {
        if (statut === 'conforme') {
            return '<span class="status-badge status-conforme"><svg class="status-dot-svg" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5"/></svg>Conforme</span>';
        }
        if (statut === 'surveiller') {
            return '<span class="status-badge status-surveiller"><svg class="status-dot-svg" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5"/></svg>À surveiller</span>';
        }
        if (statut === 'non-conforme') {
            return '<span class="status-badge status-non-conforme"><svg class="status-dot-svg" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5"/></svg>Non conforme</span>';
        }
        return '<span class="status-badge">' + escapeHtml(statut || '—') + '</span>';
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
        });
    }

    // ============================================================
    // 5. AFFICHER LES VÉHICULES
    // ============================================================

    function renderVehicles() {
        const allVehicles = getAllVehicles();
        tbody.innerHTML = '';
        const statusCounts = [
            allVehicles.length,
            allVehicles.filter(vehicle => vehicle.statut === 'conforme').length,
            allVehicles.filter(vehicle => vehicle.statut === 'surveiller').length,
            allVehicles.filter(vehicle => vehicle.statut === 'non-conforme').length
        ];
        document.querySelectorAll('.vehicles-stats-grid .stat-number').forEach(function (element, index) {
            element.textContent = String(statusCounts[index] || 0);
        });
        if (allVehicles.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 6;
            cell.textContent = 'Aucun véhicule enregistré.';
            return;
        }

        allVehicles.forEach(function (v) {
            const tr = document.createElement('tr');
            tr.dataset.vehicleKey = v._key;
            tr.dataset.source = v._source;

            tr.innerHTML = `
                <td><strong class="matricule">${escapeHtml(v.matricule)}</strong></td>
                <td>${escapeHtml(v.marque)}</td>
                <td>${escapeHtml(v.proprietaire)}</td>
                <td>${escapeHtml(v.categorie)}</td>
                <td>${getStatusBadge(v.statut)}</td>
                <td class="actions-cell">
                    <button class="btn-action btn-view" type="button" title="Voir" aria-label="Voir">${window.kapitransIcon('view').outerHTML}</button>
                    <button class="btn-action btn-edit" type="button" title="Modifier" aria-label="Modifier">${window.kapitransIcon('edit').outerHTML}</button>
                    <button class="btn-action btn-map" type="button" title="Mapper" data-matricule="${escapeHtml(v.matricule)}" aria-label="Mapper">${window.kapitransIcon('map').outerHTML}</button>
                    <button class="btn-action btn-delete" type="button" title="Supprimer" aria-label="Supprimer">${window.kapitransIcon('delete').outerHTML}</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    // ============================================================
    // 6. RECHERCHE ET FILTRES
    // ============================================================

    const searchInput = document.querySelector('.search-input');
    const filterStatut = document.querySelectorAll('.filter-select')[0];
    const filterCategorie = document.querySelectorAll('.filter-select')[1];

    function filterVehicles() {
        const search = (searchInput?.value || '').toLowerCase().trim();
        const statut = filterStatut?.value || '';
        const categorie = filterCategorie?.value || '';

        const rows = tbody.querySelectorAll('tr');

        rows.forEach(function (row) {
            const cells = row.querySelectorAll('td');
            const matricule = (cells[0]?.textContent || '').toLowerCase();
            const marque = (cells[1]?.textContent || '').toLowerCase();
            const proprietaire = (cells[2]?.textContent || '').toLowerCase();
            const catText = (cells[3]?.textContent || '').toLowerCase();
            const statutText = (cells[4]?.textContent || '').toLowerCase();

            const matchSearch = !search ||
                matricule.includes(search) ||
                marque.includes(search) ||
                proprietaire.includes(search);

            const matchStatut = !statut || statutText.includes(statut.toLowerCase());
            const matchCategorie = !categorie || catText.includes(categorie.toLowerCase());

            if (matchSearch && matchStatut && matchCategorie) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterVehicles);
    }
    if (filterStatut) {
        filterStatut.addEventListener('change', filterVehicles);
    }
    if (filterCategorie) {
        filterCategorie.addEventListener('change', filterVehicles);
    }

    tbody.addEventListener('click', function (event) {
        const button = event.target.closest('.btn-action');
        if (!button) return;

        const row = button.closest('tr');
        const vehicle = getAllVehicles().find(item => item._key === row?.dataset.vehicleKey && item._source === row?.dataset.source);
        if (!vehicle) return;

        if (button.classList.contains('btn-map')) {
            window.location.href = 'admin-map.html?matricule=' + encodeURIComponent(vehicle.matricule);
            return;
        }

        if (button.classList.contains('btn-view')) {
            window.kapitransRecordDialog('Détails du véhicule', [
                { label: 'Matricule', value: vehicle.matricule },
                { label: 'Marque / modèle', value: vehicle.marque },
                { label: 'Propriétaire', value: vehicle.proprietaire },
                { label: 'Catégorie', value: vehicle.categorie },
                { label: 'Statut', value: vehicle.statut }
            ]);
            return;
        }

        if (button.classList.contains('btn-edit')) {
            window.kapitransRecordDialog('Modifier le véhicule', [
                { name: 'marque', label: 'Marque / modèle', value: vehicle.marque, required: true },
                { name: 'proprietaire', label: 'Propriétaire', value: vehicle.proprietaire },
                { name: 'categorie', label: 'Catégorie', value: vehicle.categorie },
                { name: 'zone', label: 'Zone / quartier', value: vehicle.zone },
                {
                    name: 'statut', label: 'Statut', value: vehicle.statut, options: [
                        { value: 'conforme', label: 'Conforme' },
                        { value: 'surveiller', label: 'À surveiller' },
                        { value: 'non-conforme', label: 'Non conforme' }
                    ]
                }
            ], async function (values) {
                const zone = values.zone.trim();
                const zoneChanged = zone !== String(vehicle.zone || '').trim();
                const hasCoordinates = vehicle.lat !== '' && vehicle.lng !== '' &&
                    Number.isFinite(Number(vehicle.lat)) && Number.isFinite(Number(vehicle.lng));
                const locationKey = [zone, vehicle.ville, vehicle.province].map(function (part) {
                    return String(part || '').trim().toLowerCase();
                }).join('|');
                let location = null;
                if (zone && (zoneChanged || !hasCoordinates || vehicle.zoneGeocodeKey !== locationKey)) {
                    window.kapitransToast('Recherche de la zone sur la carte…', 'info', 'location');
                    try {
                        location = await geocodeVehicleZone(zone, vehicle);
                    } catch (error) {
                        console.error('Impossible de localiser la zone du véhicule.', error);
                        window.kapitransToast('Zone introuvable ou service indisponible. Vérifiez le nom et réessayez.', 'error');
                        return false;
                    }
                }
                if (vehicle._source === 'stored') {
                    const stored = readStoredValue('kapitrans-vehicles', {});
                    const record = stored[vehicle._key];
                    if (!record) return false;
                    record.marque = values.marque.trim();
                    record.modele = '';
                    record.proprietaire = { ...record.proprietaire, nom: values.proprietaire.trim() };
                    record.categorie = values.categorie.trim();
                    record.statut = values.statut;
                    record.zone = zone;
                    if (location) {
                        record.lat = location.latitude;
                        record.lng = location.longitude;
                        record.zoneGeocodeKey = locationKey;
                    }
                    localStorage.setItem('kapitrans-vehicles', JSON.stringify(stored));
                } else {
                    const overrides = readStoredValue('kapitrans-vehicle-overrides', {});
                    overrides[vehicle._key] = {
                        ...overrides[vehicle._key],
                        marque: values.marque.trim(),
                        proprietaire: values.proprietaire.trim(),
                        categorie: values.categorie.trim(),
                        statut: values.statut,
                        zone: zone,
                        ...(location ? {
                            lat: location.latitude,
                            lng: location.longitude,
                            zoneGeocodeKey: locationKey
                        } : {})
                    };
                    localStorage.setItem('kapitrans-vehicle-overrides', JSON.stringify(overrides));
                }
                renderVehicles();
                filterVehicles();
                if (location) window.kapitransToast('Zone enregistrée et position du véhicule mise à jour.', 'success', 'location');
            });
            return;
        }

        if (button.classList.contains('btn-delete')) {
            if (!window.confirm(`Supprimer le véhicule ${vehicle.matricule} ?`)) return;

            if (vehicle._source === 'stored') {
                const stored = readStoredValue('kapitrans-vehicles', {});
                delete stored[vehicle._key];
                localStorage.setItem('kapitrans-vehicles', JSON.stringify(stored));
            } else {
                const hidden = readStoredValue('kapitrans-vehicle-hidden', []);
                if (!hidden.includes(vehicle._key)) hidden.push(vehicle._key);
                localStorage.setItem('kapitrans-vehicle-hidden', JSON.stringify(hidden));
            }

            renderVehicles();
            filterVehicles();
        }
    });

    // ============================================================
    // 7. INITIALISATION
    // ============================================================

    renderVehicles();

});