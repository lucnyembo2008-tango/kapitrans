import { db } from './firebase.js';
import { logAudit } from './audit-log.js';
import { collection, deleteDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const mapElement = document.getElementById('kapitrans-map');
    if (!mapElement) return;

    const RDC_CENTER = [-4.038, 21.758];
    const INITIAL_ZOOM = 6;
    const PROVINCE_VIEWS = {
        kinshasa: { center: [-4.420, 15.320], zoom: 8 },
        'kongo-central': { center: [-5.45, 14.85], zoom: 7 },
        kwango: { center: [-6.7, 17.0], zoom: 7 },
        kwilu: { center: [-4.9, 18.8], zoom: 7 },
        'mai-ndombe': { center: [-2.1, 18.5], zoom: 7 },
        kasai: { center: [-5.7, 21.3], zoom: 7 },
        'kasai-central': { center: [-6.0, 22.5], zoom: 7 },
        'kasai-oriental': { center: [-6.1, 23.6], zoom: 7 },
        lomami: { center: [-6.1, 24.7], zoom: 7 },
        sankuru: { center: [-3.3, 24.5], zoom: 7 },
        maniema: { center: [-3.0, 26.0], zoom: 7 },
        'sud-kivu': { center: [-2.7, 28.8], zoom: 8 },
        'nord-kivu': { center: [-0.6, 29.3], zoom: 8 },
        ituri: { center: [1.8, 30.2], zoom: 7 },
        'haut-uele': { center: [3.0, 28.5], zoom: 7 },
        tshopo: { center: [0.5, 25.5], zoom: 7 },
        'bas-uele': { center: [3.0, 25.5], zoom: 7 },
        'nord-ubangi': { center: [4.3, 21.0], zoom: 7 },
        mongala: { center: [2.2, 21.5], zoom: 7 },
        'sud-ubangi': { center: [3.3, 19.0], zoom: 7 },
        equateur: { center: [0.4, 19.0], zoom: 7 },
        tshuapa: { center: [-0.8, 24.0], zoom: 7 },
        tanganyika: { center: [-6.0, 28.4], zoom: 7 },
        'haut-lomami': { center: [-8.5, 25.5], zoom: 7 },
        lualaba: { center: [-10.7, 25.8], zoom: 7 },
        'haut-katanga': { center: [-11.7, 27.5], zoom: 7 }
    };
    const map = L.map('kapitrans-map').setView(RDC_CENTER, INITIAL_ZOOM);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    const vehicleCountEl = document.getElementById('vehicle-count');
    const listEl = document.getElementById('vehicle-list');
    const searchInput = document.getElementById('map-search-input');
    const provinceSelect = document.getElementById('province-select');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const statCards = {
        total: document.querySelector('[data-map-stat="total"]'),
        conforme: document.querySelector('[data-map-stat="conforme"]'),
        surveiller: document.querySelector('[data-map-stat="surveiller"]'),
        'non-conforme': document.querySelector('[data-map-stat="non-conforme"]')
    };

    const markers = new Map();
    let vehicles = [];
    let activeFilter = 'all';
    let activeProvince = '';

    function normalizeProvince(value) {
        return String(value || '').trim().toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');
    }

    function normalizeStatus(value) {
        const text = String(value || '').trim().toLowerCase();
        if (['conforme', 'valide', 'valid', 'ok'].includes(text)) return 'conforme';
        if (['surveiller', 'a-surveiller', 'à surveiller', 'watch', 'warning'].includes(text)) return 'surveiller';
        if (['non-conforme', 'non conforme', 'nonconforme', 'danger', 'reject', 'rejected'].includes(text)) return 'non-conforme';
        return 'conforme';
    }

    function getStatusColor(status) {
        const normalized = normalizeStatus(status);
        if (normalized === 'surveiller') return '#fbbf24';
        if (normalized === 'non-conforme') return '#fca5a5';
        return '#86efac';
    }

    function toCoordinate(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function getVehiclePosition(vehicle) {
        const lat = toCoordinate(vehicle?.lat ?? vehicle?.latitude ?? vehicle?.position?.lat ?? vehicle?.gps?.lat);
        const lng = toCoordinate(vehicle?.lng ?? vehicle?.longitude ?? vehicle?.position?.lng ?? vehicle?.position?.lon ?? vehicle?.gps?.lng);
        if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return [lat, lng];
    }

    function updateStats() {
        const provinceVehicles = activeProvince
            ? vehicles.filter((vehicle) => normalizeProvince(vehicle.province) === activeProvince)
            : vehicles;
        const counts = {
            total: provinceVehicles.length,
            conforme: provinceVehicles.filter((vehicle) => normalizeStatus(vehicle.statut) === 'conforme').length,
            surveiller: provinceVehicles.filter((vehicle) => normalizeStatus(vehicle.statut) === 'surveiller').length,
            'non-conforme': provinceVehicles.filter((vehicle) => normalizeStatus(vehicle.statut) === 'non-conforme').length
        };

        Object.entries(counts).forEach(([key, value]) => {
            const element = statCards[key];
            if (element) element.textContent = String(value);
        });

        if (vehicleCountEl) {
            vehicleCountEl.textContent = String(counts.total);
        }
    }

    function filterMarkersByProvince() {
        markers.forEach((marker, key) => {
            const vehicle = vehicles.find((entry) => (entry.matricule || entry.id) === key);
            const matchesProvince = !activeProvince || normalizeProvince(vehicle?.province) === activeProvince;
            if (matchesProvince) marker.addTo(map);
            else map.removeLayer(marker);
        });
    }

    function createMarker(vehicle) {
        const position = getVehiclePosition(vehicle);
        if (!position) return null;

        const status = normalizeStatus(vehicle.statut);
        const color = getStatusColor(status);
        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-pin" style="background-color: ${color};"><span class="marker-icon">🚗</span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, 0]
        });

        const [lat, lng] = position;
        const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
        const popupContent = `
            <div class="map-popup">
                <div class="map-popup-header" style="border-bottom-color: ${color};">
                    <strong class="map-popup-matricule">${vehicle.matricule || '—'}</strong>
                    <span class="status-badge ${status === 'non-conforme' ? 'status-non-conforme' : status === 'surveiller' ? 'status-surveiller' : 'status-conforme'}" style="font-size: 10px; padding: 4px 8px;">${status === 'non-conforme' ? 'Non conforme' : status === 'surveiller' ? 'À surveiller' : 'Conforme'}</span>
                </div>
                <div class="map-popup-body">
                    <p><strong>Véhicule :</strong> ${[vehicle.marque, vehicle.modele].filter(Boolean).join(' ') || '—'}</p>
                    <p><strong>Propriétaire :</strong> ${vehicle.proprietaire || vehicle.owner || '—'}</p>
                    <p><strong>Ville :</strong> ${vehicle.ville || '—'}${vehicle.province ? ` • ${vehicle.province}` : ''}</p>
                    <p><strong>Zone :</strong> ${vehicle.zone || '—'}</p>
                    <p><strong>Position :</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                </div>
                <div class="map-popup-actions" style="display: flex; gap: 8px; margin-top: 12px;">
                    <button type="button" class="btn-secondary" data-map-action="zoom" data-matricule="${vehicle.matricule || ''}" style="flex: 1;">Zoomer</button>
                    <button type="button" class="btn-danger" data-map-action="delete" data-vehicle-id="${vehicle.id || ''}" style="flex: 1;">Supprimer</button>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, {
            autoPan: true,
            autoPanPadding: [16, 16],
            keepInView: true,
            maxWidth: 340,
            className: 'kapitrans-popup'
        });

        marker.on('popupopen', () => {
            const popup = marker.getPopup();
            const root = popup.getElement();
            if (!root) return;

            root.querySelectorAll('[data-map-action]').forEach((button) => {
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    const action = button.dataset.mapAction;
                    if (action === 'zoom') {
                        const [targetLat, targetLng] = getVehiclePosition(vehicle);
                        map.flyTo([targetLat, targetLng], 12, { duration: 0.8 });
                        marker.openPopup();
                        return;
                    }

                    if (action === 'delete') {
                        const vehicleId = button.dataset.vehicleId;
                        if (!vehicleId) return;
                        const confirmed = window.confirm(`Supprimer le véhicule ${vehicle.matricule || ''} ?`);
                        if (!confirmed) return;
                        try {
                            await deleteDoc(doc(db, 'vehicles', vehicleId));
                            await logAudit({
                                actionType: 'delete',
                                action: 'Suppression',
                                entite: 'Véhicule',
                                details: `${vehicle.matricule || '—'} — supprimé depuis la carte`
                            });
                            map.removeLayer(marker);
                            markers.delete(vehicle.matricule || vehicle.id);
                            vehicles = vehicles.filter((entry) => entry.id !== vehicleId);
                            updateStats();
                            renderVehicleList();
                        } catch (error) {
                            console.error('Impossible de supprimer le véhicule depuis la carte.', error);
                            window.alert('La suppression a échoué.');
                        }
                    }
                });
            });
        });

        markers.set(vehicle.matricule || vehicle.id, marker);
        return marker;
    }

    function renderVehicleList() {
        if (!listEl) return;

        const query = (searchInput?.value || '').trim().toLowerCase();
        const filtered = vehicles.filter((vehicle) => {
            const normalizedStatus = normalizeStatus(vehicle.statut);
            const matchesFilter = activeFilter === 'all' || normalizedStatus === activeFilter;
            const matchesProvince = !activeProvince || normalizeProvince(vehicle.province) === activeProvince;
            const text = [vehicle.matricule, vehicle.marque, vehicle.modele, vehicle.proprietaire || vehicle.owner].join(' ').toLowerCase();
            const matchesSearch = !query || text.includes(query);
            return matchesFilter && matchesProvince && matchesSearch;
        });

        listEl.innerHTML = '';

        if (!filtered.length) {
            listEl.innerHTML = '<div class="map-vehicle-item"><div class="map-vehicle-header"><strong class="matricule">Aucun véhicule</strong></div><div class="map-vehicle-info"><span>Aucun résultat pour ce filtre.</span></div></div>';
            return;
        }

        filtered.forEach((vehicle) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'map-vehicle-item';
            item.dataset.matricule = vehicle.matricule || '';
            const status = normalizeStatus(vehicle.statut);
            item.innerHTML = `
                <div class="map-vehicle-header">
                    <strong class="matricule">${vehicle.matricule || '—'}</strong>
                    <span class="status-badge ${status === 'non-conforme' ? 'status-non-conforme' : status === 'surveiller' ? 'status-surveiller' : 'status-conforme'}">
                        ${status === 'non-conforme' ? 'Non conforme' : status === 'surveiller' ? 'À surveiller' : 'Conforme'}
                    </span>
                </div>
                <div class="map-vehicle-info">
                    <span>${[vehicle.marque, vehicle.modele].filter(Boolean).join(' ') || '—'}</span>
                    <span class="map-vehicle-location">${vehicle.proprietaire || vehicle.owner || '—'}</span>
                    <span>${vehicle.categorie || '—'}${vehicle.ville ? ` • ${vehicle.ville}` : ''}</span>
                    ${getVehiclePosition(vehicle) ? '' : '<span class="map-vehicle-location">Position GPS non enregistrée</span>'}
                </div>
            `;

            item.addEventListener('click', () => {
                if (!getVehiclePosition(vehicle)) return;
                focusVehicle(vehicle, 11);
            });

            listEl.appendChild(item);
        });

        if (vehicleCountEl) {
            vehicleCountEl.textContent = String(filtered.length);
        }
    }

    function focusVehicle(vehicle, zoom) {
        const marker = markers.get(vehicle.matricule || vehicle.id);
        if (!marker) return;

        const [lat, lng] = getVehiclePosition(vehicle);
        const target = L.latLng(lat, lng);
        const currentCenter = map.getCenter();
        const needsMove = map.getZoom() !== zoom || currentCenter.distanceTo(target) > 1;

        if (!needsMove) {
            marker.openPopup();
            return;
        }

        map.once('moveend', () => marker.openPopup());
        map.flyTo(target, zoom, { duration: 0.8 });
    }

    function bindFilters() {
        filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                activeFilter = button.dataset.filter || 'all';
                filterButtons.forEach((entry) => entry.classList.toggle('active', entry === button));
                renderVehicleList();
            });
        });

        searchInput?.addEventListener('input', renderVehicleList);
        provinceSelect?.addEventListener('change', () => {
            activeProvince = normalizeProvince(provinceSelect.value);
            updateStats();
            renderVehicleList();
            filterMarkersByProvince();

            if (!activeProvince) {
                map.flyTo(RDC_CENTER, INITIAL_ZOOM, { duration: 0.8 });
            } else {
                const provinceView = PROVINCE_VIEWS[activeProvince];
                if (provinceView) {
                    const provinceMarkers = vehicles
                        .filter((vehicle) => normalizeProvince(vehicle.province) === activeProvince)
                        .map((vehicle) => markers.get(vehicle.matricule || vehicle.id))
                        .filter(Boolean);
                    if (provinceMarkers.length === 1) {
                        const vehicle = vehicles.find((entry) => markers.get(entry.matricule || entry.id) === provinceMarkers[0]);
                        focusVehicle(vehicle, 12);
                    } else if (provinceMarkers.length > 1) {
                        map.fitBounds(L.featureGroup(provinceMarkers).getBounds().pad(0.15), { maxZoom: 12 });
                    } else {
                        map.flyTo(provinceView.center, provinceView.zoom, { duration: 0.8 });
                    }
                }
            }
        });
    }

    function focusVehicleByMatricule(targetMatricule) {
        if (!targetMatricule) return;
        const vehicle = vehicles.find((entry) => String(entry.matricule || '').toUpperCase() === String(targetMatricule).toUpperCase());
        if (!vehicle) return;

        focusVehicle(vehicle, 12);
    }

    async function loadVehicles() {
        try {
            const querySnapshot = await getDocs(collection(db, 'vehicles'));
            vehicles = querySnapshot.docs.map((documentSnapshot) => ({
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            }));

            updateStats();
            renderVehicleList();

            const currentMarkerKeys = new Set(markers.keys());
            vehicles.forEach((vehicle) => {
                const key = vehicle.matricule || vehicle.id;
                if (!currentMarkerKeys.has(key)) {
                    createMarker(vehicle);
                }
            });
            filterMarkersByProvince();

            const params = new URLSearchParams(window.location.search);
            const targetMatricule = params.get('matricule');
            if (targetMatricule) {
                focusVehicleByMatricule(targetMatricule);
            }
        } catch (error) {
            console.error('Erreur Firebase carte :', error);
            if (listEl) {
                listEl.innerHTML = '<div class="map-vehicle-item"><div class="map-vehicle-header"><strong class="matricule">Erreur</strong></div><div class="map-vehicle-info"><span>Le chargement des véhicules a échoué.</span></div></div>';
            }
        }
    }

    bindFilters();
    loadVehicles();

    const btnCenter = document.getElementById('btn-center');
    if (btnCenter) {
        btnCenter.addEventListener('click', () => map.setView(RDC_CENTER, INITIAL_ZOOM));
    }

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            markers.forEach((marker) => map.removeLayer(marker));
            markers.clear();
            loadVehicles();
        });
    }
});
