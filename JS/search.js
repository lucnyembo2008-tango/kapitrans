import { db } from './firebase.js';
import { addDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const form = document.getElementById('vehicle-search-form');
    const input = document.getElementById('vehicle-registration');
    const resultConforme = document.getElementById('result-conforme');
    const resultNonConforme = document.getElementById('result-non-conforme');
    const recentList = document.querySelector('.recent-list');

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

    function getDocumentIssueText(docItem) {
        const statut = String(docItem.statut || '').trim().toLowerCase();
        const label = docItem.type || 'Document';
        if (statut === 'expire' || statut === 'expiré' || statut === 'expired') return `${label} — expiré`;
        if (statut === 'bientot' || statut === 'bientôt' || statut === 'expiring') return `${label} — expire bientôt`;
        if (statut === 'non-conforme' || statut === 'non conforme') return `${label} — non conforme`;
        return `${label} — valide`;
    }

    function formatDocumentList(documents, vehicle) {
        const container = document.querySelector('#result-conforme .result-doc-list, #result-non-conforme .result-doc-list');
        if (!container) return;
        container.innerHTML = '';

        const problemDocuments = documents.filter((docItem) => {
            const type = String(docItem.statut || '').trim().toLowerCase();
            return type === 'expire' || type === 'expiré' || type === 'expired' || type === 'bientot' || type === 'bientôt' || type === 'expiring' || type === 'non-conforme' || type === 'non conforme';
        });

        const displayDocuments = problemDocuments.length ? problemDocuments : documents;

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
            label.textContent = docItem.type || 'Document';
            const value = document.createElement('span');
            const dateText = docItem.dateExpiration ? new Date(docItem.dateExpiration).toLocaleDateString('fr-FR') : '—';
            const issueText = getDocumentIssueText(docItem);
            value.textContent = `${docItem.numero || '—'} • ${dateText} • ${issueText.replace(`${docItem.type || 'Document'} — `, '')}`;
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

        const isCritical = String(vehicle.statut || '').trim().toLowerCase() === 'non-conforme';

        if (matriculeEl) matriculeEl.textContent = vehicle.matricule || '—';
        if (modelEl) modelEl.textContent = [vehicle.marque, vehicle.modele].filter(Boolean).join(' ') || '—';

        if (statusEl) {
            const statusText = isCritical ? 'Critique' : (vehicle.statut === 'surveiller' ? 'À surveiller' : 'Conforme');
            statusEl.innerHTML = `<span class="status-mark"><svg viewBox="0 0 24 24"><path d="${isCritical ? 'M12 3.5 21 18.5a1 1 0 0 1-.87 1.5H3.87A1 1 0 0 1 3 18.5L12 3.5Z M12 9v4M12 16.5h.01' : 'M5 12.5 9.5 17 19 7.5'}"/></svg></span>${statusText}`;
            if (isCritical) {
                statusEl.classList.add('result-status-critical');
                statusEl.classList.remove('result-status-conforme');
            } else {
                statusEl.classList.remove('result-status-critical');
            }
        }

        if (messageTitle) messageTitle.textContent = isCritical ? 'Véhicule non conforme' : (vehicle.statut === 'surveiller' ? 'Véhicule à surveiller' : 'Véhicule conforme');
        if (messageText) messageText.textContent = isCritical
            ? 'Le véhicule présente des documents ou éléments non conformes. Vérification requise.'
            : (vehicle.statut === 'surveiller'
                ? 'Des éléments nécessitent une vérification ou une action de contrôle.'
                : 'Toutes les vérifications sont satisfaites pour ce véhicule.');

        if (infoItems.length > 0) {
            infoItems[0].textContent = vehicle.proprietaire || '—';
        }
        if (infoItems.length > 1) {
            infoItems[1].textContent = vehicle.conducteur || vehicle.proprietaire || '—';
        }

        formatDocumentList(documents, vehicle);
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
        try {
            const snapshot = await getDocs(query(collection(db, 'vehicles'), where('matricule', '==', matricule)));
            if (snapshot.empty) return null;
            const vehicle = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            return vehicle;
        } catch (error) {
            console.error('Erreur de recherche Firestore :', error);
            return null;
        }
    }

    async function loadDocumentsForVehicle(matricule) {
        try {
            const snapshot = await getDocs(collection(db, 'documents'));
            return snapshot.docs
                .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
                .filter((docItem) => String(docItem.matricule || '').toUpperCase() === matricule);
        } catch (error) {
            console.error('Erreur de chargement des documents :', error);
            return [];
        }
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

        const vehicle = await loadVehicleByMatricule(matricule);
        if (!vehicle) {
            alert('❌ Véhicule non trouvé : ' + matricule);
            showSection(resultConforme && resultConforme.style.display !== 'none' ? resultConforme : resultNonConforme);
            return;
        }

        const documents = await loadDocumentsForVehicle(matricule);
        const section = String(vehicle.statut || '').trim().toLowerCase() === 'conforme' ? resultConforme : resultNonConforme;
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
