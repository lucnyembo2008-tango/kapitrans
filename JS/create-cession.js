import { db } from './firebase.js';
import { logAudit } from './audit-log.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('create-cession-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const matricule = form.querySelector('input[name="vehicule-matricule"]').value.trim().toUpperCase();
        const nouveauNom = form.querySelector('input[name="nouveau-nom"]').value.trim();
        const nouveauPrenom = form.querySelector('input[name="nouveau-prenom"]').value.trim();
        const nouveauTelephone = form.querySelector('input[name="nouveau-telephone"]').value.trim();
        const dateCession = form.querySelector('input[name="date-cession"]').value;

        if (!matricule || !nouveauNom || !nouveauPrenom || !nouveauTelephone || !dateCession) {
            alert('❌ Veuillez remplir tous les champs obligatoires.');
            return;
        }

        try {
            await addDoc(collection(db, "cessions"), {
                matricule: matricule,
                nouveauProprietaire: nouveauNom + ' ' + nouveauPrenom,
                nouveauTelephone: nouveauTelephone,
                dateCession: dateCession,
                statut: 'attente',
                dateCreation: new Date().toISOString()
            });
            await logAudit({
                actionType: 'create',
                action: 'Création',
                entite: 'Cession',
                details: `${matricule} — nouveau propriétaire : ${nouveauNom} ${nouveauPrenom}`
            });

            alert('✅ Cession enregistrée avec succès !');
            window.location.href = 'admin-cessions.html';

        } catch (error) {
            console.error(error);
            alert('❌ Erreur : ' + error.message);
        }
    });
});
