// ============================================================
// CREATE CESSION — KAPITRANS
// ============================================================
// Ce fichier enregistre une nouvelle cession dans localStorage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE FORMULAIRE
    // ============================================================

    const form = document.getElementById('create-cession-form');
    if (!form) return;

    // ============================================================
    // 2. ÉCOUTER LA SOUMISSION
    // ============================================================

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // ============================================================
        // 3. RÉCUPÉRER LES VALEURS
        // ============================================================

        const matricule = form.querySelector('input[name="vehicule-matricule"]').value.trim().toUpperCase();
        const modele = form.querySelector('input[name="vehicule-modele"]').value.trim();
        const categorie = form.querySelector('input[name="vehicule-categorie"]').value.trim();
        const motif = form.querySelector('input[name="motif"]').value.trim();

        const ancienNom = form.querySelector('input[name="ancien-nom"]').value.trim();
        const ancienTelephone = form.querySelector('input[name="ancien-telephone"]').value.trim();
        const ancienDate = form.querySelector('input[name="ancien-date"]').value;
        const typeCession = form.querySelector('select[name="type-cession"]').value;

        const nouveauNom = form.querySelector('input[name="nouveau-nom"]').value.trim();
        const nouveauPrenom = form.querySelector('input[name="nouveau-prenom"]').value.trim();
        const nouveauTelephone = form.querySelector('input[name="nouveau-telephone"]').value.trim();
        const nouveauEmail = form.querySelector('input[name="nouveau-email"]').value.trim();
        const nouveauPiece = form.querySelector('input[name="nouveau-piece"]').value.trim();
        const nouveauAdresse = form.querySelector('input[name="nouveau-adresse"]').value.trim();

        const dateCession = form.querySelector('input[name="date-cession"]').value;
        const prixCession = form.querySelector('input[name="prix-cession"]').value.trim();
        const observations = form.querySelector('textarea[name="observations"]').value.trim();

        // ============================================================
        // 4. VÉRIFIER LES CHAMPS OBLIGATOIRES
        // ============================================================

        if (!matricule || !nouveauNom || !nouveauPrenom || !nouveauTelephone || !dateCession) {
            showMessage('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }

        // ============================================================
        // 5. CRÉER LA CESSION
        // ============================================================

        const newCession = {
            matricule: matricule,
            modele: modele,
            categorie: categorie,
            motif: motif,
            ancienProprietaire: {
                nom: ancienNom,
                telephone: ancienTelephone,
                dateAcquisition: ancienDate
            },
            typeCession: typeCession,
            nouveauProprietaire: {
                nom: nouveauNom,
                prenom: nouveauPrenom,
                telephone: nouveauTelephone,
                email: nouveauEmail,
                piece: nouveauPiece,
                adresse: nouveauAdresse
            },
            dateCession: dateCession,
            prix: prixCession,
            observations: observations,
            statut: 'attente',
            dateCreation: new Date().toISOString()
        };

        // ============================================================
        // 6. SAUVEGARDER
        // ============================================================

        const cessions = JSON.parse(localStorage.getItem('kapitrans-cessions') || '[]');
        cessions.push(newCession);
        localStorage.setItem('kapitrans-cessions', JSON.stringify(cessions));
        let auditFailed = false;
        try {
            const session = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
            window.kapitransAudit?.add(session?.nom, 'Création cession', 'create', 'CESSION', matricule);
        } catch (error) {
            auditFailed = true;
            console.error('Cession enregistrée, mais le journal d’audit n’a pas pu être actualisé.', error);
        }

        // ============================================================
        // 7. SUCCÈS
        // ============================================================

        showMessage(auditFailed
            ? 'Cession enregistrée, mais le journal d’audit n’a pas pu être actualisé.'
            : 'Cession enregistrée avec succès !', 'success');

        setTimeout(function () {
            window.location.href = 'admin-cessions.html';
        }, 1500);
    });

    // ============================================================
    // 8. AFFICHER UN MESSAGE
    // ============================================================

    function showMessage(message, type) {
        window.kapitransToast(message, type);
    }

});