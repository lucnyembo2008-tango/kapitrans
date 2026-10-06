// ============================================================
// CREATE DOCUMENT — KAPITRANS
// ============================================================
// Ce fichier enregistre un nouveau document dans localStorage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE FORMULAIRE
    // ============================================================

    const form = document.getElementById('create-document-form');
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
        const typeDocument = form.querySelector('select[name="type-document"]').value;
        const organisme = form.querySelector('input[name="organisme"]').value.trim();
        const numeroDocument = form.querySelector('input[name="numero-document"]').value.trim();
        const dateEmission = form.querySelector('input[name="date-emission"]').value;
        const dateExpiration = form.querySelector('input[name="date-expiration"]').value;

        // ============================================================
        // 4. VÉRIFIER LES CHAMPS OBLIGATOIRES
        // ============================================================

        if (!matricule || !typeDocument || !numeroDocument || !dateEmission || !dateExpiration) {
            showMessage('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }

        // ============================================================
        // 5. CALCULER LE STATUT
        // ============================================================

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

        // ============================================================
        // 6. CRÉER LE DOCUMENT
        // ============================================================

        const newDocument = {
            matricule: matricule,
            type: typeDocument,
            organisme: organisme,
            numero: numeroDocument,
            dateEmission: dateEmission,
            dateExpiration: dateExpiration,
            statut: statut,
            dateCreation: new Date().toISOString()
        };

        // ============================================================
        // 7. SAUVEGARDER
        // ============================================================

        const documents = JSON.parse(localStorage.getItem('kapitrans-documents') || '[]');
        documents.push(newDocument);
        localStorage.setItem('kapitrans-documents', JSON.stringify(documents));
        let auditFailed = false;
        try {
            const session = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
            window.kapitransAudit?.add(session?.nom, 'Création document', 'create', 'DOCUMENT', `${typeDocument} — ${matricule}`);
        } catch (error) {
            auditFailed = true;
            console.error('Document enregistré, mais le journal d’audit n’a pas pu être actualisé.', error);
        }

        // ============================================================
        // 8. SUCCÈS
        // ============================================================

        showMessage(auditFailed
            ? 'Document enregistré, mais le journal d’audit n’a pas pu être actualisé.'
            : 'Document enregistré avec succès !', 'success');

        setTimeout(function () {
            window.location.href = 'admin-documents.html';
        }, 1500);
    });

    // ============================================================
    // 9. AFFICHER UN MESSAGE
    // ============================================================

    function showMessage(message, type) {
        window.kapitransToast(message, type);
    }

});