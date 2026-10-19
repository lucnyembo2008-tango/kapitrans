import { db } from './firebase.js';
import { addDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

    try {
        if (matricule) {
            const vehicleSnapshot = await getDocs(query(collection(db, 'vehicles'), where('matricule', '==', matricule)));
            if (!vehicleSnapshot.empty) {
                const vehicle = vehicleSnapshot.docs[0].data();
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
        const observations = document.getElementById('observations').value.trim();

        if (!motif || !montant) {
            alert('❌ Veuillez remplir le motif et le montant.');
            return;
        }

        try {
            const agentName = getCurrentUserName();

            await addDoc(collection(db, 'pvs'), {
                matricule: matricule,
                motif: motif,
                montant: montant,
                zone: zone,
                observations: observations,
                agent: agentName,
                dateCreation: new Date().toISOString(),
                statut: 'verbalise'
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
