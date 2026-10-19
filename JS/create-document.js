import { db } from './firebase.js';
import { addDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const form = document.getElementById('create-document-form');
    if (!form) return;

    const matriculeInput = form.querySelector('input[name="vehicule-matricule"]');
    const modelInput = form.querySelector('input[name="vehicule-modele"]');
    const ownerInput = form.querySelector('input[name="vehicule-proprietaire"]');
    const vehicleStatus = document.getElementById('vehicle-lookup-status');
    let vehicles = [];
    let selectedVehicle = null;

    try {
        const vehicleSnapshot = await getDocs(collection(db, 'vehicles'));
        vehicles = vehicleSnapshot.docs.map((vehicleDoc) => ({
            id: vehicleDoc.id,
            ...vehicleDoc.data()
        }));
        if (vehicles.length === 0) {
            vehicleStatus.textContent = 'Aucun véhicule enregistré. Enregistrez un véhicule avant de créer son document.';
        }
    } catch (error) {
        console.error('Impossible de charger les véhicules depuis Firebase.', error);
        vehicleStatus.textContent = 'Impossible de charger les véhicules. Vérifiez la connexion puis rechargez la page.';
    }

    matriculeInput.addEventListener('input', function () {
        const normalizedMatricule = matriculeInput.value.trim().toUpperCase().replace(/\s+/g, '');
        selectedVehicle = normalizedMatricule
            ? vehicles.find((vehicle) =>
                String(vehicle.matricule || '').trim().toUpperCase().replace(/\s+/g, '') === normalizedMatricule
            ) || null
            : null;

        modelInput.value = selectedVehicle
            ? [selectedVehicle.marque, selectedVehicle.modele].filter(Boolean).join(' ')
            : '';
        ownerInput.value = selectedVehicle
            ? (typeof selectedVehicle.proprietaire === 'string'
                ? selectedVehicle.proprietaire
                : selectedVehicle.proprietaire?.nom || '')
            : '';

        if (!matriculeInput.value.trim()) {
            vehicleStatus.textContent = '';
        } else if (selectedVehicle) {
            vehicleStatus.textContent = 'Véhicule trouvé.';
        } else if (vehicles.length > 0) {
            vehicleStatus.textContent = 'Aucun véhicule trouvé pour ce matricule.';
        }
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const matricule = form.querySelector('input[name="vehicule-matricule"]').value.trim().toUpperCase();
        const typeDocument = form.querySelector('select[name="type-document"]').value;
        const organisme = form.querySelector('input[name="organisme"]').value.trim();
        const numeroDocument = form.querySelector('input[name="numero-document"]').value.trim();
        const dateEmission = form.querySelector('input[name="date-emission"]').value;
        const dateExpiration = form.querySelector('input[name="date-expiration"]').value;

        if (!matricule || !typeDocument || !numeroDocument || !dateEmission || !dateExpiration) {
            alert('❌ Veuillez remplir tous les champs obligatoires.');
            return;
        }

        if (!selectedVehicle) {
            alert('❌ Sélectionnez un véhicule enregistré en saisissant son matricule exact.');
            matriculeInput.focus();
            return;
        }

        // Calcul basique du statut
        function getStatus(dateExp) {
            if (!dateExp) return 'valide';
            const today = new Date();
            const expiry = new Date(dateExp);
            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 'expire';
            if (diffDays < 30) return 'bientot';
            return 'valide';
        }

        const statut = getStatus(dateExpiration);

        try {
            await addDoc(collection(db, "documents"), {
                matricule: matricule,
                type: typeDocument,
                organisme: organisme,
                numero: numeroDocument,
                dateEmission: dateEmission,
                dateExpiration: dateExpiration,
                vehiculeId: selectedVehicle.id,
                marque: selectedVehicle.marque || '',
                modele: selectedVehicle.modele || '',
                proprietaire: typeof selectedVehicle.proprietaire === 'string'
                    ? selectedVehicle.proprietaire
                    : selectedVehicle.proprietaire?.nom || '',
                statut: statut,
                dateCreation: new Date().toISOString()
            });

            alert('✅ Document enregistré avec succès !');
            window.location.href = 'admin-documents.html';

        } catch (error) {
            console.error(error);
            alert('❌ Erreur : ' + error.message);
        }
    });
});
