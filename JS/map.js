// ============================================================
// MAP — KAPITRANS
// ============================================================
// Ce fichier gère la carte GPS des véhicules en RDC.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. VÉRIFIER QUE LA CARTE EXISTE
    // ============================================================

    const mapElement = document.getElementById('kapitrans-map');
    if (!mapElement) return;

    // ============================================================
    // 2. INITIALISATION DE LA CARTE
    // ============================================================

    const RDC_CENTER = [-4.038, 21.758];
    const INITIAL_ZOOM = 6;

    const map = L.map('kapitrans-map').setView(RDC_CENTER, INITIAL_ZOOM);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    const PROVINCES = {
        'kinshasa': { nom: 'Kinshasa', lat: -4.325, lng: 15.322, zoom: 12 },
        'kongo-central': { nom: 'Kongo-Central', lat: -5.816, lng: 13.450, zoom: 10 },
        'kwango': { nom: 'Kwango', lat: -4.833, lng: 17.033, zoom: 9 },
        'kwilu': { nom: 'Kwilu', lat: -5.033, lng: 18.816, zoom: 9 },
        'mai-ndombe': { nom: 'Mai-Ndombe', lat: -1.950, lng: 18.283, zoom: 8 },
        'kasai': { nom: 'Kasaï', lat: -6.416, lng: 20.800, zoom: 9 },
        'kasai-central': { nom: 'Kasaï-Central', lat: -5.896, lng: 22.417, zoom: 9 },
        'kasai-oriental': { nom: 'Kasaï-Oriental', lat: -6.150, lng: 23.600, zoom: 9 },
        'lomami': { nom: 'Lomami', lat: -6.133, lng: 24.483, zoom: 9 },
        'sankuru': { nom: 'Sankuru', lat: -4.966, lng: 23.433, zoom: 8 },
        'maniema': { nom: 'Maniema', lat: -2.950, lng: 25.950, zoom: 8 },
        'sud-kivu': { nom: 'Sud-Kivu', lat: -2.508, lng: 28.860, zoom: 10 },
        'nord-kivu': { nom: 'Nord-Kivu', lat: -1.679, lng: 29.222, zoom: 10 },
        'ituri': { nom: 'Ituri', lat: 1.566, lng: 30.250, zoom: 9 },
        'haut-uele': { nom: 'Haut-Uélé', lat: 2.766, lng: 27.616, zoom: 8 },
        'tshopo': { nom: 'Tshopo', lat: 0.515, lng: 25.191, zoom: 9 },
        'bas-uele': { nom: 'Bas-Uélé', lat: 2.800, lng: 24.733, zoom: 8 },
        'nord-ubangi': { nom: 'Nord-Ubangi', lat: 4.283, lng: 21.000, zoom: 8 },
        'mongala': { nom: 'Mongala', lat: 2.150, lng: 21.516, zoom: 8 },
        'sud-ubangi': { nom: 'Sud-Ubangi', lat: 3.250, lng: 19.766, zoom: 8 },
        'equateur': { nom: 'Équateur', lat: 0.050, lng: 18.266, zoom: 8 },
        'tshuapa': { nom: 'Tshuapa', lat: -0.216, lng: 20.866, zoom: 8 },
        'tanganyika': { nom: 'Tanganyika', lat: -5.947, lng: 29.194, zoom: 9 },
        'haut-lomami': { nom: 'Haut-Lomami', lat: -8.733, lng: 24.983, zoom: 8 },
        'lualaba': { nom: 'Lualaba', lat: -10.716, lng: 25.466, zoom: 9 },
        'haut-katanga': { nom: 'Haut-Katanga', lat: -11.660, lng: 27.479, zoom: 10 }
    };

    // ============================================================
    // 3. VÉHICULES EN RDC
    // ============================================================

    function getStoredVehicles() {
        const stored = JSON.parse(localStorage.getItem('kapitrans-vehicles') || '{}');
        if (!stored || Array.isArray(stored) || typeof stored !== 'object') {
            throw new Error('Le registre des véhicules doit contenir un objet.');
        }
        const documents = JSON.parse(localStorage.getItem('kapitrans-documents') || '[]');
        if (!Array.isArray(documents)) throw new Error('Le registre des documents doit contenir une liste.');
        return Object.entries(stored).map(function ([storageKey, vehicle]) {
            const provinceKey = vehicle.province || 'kinshasa';
            const province = PROVINCES[provinceKey] || PROVINCES.kinshasa;
            const latitude = vehicle.lat === '' || vehicle.lat == null ? NaN : Number(vehicle.lat);
            const longitude = vehicle.lng === '' || vehicle.lng == null ? NaN : Number(vehicle.lng);
            const relatedStatuses = documents
                .filter(documentRecord => String(documentRecord.matricule || '').toUpperCase() === String(vehicle.matricule || storageKey).toUpperCase())
                .map(getDocumentStatus);
            const embeddedStatuses = Object.values(vehicle.documents || {})
                .filter(documentRecord => documentRecord && (documentRecord.numero || documentRecord.expiration || documentRecord.dateExpiration))
                .map(getDocumentStatus);
            const statuses = [vehicle.statut || 'conforme', ...relatedStatuses, ...embeddedStatuses];
            return {
                matricule: vehicle.matricule || storageKey,
                marque: [vehicle.marque, vehicle.modele].filter(Boolean).join(' '),
                proprietaire: typeof vehicle.proprietaire === 'string'
                    ? vehicle.proprietaire
                    : vehicle.proprietaire?.nom || '',
                statut: statuses.includes('non-conforme') ? 'non-conforme' :
                    statuses.includes('surveiller') ? 'surveiller' : 'conforme',
                lat: Number.isFinite(latitude) ? latitude : province.lat,
                lng: Number.isFinite(longitude) ? longitude : province.lng,
                ville: vehicle.ville || province.nom,
                province: provinceKey,
                zone: vehicle.zone || '—'
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

    let vehicles;
    try {
        vehicles = getStoredVehicles();
    } catch (error) {
        console.error('Impossible de charger les véhicules sur la carte.', error);
        const list = document.getElementById('vehicle-list');
        if (list) list.textContent = 'Impossible de lire les véhicules enregistrés.';
        return;
    }

    // ============================================================
    // 4. COULEURS ET LABELS
    // ============================================================

    const statusColors = {
        'conforme': '#86efac',
        'surveiller': '#fbbf24',
        'non-conforme': '#fca5a5'
    };

    const statusLabels = {
        'conforme': 'Conforme',
        'surveiller': 'À surveiller',
        'non-conforme': 'Non conforme'
    };

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[character];
        });
    }

    const vehicleList = document.getElementById('vehicle-list');
    if (vehicleList) {
        vehicleList.replaceChildren();
        if (vehicles.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'map-empty-state';
            empty.textContent = 'Aucun véhicule enregistré.';
            vehicleList.appendChild(empty);
        } else {
            vehicles.forEach(function (vehicle) {
                const item = document.createElement('div');
                item.className = 'map-vehicle-item';
                item.dataset.status = vehicle.statut;
                item.dataset.matricule = vehicle.matricule;
                const header = document.createElement('div');
                header.className = 'map-vehicle-header';
                const plate = document.createElement('span');
                plate.className = 'matricule';
                plate.textContent = vehicle.matricule;
                const badge = document.createElement('span');
                badge.className = `status-badge status-${vehicle.statut}`;
                badge.textContent = statusLabels[vehicle.statut] || 'Conforme';
                header.append(plate, badge);
                const info = document.createElement('div');
                info.className = 'map-vehicle-info';
                const model = document.createElement('span');
                model.textContent = vehicle.marque || '—';
                const location = document.createElement('span');
                location.className = 'map-vehicle-location';
                location.textContent = `${vehicle.ville} — ${vehicle.zone}`;
                info.append(model, location);
                item.append(header, info);
                vehicleList.appendChild(item);
            });
        }
    }
    const vehicleCount = document.getElementById('vehicle-count');
    if (vehicleCount) vehicleCount.textContent = String(vehicles.length);
    const mapStatusCounts = {
        total: vehicles.length,
        conforme: vehicles.filter(vehicle => vehicle.statut === 'conforme').length,
        surveiller: vehicles.filter(vehicle => vehicle.statut === 'surveiller').length,
        'non-conforme': vehicles.filter(vehicle => vehicle.statut === 'non-conforme').length
    };
    document.querySelectorAll('[data-map-stat]').forEach(function (counter) {
        counter.textContent = String(mapStatusCounts[counter.dataset.mapStat] || 0);
    });

    // ============================================================
    // 5. CRÉER LES MARQUEURS
    // ============================================================

    const markers = {};

    vehicles.forEach(function (vehicle) {
        const color = statusColors[vehicle.statut] || statusColors.conforme;

        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="marker-pin" style="background-color: ${color};">
                    <span class="marker-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 15.5 7 7h10l2 8.5M6.5 15.5h11M9 19h6M8 11h8M10 7V4.5h4V7"/></svg></span>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });

        const marker = L.marker([vehicle.lat, vehicle.lng], {
            icon: markerIcon
        }).addTo(map);

        const popupContent = `
            <div class="map-popup">
                <div class="map-popup-header" style="border-bottom-color: ${color};">
                    <strong class="map-popup-matricule">${escapeHtml(vehicle.matricule)}</strong>
                    <span class="map-popup-status" style="color: ${color};">
                        ${statusLabels[vehicle.statut] || 'Conforme'}
                    </span>
                </div>
                <div class="map-popup-body">
                    <p><strong>Véhicule :</strong> ${escapeHtml(vehicle.marque || '—')}</p>
                    <p><strong>Propriétaire :</strong> ${escapeHtml(vehicle.proprietaire || '—')}</p>
                    <p><strong>Ville :</strong> ${escapeHtml(vehicle.ville)}</p>
                    <p><strong>Zone :</strong> ${escapeHtml(vehicle.zone)}</p>
                    <p><strong>Position :</strong> ${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}</p>
                </div>
                <div class="map-popup-actions">
                    <button onclick="window.kapitransZoom(${vehicle.lat}, ${vehicle.lng})" class="map-popup-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6"/></svg>Zoomer</button>
                    <a href="admin-vehicles.html" class="map-popup-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>Voir la fiche</a>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'kapitrans-popup'
        });

        markers[vehicle.matricule] = marker;
    });

    const provinceSelect = document.getElementById('province-select');

    if (provinceSelect) {
        Object.keys(PROVINCES).forEach(function (key) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = PROVINCES[key].nom;
            provinceSelect.appendChild(option);
        });

        provinceSelect.addEventListener('change', function () {
            const province = PROVINCES[this.value];

            if (province) {
                map.setView([province.lat, province.lng], province.zoom);
                showNotification(province.nom);
            } else {
                map.setView(RDC_CENTER, INITIAL_ZOOM);
            }
        });
    }

    // ============================================================
    // 6. GÉRER LE MATRICULE DANS L'URL
    // ============================================================

    const urlParams = new URLSearchParams(window.location.search);
    const targetMatricule = urlParams.get('matricule');
    const targetVehicle = targetMatricule ? vehicles.find(function (v) {
        return v.matricule.toLowerCase() === targetMatricule.toLowerCase();
    }) : null;

    if (targetVehicle && markers[targetVehicle.matricule]) {
        map.setView([targetVehicle.lat, targetVehicle.lng], 16);
        setTimeout(function () {
            markers[targetVehicle.matricule].openPopup();
        }, 350);
    }

    // ============================================================
    // 7. CLIC SUR UN ÉLÉMENT DE LA LISTE
    // ============================================================

    document.querySelectorAll('.map-vehicle-item').forEach(function (item) {
        item.addEventListener('click', function () {
            const matricule = this.dataset.matricule;
            const vehicle = vehicles.find(v => v.matricule === matricule);

            if (vehicle && markers[matricule]) {
                map.setView([vehicle.lat, vehicle.lng], 16);
                markers[matricule].openPopup();

                document.querySelectorAll('.map-vehicle-item').forEach(function (el) {
                    el.classList.remove('highlighted');
                });
                item.classList.add('highlighted');
            }
        });
    });

    // ============================================================
    // 8. FILTRES
    // ============================================================

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const filter = this.dataset.filter;

            document.querySelectorAll('.map-vehicle-item').forEach(function (item) {
                if (filter === 'all' || item.dataset.status === filter) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });

            const visibleCount = document.querySelectorAll('.map-vehicle-item:not([style*="display: none"])').length;
            if (vehicleCount) vehicleCount.textContent = String(visibleCount);
        });
    });

    // ============================================================
    // 9. RECHERCHE
    // ============================================================

    const searchInput = document.getElementById('map-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const query = this.value.toLowerCase().trim();

            document.querySelectorAll('.map-vehicle-item').forEach(function (item) {
                const matricule = item.dataset.matricule.toLowerCase();
                if (matricule.includes(query)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });

            const visibleCount = document.querySelectorAll('.map-vehicle-item:not([style*="display: none"])').length;
            if (vehicleCount) vehicleCount.textContent = String(visibleCount);
        });
    }

    // ============================================================
    // 10. BOUTONS
    // ============================================================

    const btnCenter = document.getElementById('btn-center');
    if (btnCenter) {
        btnCenter.addEventListener('click', function () {
            map.setView(RDC_CENTER, INITIAL_ZOOM);
        });
    }

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function () {
            map.setView(RDC_CENTER, INITIAL_ZOOM);
            document.querySelectorAll('.map-vehicle-item').forEach(item => item.style.display = 'block');
            if (vehicleCount) vehicleCount.textContent = String(vehicles.length);
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
            if (provinceSelect) provinceSelect.value = '';
        });
    }

    function showNotification(message) {
        window.kapitransToast(message, 'info', 'location');
    }

    window.kapitransZoom = function (lat, lng) {
        map.setView([lat, lng], 18);
    };

});