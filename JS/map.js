import { db } from './firebase.js';
import { collection, deleteDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const mapElement = document.getElementById('kapitrans-map');
    if (!mapElement) return;

    const RDC_CENTER = [-4.038, 21.758];
    const INITIAL_ZOOM = 6;
    const map = L.map('kapitrans-map').setView(RDC_CENTER, INITIAL_ZOOM);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    const vehicleCountEl = document.getElementById('vehicle-count');
    const listEl = document.getElementById('vehicle-list');
    const searchInput = document.getElementById('map-search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const statCards = {
        total: document.querySelector('[data-map-stat="total"]'),
        conforme: document.querySelector('[data-map-stat="conforme"]'),
        surveiller: document.querySelector('[data-map-stat="surveiller"]'),
        'non-conforme': document.querySelector('[data-map-stat="non-conforme"]')
    };

    const defaultCoordinates = { lat: -4.325, lng: 15.322 };
    const markers = new Map();
    let vehicles = [];
    let activeFilter = 'all';

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

    function toNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function getVehiclePosition(vehicle) {
        const lat = toNumber(
            vehicle?.lat ?? vehicle?.latitude ?? vehicle?.position?.lat ?? vehicle?.gps?.lat,
            defaultCoordinates.lat
        );
        const lng = toNumber(
            vehicle?.lng ?? vehicle?.longitude ?? vehicle?.position?.lng ?? vehicle?.position?.lon ?? vehicle?.gps?.lng,
            defaultCoordinates.lng
        );
        return [lat, lng];
    }

    function updateStats() {
        const counts = {
            total: vehicles.length,
            conforme: vehicles.filter((vehicle) => normalizeStatus(vehicle.statut) === 'conforme').length,
            surveiller: vehicles.filter((vehicle) => normalizeStatus(vehicle.statut) === 'surveiller').length,
            'non-conforme': vehicles.filter((vehicle) => normalizeStatus(vehicle.statut) === 'non-conforme').length
        };

        Object.entries(counts).forEach(([key, value]) => {
            const element = statCards[key];
            if (element) element.textContent = String(value);
        });

        if (vehicleCountEl) {
            vehicleCountEl.textContent = String(counts.total);
        }
    }

    function createMarker(vehicle) {
        const status = normalizeStatus(vehicle.statut);
        const color = getStatusColor(status);
        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-pin" style="background-color: ${color};"><span class="marker-icon">🚗</span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, 0]
        });

        const [lat, lng] = getVehiclePosition(vehicle);
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
            const text = [vehicle.matricule, vehicle.marque, vehicle.modele, vehicle.proprietaire || vehicle.owner].join(' ').toLowerCase();
            const matchesSearch = !query || text.includes(query);
            return matchesFilter && matchesSearch;
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
                </div>
            `;

            item.addEventListener('click', () => {
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
