import { db } from './firebase.js';
import { logAudit } from './audit-log.js';
import { addDoc, collection, doc, getDocs, query, setDoc, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const form = document.getElementById('verbalize-form');
    if (!form) return;

    function getCurrentUserName() {
        try {
            const user = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
            if (user?.nom) return user.nom;
            if (user?.email) return user.email.split('@')[0];
        } catch (error) {
            console.warn('Impossible de lire le profil de l’agent.', error);
        }
        return 'Agent';
    }

    const urlParams = new URLSearchParams(window.location.search);
    const matricule = urlParams.get('matricule') || '';

    const matriculeEl = document.getElementById('verbalize-matricule');
    if (matriculeEl) matriculeEl.textContent = matricule || '—';

    const dateInput = document.getElementById('date-infraction');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    let vehicleData = null;

    try {
        if (matricule) {
            const vehicleSnapshot = await getDocs(query(collection(db, 'vehicles'), where('matricule', '==', matricule)));
            if (!vehicleSnapshot.empty) {
                const vehicle = vehicleSnapshot.docs[0].data();
                vehicleData = vehicle;
                const marqueEl = document.getElementById('verbalize-marque');
                const ownerEl = document.getElementById('verbalize-proprietaire');
                if (marqueEl) marqueEl.textContent = [vehicle.marque, vehicle.modele].filter(Boolean).join(' ') || '—';
                if (ownerEl) ownerEl.textContent = vehicle.proprietaire || '—';
            }
        }
    } catch (error) {
        console.error('Erreur de lecture du véhicule pour le PV :', error);
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const motif = document.getElementById('motif').value;
        const montant = document.getElementById('montant').value.trim();
        const zone = document.getElementById('zone').value.trim();
        const dateInfraction = dateInput?.value || new Date().toISOString().split('T')[0];
        const observations = document.getElementById('observations').value.trim();

        if (!motif || !montant) {
            alert('❌ Veuillez remplir le motif et le montant.');
            return;
        }

        try {
            const agentName = getCurrentUserName();
            const pvReference = doc(collection(db, 'pvs'));
            const numeroPv = `PV-${dateInfraction.replace(/-/g, '')}-${pvReference.id.slice(0, 6).toUpperCase()}`;
            const dateCreation = new Date().toISOString();

            await setDoc(pvReference, {
                numeroPv: numeroPv,
                matricule: matricule,
                vehicule: vehicleData ? [vehicleData.marque, vehicleData.modele].filter(Boolean).join(' ') : '',
                marque: vehicleData?.marque || '',
                modele: vehicleData?.modele || '',
                motif: motif,
                montant: montant,
                zone: zone,
                dateInfraction: dateInfraction,
                observations: observations,
                agent: agentName,
                dateCreation: dateCreation,
                statut: 'verbalise'
            });
            await logAudit({
                actionType: 'create',
                action: 'Création',
                entite: 'Procès-verbal',
                details: `${numeroPv} — ${matricule} — ${motif} — ${montant} FC`
            });

            await addDoc(collection(db, 'alerts'), {
                matricule: matricule,
                type: 'controle',
                gravite: 'critique',
                message: 'PV dressé : ' + motif,
                agent: agentName,
                date: new Date().toISOString(),
                statut: 'nouvelle'
            });

            alert('✅ PV enregistré avec succès !');
            window.location.href = 'agent-history.html';

        } catch (error) {
            console.error(error);
            alert('❌ Erreur : ' + error.message);
        }
    });
});
