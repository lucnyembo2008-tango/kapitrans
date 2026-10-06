// ============================================================
// VERBALIZE — KAPITRANS
// ============================================================
// Ce fichier gère la verbalisation d'un véhicule par l'agent.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('verbalize-form');
    if (!form) return;

    const message = document.getElementById('verbalize-message');
    const submitButton = form.querySelector('[type="submit"]');
    const matricule = (new URLSearchParams(window.location.search).get('matricule') || '')
        .trim()
        .toUpperCase();

    function displayMessage(text, type) {
        message.textContent = '';
        message.classList.remove('is-error', 'is-success');
        window.kapitransToast(text, type);
    }

    let storedVehicles;
    let storedDocuments;
    try {
        storedVehicles = JSON.parse(localStorage.getItem('kapitrans-vehicles') || '{}');
        storedDocuments = JSON.parse(localStorage.getItem('kapitrans-documents') || '[]');
        if (!storedVehicles || Array.isArray(storedVehicles) || typeof storedVehicles !== 'object') {
            throw new Error('Le registre des véhicules doit contenir un objet.');
        }
        if (!Array.isArray(storedDocuments)) {
            throw new Error('Le registre des documents doit contenir une liste.');
        }
    } catch (error) {
        displayMessage('Les données des véhicules ou des documents sont illisibles. Impossible de créer le PV.', 'error');
        form.querySelectorAll('input, select, textarea, button').forEach(function (control) {
            control.disabled = true;
        });
        return;
    }

    const storedVehicleKey = Object.keys(storedVehicles).find(function (key) {
        return key.trim().toUpperCase() === matricule;
    });
    const storedVehicle = storedVehicleKey ? storedVehicles[storedVehicleKey] : null;
    function documentStatus(expiration) {
        if (!expiration) return 'surveiller';
        const date = String(expiration);
        const expiry = new Date(date + (date.length === 10 ? 'T23:59:59' : ''));
        if (Number.isNaN(expiry.getTime())) return 'surveiller';
        const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
        return days < 0 ? 'non-conforme' : days < 30 ? 'surveiller' : 'conforme';
    }

    function getVehicleStatus(vehicleRecord) {
        const statuses = [vehicleRecord.statut || 'conforme'];
        const embeddedDocuments = Object.values(vehicleRecord.documents || {});
        const vehicleDocuments = storedDocuments.filter(function (doc) {
            return String(doc.matricule || '').toUpperCase() === matricule;
        });
        embeddedDocuments.concat(vehicleDocuments).forEach(function (doc) {
            if (doc.expiration || doc.dateExpiration) {
                statuses.push(documentStatus(doc.expiration || doc.dateExpiration));
            } else if (doc.statut === 'expire' || doc.statut === 'non-conforme') {
                statuses.push('non-conforme');
            } else if (doc.statut === 'bientot' || doc.statut === 'surveiller') {
                statuses.push('surveiller');
            }
        });
        if (statuses.includes('non-conforme')) return 'non-conforme';
        if (statuses.includes('surveiller')) return 'surveiller';
        return 'conforme';
    }

    const vehicle = storedVehicle ? {
        matricule: storedVehicle.matricule || storedVehicleKey || matricule,
        marque: [storedVehicle.marque, storedVehicle.modele].filter(Boolean).join(' ') || '—',
        proprietaire: typeof storedVehicle.proprietaire === 'string'
            ? storedVehicle.proprietaire
            : storedVehicle.proprietaire?.nom || '—',
        statut: getVehicleStatus(storedVehicle)
    } : null;

    document.getElementById('verbalize-matricule').textContent = matricule || '—';
    document.getElementById('verbalize-marque').textContent = vehicle?.marque || '—';
    document.getElementById('verbalize-proprietaire').textContent = vehicle?.proprietaire || '—';

    if (!matricule || !vehicle) {
        displayMessage('Véhicule introuvable. Revenez à la recherche et sélectionnez un véhicule valide.', 'error');
        submitButton.disabled = true;
        return;
    }

    if (vehicle.statut !== 'non-conforme') {
        displayMessage('Ce véhicule n’est pas signalé comme non conforme ; le PV ne peut pas être créé.', 'error');
        submitButton.disabled = true;
        return;
    }

    const dateInput = document.getElementById('date-infraction');
    const today = new Date();
    dateInput.value = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const montant = Number(document.getElementById('montant').value);
        if (!Number.isSafeInteger(montant) || montant <= 0) {
            displayMessage('Le montant doit être un nombre entier supérieur à zéro.', 'error');
            return;
        }

        const createdAt = new Date().toISOString();
        const zone = document.getElementById('zone').value.trim();
        const motif = document.getElementById('motif').value;
        let session = null;
        try {
            session = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
        } catch (error) {
            displayMessage('Impossible de lire la session de l’agent. Le PV n’a pas été enregistré.', 'error');
            console.error('Session agent illisible.', error);
            return;
        }
        const agentName = session?.nom || 'Agent';
        const pv = {
            id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `PV-${Date.now()}`,
            matricule: matricule,
            marque: vehicle.marque,
            proprietaire: vehicle.proprietaire,
            motif: motif,
            montant: montant,
            zone: zone,
            dateInfraction: document.getElementById('date-infraction').value,
            observations: document.getElementById('observations').value.trim(),
            agent: agentName,
            agentEmail: String(session?.email || '').trim().toLowerCase(),
            dateCreation: createdAt,
            statut: 'verbalise'
        };

        const keys = ['kapitrans-pvs', 'kapitrans-history', 'kapitrans-alerts'];
        const previousValues = {};
        const nextValues = {};

        try {
            keys.forEach(function (key) {
                previousValues[key] = localStorage.getItem(key);
            });

            function readArray(key) {
                const raw = previousValues[key];
                const value = JSON.parse(raw || '[]');
                if (!Array.isArray(value)) throw new Error(`Le stockage ${key} n’est pas une liste valide.`);
                return value;
            }

            nextValues['kapitrans-pvs'] = JSON.stringify(readArray('kapitrans-pvs').concat(pv));
            nextValues['kapitrans-history'] = JSON.stringify(readArray('kapitrans-history').concat({
                matricule: matricule,
                marque: vehicle.marque,
                proprietaire: vehicle.proprietaire,
                zone: zone || 'Non spécifiée',
                statut: 'non-conforme',
                agentEmail: String(session?.email || '').trim().toLowerCase(),
                agent: agentName,
                date: createdAt,
                pvId: pv.id
            }));
            nextValues['kapitrans-alerts'] = JSON.stringify(readArray('kapitrans-alerts').concat({
                matricule: matricule,
                type: 'controle',
                gravite: 'critique',
                message: `PV dressé : ${motif}`,
                agent: agentName,
                date: createdAt,
                pvId: pv.id
            }));

            keys.forEach(function (key) {
                localStorage.setItem(key, nextValues[key]);
            });
        } catch (error) {
            let rollbackFailed = false;
            keys.forEach(function (key) {
                if (!Object.prototype.hasOwnProperty.call(previousValues, key)) return;
                try {
                    if (previousValues[key] === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, previousValues[key]);
                } catch {
                    rollbackFailed = true;
                }
            });
            displayMessage(
                rollbackFailed
                    ? 'Erreur de stockage : les données n’ont pas pu être rétablies. Vérifiez le stockage du navigateur.'
                    : 'Impossible d’enregistrer le PV, l’historique et l’alerte. Vérifiez le stockage du navigateur.',
                'error'
            );
            console.error('Échec de l’enregistrement du PV KapiTrans.', error);
            return;
        }

        submitButton.disabled = true;
        displayMessage('PV enregistré avec succès ! Redirection vers vos vérifications…', 'success');
        window.setTimeout(function () {
            window.location.href = 'agent-history.html';
        }, 1000);
    });
});
