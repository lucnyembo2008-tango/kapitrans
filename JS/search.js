import { db } from './firebase.js';
import { logAudit } from './audit-log.js';
import { addDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const form = document.getElementById('vehicle-search-form');
    const input = document.getElementById('vehicle-registration');
    const resultConforme = document.getElementById('result-conforme');
    const resultNonConforme = document.getElementById('result-non-conforme');
    const recentList = document.querySelector('.recent-list');

    function normalizeMatricule(value) {
        return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    }

    function getCurrentAgentName() {
        try {
            const user = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
            if (user?.nom) return user.nom;
            if (user?.email) return user.email.split('@')[0];
        } catch (error) {
            console.warn('Impossible de lire le profil de l’agent.', error);
        }
        return 'Agent';
    }

    function readRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem('kapitrans-recent-searches') || '[]');
        } catch (error) {
            return [];
        }
    }

    function saveRecentSearches(entries) {
        localStorage.setItem('kapitrans-recent-searches', JSON.stringify(entries));
    }

    function renderRecentSearches() {
        if (!recentList) return;

        const searches = readRecentSearches();
        if (!searches.length) {
            recentList.innerHTML = '<div class="recent-empty">Aucune recherche récente.</div>';
            return;
        }

        recentList.innerHTML = '';
        searches.slice(0, 5).forEach((entry) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'recent-item';
            button.innerHTML = `
                <div class="recent-item-left">
                    <span class="recent-matricule">${entry.matricule || '—'}</span>
                    <span class="recent-time">${entry.label || 'Recherche récente'}</span>
                </div>
                <span class="recent-status ${entry.status === 'non-conforme' ? 'recent-status-danger' : 'recent-status-safe'}">${entry.status === 'non-conforme' ? 'Critique' : 'OK'}</span>
            `;
            button.addEventListener('click', () => {
                input.value = entry.matricule || '';
                form.requestSubmit();
            });
            recentList.appendChild(button);
        });
    }

    if (!form || !input) return;

    function showSection(section) {
        if (resultConforme) resultConforme.style.display = section === resultConforme ? 'block' : 'none';
        if (resultNonConforme) resultNonConforme.style.display = section === resultNonConforme ? 'block' : 'none';
    }

    function getDocumentTypeLabel(type) {
        const labels = {
            'certificat-controle-technique': 'Certificat de contrôle technique',
            'visite-technique': 'Certificat de contrôle technique',
            'attestation-assurance': "Attestation d'assurance",
            assurance: "Attestation d'assurance",
            'autorisation-transport': 'Autorisation de transport',
            permis: 'Permis de conduire',
            vignette: 'Vignette'
        };
        return labels[type] || type || 'Document';
    }

    function getDocumentStatusLabel(status) {
        const labels = {
            expire: 'expiré',
            expiré: 'expiré',
            expired: 'expiré',
            bientot: 'expire bientôt',
            'bientôt': 'expire bientôt',
            expiring: 'expire bientôt',
            'non-conforme': 'non conforme',
            'non conforme': 'non conforme',
            manquant: 'manquant',
            valide: 'valide'
        };
        return labels[String(status || '').trim().toLowerCase()] || 'valide';
    }

    function getMissingDocuments(documents, vehicle) {
        const requiredTypes = [
            { type: 'certificat-controle-technique', aliases: ['certificat-controle-technique', 'visite-technique'] },
            { type: 'vignette', aliases: ['vignette'] },
            { type: 'attestation-assurance', aliases: ['attestation-assurance', 'assurance'] }
        ];
        if (vehicle?.categorie === 'transport') {
            requiredTypes.push({ type: 'autorisation-transport', aliases: ['autorisation-transport'] });
        }
        return requiredTypes
            .filter((required) => !documents.some((docItem) => required.aliases.includes(docItem.type)))
            .map((required) => ({ type: required.type, numero: '—', statut: 'manquant' }));
    }

    function getProblemDocuments(documents, vehicle) {
        const missingDocuments = getMissingDocuments(documents, vehicle);
        const expiredOrInvalidDocuments = documents.filter((docItem) => {
            const status = String(docItem.statut || '').trim().toLowerCase();
            return ['expire', 'expiré', 'expired', 'non-conforme', 'non conforme'].includes(status);
        });
        const expiringDocuments = documents.filter((docItem) =>
            ['bientot', 'bientôt', 'expiring'].includes(String(docItem.statut || '').trim().toLowerCase())
        );
        return [...missingDocuments, ...expiredOrInvalidDocuments, ...expiringDocuments];
    }

    function getVehicleIssueMessage(documents, vehicle) {
        const missingDocuments = getMissingDocuments(documents, vehicle);
        const expiredDocuments = documents.filter((docItem) =>
            ['expire', 'expiré', 'expired', 'non-conforme', 'non conforme'].includes(String(docItem.statut || '').trim().toLowerCase())
        );
        const expiringDocuments = documents.filter((docItem) =>
            ['bientot', 'bientôt', 'expiring'].includes(String(docItem.statut || '').trim().toLowerCase())
        );
        const reasons = [];

        if (missingDocuments.length) {
            reasons.push(`Documents manquants : ${missingDocuments.map((item) => getDocumentTypeLabel(item.type)).join(', ')}`);
        }
        if (expiredDocuments.length) {
            reasons.push(`Documents expirés ou non conformes : ${expiredDocuments.map((item) => getDocumentTypeLabel(item.type)).join(', ')}`);
        }
        if (expiringDocuments.length) {
            reasons.push(`Documents bientôt expirés : ${expiringDocuments.map((item) => getDocumentTypeLabel(item.type)).join(', ')}`);
        }

        return reasons.join('. ') || 'Le statut du véhicule nécessite une vérification des documents enregistrés.';
    }

    function formatDocumentList(documents, vehicle, section) {
        const container = section.querySelector('.result-doc-list');
        if (!container) return;
        container.innerHTML = '';

        const displayDocuments = getProblemDocuments(documents, vehicle);
        if (!displayDocuments.length) displayDocuments.push(...documents);

        if (!displayDocuments.length) {
            const empty = document.createElement('p');
            empty.className = 'result-doc-empty';
            empty.textContent = vehicle && vehicle.statut === 'non-conforme'
                ? 'Aucun document problématique détecté pour ce véhicule.'
                : 'Aucun document enregistré pour ce véhicule.';
            container.appendChild(empty);
            return;
        }

        displayDocuments.slice(0, 6).forEach((docItem) => {
            const item = document.createElement('div');
            item.className = 'result-doc-item';
            const label = document.createElement('strong');
            label.textContent = getDocumentTypeLabel(docItem.type);
            const value = document.createElement('span');
            const dateText = docItem.statut === 'manquant'
                ? '—'
                : docItem.dateExpiration ? new Date(docItem.dateExpiration).toLocaleDateString('fr-FR') : 'Sans expiration';
            value.textContent = `${docItem.numero || '—'} • ${dateText} • ${getDocumentStatusLabel(docItem.statut)}`;
            item.append(label, value);
            container.appendChild(item);
        });
    }

    function setVehicleView(section, vehicle, documents = []) {
        const matriculeEl = section.querySelector('.result-matricule');
        const modelEl = section.querySelector('.result-vehicle-model');
        const infoItems = section.querySelectorAll('.result-info-value');
        const statusEl = section.querySelector('.result-status-badge');
        const messageTitle = section.querySelector('.result-message strong');
        const messageText = section.querySelector('.result-message p');

        const status = String(vehicle.statut || '').trim().toLowerCase();
        const isCritical = status === 'non-conforme';
        const isWarning = status === 'surveiller';

        if (matriculeEl) matriculeEl.textContent = vehicle.matricule || '—';
        if (modelEl) modelEl.textContent = [vehicle.marque, vehicle.modele].filter(Boolean).join(' ') || '—';

        if (statusEl) {
            const statusText = isCritical ? 'Non conforme' : (isWarning ? 'À surveiller' : 'Conforme');
            statusEl.innerHTML = `<span class="status-mark"><svg viewBox="0 0 24 24"><path d="${isCritical ? 'M12 3.5 21 18.5a1 1 0 0 1-.87 1.5H3.87A1 1 0 0 1 3 18.5L12 3.5Z M12 9v4M12 16.5h.01' : 'M5 12.5 9.5 17 19 7.5'}"/></svg></span>${statusText}`;
            statusEl.classList.remove('result-status-critical', 'result-status-conforme', 'result-status-surveiller', 'result-status-non-conforme');
            statusEl.classList.add(isCritical ? 'result-status-critical' : isWarning ? 'result-status-surveiller' : 'result-status-conforme');
        }

        if (messageTitle) messageTitle.textContent = isCritical ? 'Véhicule non conforme' : (isWarning ? 'Véhicule à surveiller' : 'Véhicule conforme');
        if (messageText) messageText.textContent = isCritical
            ? getVehicleIssueMessage(documents, vehicle)
            : (isWarning
                ? getVehicleIssueMessage(documents, vehicle)
                : 'Toutes les vérifications sont satisfaites pour ce véhicule.');

        const message = section.querySelector('.result-message');
        if (message) {
            message.classList.remove('result-message-conforme', 'result-message-non-conforme', 'result-message-surveiller');
            message.classList.add(isCritical ? 'result-message-non-conforme' : isWarning ? 'result-message-surveiller' : 'result-message-conforme');
        }

        if (infoItems.length > 0) {
            infoItems[0].textContent = vehicle.proprietaire || '—';
        }
        if (infoItems.length > 1) {
            infoItems[1].textContent = vehicle.conducteur || vehicle.proprietaire || '—';
        }

        formatDocumentList(documents, vehicle, section);
        showSection(section);
    }

    async function createAlertEntry(matricule, vehicle) {
        const alerts = JSON.parse(localStorage.getItem('kapitrans-alerts') || '[]');
        const agentName = getCurrentAgentName();
        const entry = {
            id: `alert-${Date.now()}`,
            matricule,
            marque: vehicle.marque || '',
            proprietaire: vehicle.proprietaire || '',
            type: 'controle',
            gravite: 'critique',
            message: `Véhicule signalé: ${matricule}`,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            statut: 'nouveau',
            agent: agentName
        };

        alerts.push(entry);
        localStorage.setItem('kapitrans-alerts', JSON.stringify(alerts));

        try {
            await addDoc(collection(db, 'alerts'), {
                ...entry,
                agent: agentName,
                date: new Date().toISOString(),
                message: entry.message
            });
            await logAudit({
                actionType: 'create',
                action: 'Signalement',
                entite: 'Alerte',
                details: `Véhicule ${matricule} — signalé par ${agentName}`
            });
        } catch (error) {
            console.warn('Impossible d’enregistrer l’alerte dans Firestore.', error);
        }

        return entry;
    }

    function bindActionButtons(vehicle) {
        const verbalizeButton = resultNonConforme?.querySelector('.btn-danger');
        const reportButton = resultNonConforme?.querySelector('[data-report-vehicle]');

        if (verbalizeButton) {
            verbalizeButton.onclick = function () {
                const matricule = encodeURIComponent((vehicle && vehicle.matricule) || input.value.trim().toUpperCase());
                window.location.href = 'agent-verbalize.html?matricule=' + matricule;
            };
        }

        if (reportButton) {
            reportButton.onclick = async function () {
                await createAlertEntry(vehicle.matricule, vehicle);
                if (window.kapitransToast) {
                    window.kapitransToast('Signalement enregistré avec succès.', 'success');
                } else {
                    alert('✅ Signalement enregistré.');
                }
            };
        }
    }

    async function loadVehicleByMatricule(matricule) {
        const snapshot = await getDocs(collection(db, 'vehicles'));
        const normalizedMatricule = normalizeMatricule(matricule);
        const vehicleDocument = snapshot.docs.find((documentSnapshot) =>
            normalizeMatricule(documentSnapshot.data().matricule) === normalizedMatricule
        );
        return vehicleDocument
            ? { id: vehicleDocument.id, ...vehicleDocument.data() }
            : null;
    }

    async function loadDocumentsForVehicle(matricule) {
        try {
            const snapshot = await getDocs(collection(db, 'documents'));
            return snapshot.docs
                .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
                .filter((docItem) => String(docItem.matricule || '').trim().toUpperCase().replace(/\s+/g, '') === matricule.replace(/\s+/g, ''))
                .map((docItem) => {
                    let statut = String(docItem.statut || '').trim().toLowerCase();
                    if (docItem.dateExpiration) {
                        const expiration = new Date(`${docItem.dateExpiration}T23:59:59`).getTime();
                        if (Number.isFinite(expiration)) {
                            const daysRemaining = Math.ceil((expiration - Date.now()) / 86400000);
                            statut = daysRemaining < 0 ? 'expire' : daysRemaining < 30 ? 'bientot' : 'valide';
                        }
                    }
                    return { ...docItem, statut };
                });
        } catch (error) {
            console.error('Erreur de chargement des documents :', error);
            return [];
        }
    }

    function getVehicleStatus(vehicle, documents) {
        const requiredTypes = [
            ['certificat-controle-technique', 'visite-technique'],
            ['vignette'],
            ['attestation-assurance', 'assurance']
        ];
        if (vehicle.categorie === 'transport') requiredTypes.push(['autorisation-transport']);
        if (requiredTypes.some((types) => !documents.some((item) => types.includes(item.type)))) return 'non-conforme';
        if (documents.some((item) => ['expire', 'expiré', 'expired', 'non-conforme', 'non conforme'].includes(item.statut))) return 'non-conforme';
        if (documents.some((item) => ['bientot', 'bientôt', 'expiring'].includes(item.statut))) return 'surveiller';
        return 'conforme';
    }

    function addRecentSearch(matricule, status) {
        const entries = readRecentSearches();
        const nextEntries = [
            { matricule, status, label: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) },
            ...entries.filter((entry) => entry.matricule && entry.matricule !== matricule)
        ].slice(0, 5);
        saveRecentSearches(nextEntries);
        renderRecentSearches();
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const matricule = input.value.trim().toUpperCase();
        if (!matricule) {
            input.focus();
            return;
        }

        let vehicle;
        try {
            vehicle = await loadVehicleByMatricule(matricule);
        } catch (error) {
            console.error('Erreur de recherche Firestore :', error);
            alert(`❌ Impossible de rechercher le véhicule. Vérifiez la connexion et les droits Firestore. ${error.message || ''}`);
            return;
        }
        if (!vehicle) {
            alert('❌ Véhicule non trouvé : ' + matricule);
            showSection(resultConforme && resultConforme.style.display !== 'none' ? resultConforme : resultNonConforme);
            return;
        }

        const documents = await loadDocumentsForVehicle(matricule);
        vehicle.statut = getVehicleStatus(vehicle, documents);
        await logAudit({
            actionType: 'read',
            action: 'Recherche',
            entite: 'Véhicule',
            details: `${vehicle.matricule} — statut ${vehicle.statut}`
        });
        const section = vehicle.statut === 'conforme' ? resultConforme : resultNonConforme;
        if (!section) {
            alert('❌ Section de résultat introuvable sur la page.');
            return;
        }

        addRecentSearch(matricule, String(vehicle.statut || '').trim().toLowerCase());
        bindActionButtons(vehicle);
        setVehicleView(section, vehicle, documents);
    });

    renderRecentSearches();
});
