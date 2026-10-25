import { db, storage } from './firebase.js';
import { logAudit } from './audit-log.js';
import { collection, doc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

document.addEventListener('DOMContentLoaded', async function () {
    const form = document.getElementById('create-document-form');
    if (!form) return;

    const matriculeInput = form.querySelector('input[name="vehicule-matricule"]');
    const modelInput = form.querySelector('input[name="vehicule-modele"]');
    const ownerInput = form.querySelector('input[name="vehicule-proprietaire"]');
    const vehicleStatus = document.getElementById('vehicle-lookup-status');
    const transportHeading = form.querySelector('[data-transport-document-heading]');
    const transportEntry = form.querySelector('[data-document-entry="autorisation-transport"]');
    let vehicles = [];
    let selectedVehicle = null;

    function updateTransportFields() {
        const canAddTransportPermit = selectedVehicle?.categorie === 'transport';
        if (transportHeading) transportHeading.hidden = !canAddTransportPermit;
        if (transportEntry) transportEntry.hidden = !canAddTransportPermit;
    }

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
        updateTransportFields();

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

        if (!selectedVehicle) {
            alert('❌ Sélectionnez un véhicule enregistré en saisissant son matricule exact.');
            matriculeInput.focus();
            return;
        }

        const matricule = selectedVehicle.matricule;
        const documentDefinitions = [
            {
                type: 'certificat-controle-technique',
                number: 'certificat-numero',
                emission: 'certificat-emission',
                expiration: 'certificat-expiration',
                organism: 'certificat-organisme',
                file: 'certificat-fichier',
                requiresExpiration: true
            },
            {
                type: 'vignette',
                number: 'vignette-numero',
                emission: 'vignette-emission',
                organism: 'vignette-organisme',
                file: 'vignette-fichier'
            },
            {
                type: 'attestation-assurance',
                number: 'assurance-numero',
                emission: 'assurance-emission',
                expiration: 'assurance-expiration',
                organism: 'assurance-organisme',
                file: 'assurance-fichier',
                requiresExpiration: true
            },
            {
                type: 'autorisation-transport',
                number: 'transport-numero',
                emission: 'transport-emission',
                organism: 'transport-organisme',
                file: 'transport-fichier',
                requiresTransport: true
            }
        ];

        const pendingDocuments = [];
        for (const definition of documentDefinitions) {
            if (definition.requiresTransport && selectedVehicle.categorie !== 'transport') continue;

            const getValue = (name) => form.querySelector(`[name="${name}"]`).value.trim();
            const numero = getValue(definition.number);
            const dateEmission = getValue(definition.emission);
            const dateExpiration = definition.expiration ? getValue(definition.expiration) : '';
            const organisme = getValue(definition.organism);
            const file = form.querySelector(`[name="${definition.file}"]`).files[0] || null;
            const hasDetails = numero || dateEmission || dateExpiration || organisme || file;

            if (!hasDetails) continue;
            if (!numero) {
                alert(`❌ Renseignez le numéro du document : ${definition.type}.`);
                form.querySelector(`[name="${definition.number}"]`).focus();
                return;
            }
            if (definition.requiresExpiration && !dateExpiration) {
                alert(`❌ Renseignez la date d’expiration : ${definition.type}.`);
                form.querySelector(`[name="${definition.expiration}"]`).focus();
                return;
            }

            const daysRemaining = dateExpiration
                ? Math.ceil((new Date(`${dateExpiration}T23:59:59`).getTime() - Date.now()) / 86400000)
                : Infinity;
            pendingDocuments.push({
                matricule,
                type: definition.type,
                file,
                organisme,
                numero,
                dateEmission,
                dateExpiration,
                vehiculeId: selectedVehicle.id,
                marque: selectedVehicle.marque || '',
                modele: selectedVehicle.modele || '',
                proprietaire: typeof selectedVehicle.proprietaire === 'string'
                    ? selectedVehicle.proprietaire
                    : selectedVehicle.proprietaire?.nom || '',
                statut: daysRemaining < 0 ? 'expire' : daysRemaining < 30 ? 'bientot' : 'valide',
                dateCreation: new Date().toISOString()
            });
        }

        if (!pendingDocuments.length) {
            alert('❌ Renseignez au moins un document avant de continuer.');
            return;
        }

        try {
            const documentSnapshot = await getDocs(collection(db, 'documents'));
            const existingDocuments = documentSnapshot.docs
                .map((documentRecord) => documentRecord.data())
                .filter((documentRecord) => documentRecord.vehiculeId === selectedVehicle.id ||
                    String(documentRecord.matricule || '').trim().toUpperCase().replace(/\s+/g, '') === matricule.replace(/\s+/g, ''));
            const allDocuments = [...existingDocuments, ...pendingDocuments];
            const statuses = allDocuments.map((documentRecord) => {
                if (documentRecord.dateExpiration) {
                    const daysRemaining = Math.ceil((new Date(`${documentRecord.dateExpiration}T23:59:59`).getTime() - Date.now()) / 86400000);
                    return daysRemaining < 0 ? 'expire' : daysRemaining < 30 ? 'bientot' : 'valide';
                }
                return documentRecord.statut || 'valide';
            });
            const requiredTypes = [
                ['certificat-controle-technique', 'visite-technique'],
                ['vignette'],
                ['attestation-assurance', 'assurance']
            ];
            if (selectedVehicle.categorie === 'transport') requiredTypes.push(['autorisation-transport']);
            const hasMissingDocument = requiredTypes.some((types) => !allDocuments.some((documentRecord) => types.includes(documentRecord.type)));
            const vehicleStatus = hasMissingDocument || statuses.includes('expire')
                ? 'non-conforme'
                : statuses.includes('bientot')
                    ? 'surveiller'
                    : 'conforme';
            const batch = writeBatch(db);
            const uploadedPaths = [];
            try {
                for (const pendingDocument of pendingDocuments) {
                    const { file, ...documentData } = pendingDocument;
                    if (file) {
                        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                        const storagePath = `documents/${selectedVehicle.id}/${documentData.type}/${Date.now()}-${safeFileName}`;
                        const fileRef = ref(storage, storagePath);
                        await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
                        uploadedPaths.push(storagePath);
                        documentData.pieceJointe = {
                            nom: file.name,
                            url: await getDownloadURL(fileRef),
                            chemin: storagePath,
                            typeMime: file.type || '',
                            taille: file.size
                        };
                    }
                    batch.set(doc(collection(db, 'documents')), documentData);
                }
                batch.update(doc(db, 'vehicles', selectedVehicle.id), { statut: vehicleStatus });
                await batch.commit();
                await Promise.all(pendingDocuments.map((documentData) => logAudit({
                    actionType: 'create',
                    action: 'Ajout',
                    entite: 'Document',
                    details: `${documentData.type} ${documentData.numero} — véhicule ${matricule}`
                })));
            } catch (error) {
                await Promise.allSettled(uploadedPaths.map((path) => deleteObject(ref(storage, path))));
                throw error;
            }

            alert(`✅ ${pendingDocuments.length} document(s) enregistré(s) avec succès !`);
            window.location.href = 'admin-documents.html';

        } catch (error) {
            console.error(error);
            alert('❌ Erreur : ' + error.message);
        }
    });
});
