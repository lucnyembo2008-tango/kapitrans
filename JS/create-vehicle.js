// ============================================================
// CREATE VEHICLE — KAPITRANS
// ============================================================
// Ce fichier enregistre un nouveau véhicule dans localStorage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE FORMULAIRE
    // ============================================================

    const form = document.getElementById('create-vehicle-form');
    if (!form) return;
    const locationButton = document.getElementById('get-current-location');
    if (locationButton) {
        locationButton.addEventListener('click', function () {
            if (!navigator.geolocation) {
                showMessage('La géolocalisation n’est pas disponible sur cet appareil.', 'error');
                return;
            }
            locationButton.disabled = true;
            navigator.geolocation.getCurrentPosition(function (position) {
                form.querySelector('input[name="lat"]').value = position.coords.latitude;
                form.querySelector('input[name="lng"]').value = position.coords.longitude;
                locationButton.disabled = false;
                showMessage('Position GPS récupérée. Vérifiez qu’elle correspond au véhicule.', 'success');
            }, function () {
                locationButton.disabled = false;
                showMessage('Position GPS indisponible. Saisissez les coordonnées manuellement.', 'error');
            }, { enableHighAccuracy: true, timeout: 10000 });
        });
    }

    // ============================================================
    // 2. ÉCOUTER LA SOUMISSION
    // ============================================================

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // ============================================================
        // 3. RÉCUPÉRER LES VALEURS
        // ============================================================

        const matricule = form.querySelector('input[name="matricule"]').value.trim().toUpperCase();
        const vin = form.querySelector('input[name="vin"]').value.trim();
        const marque = form.querySelector('input[name="marque"]').value.trim();
        const modele = form.querySelector('input[name="modele"]').value.trim();
        const annee = form.querySelector('input[name="annee"]').value.trim();
        const couleur = form.querySelector('input[name="couleur"]').value.trim();
        const categorie = form.querySelector('select[name="categorie"]').value;
        const type = form.querySelector('input[name="type"]').value.trim();
        const capacite = form.querySelector('input[name="capacite"]').value.trim();
        const usage = form.querySelector('select[name="usage"]').value;
        const province = form.querySelector('select[name="province"]').value;
        const ville = form.querySelector('input[name="ville"]').value.trim();
        const zone = form.querySelector('input[name="zone"]').value.trim();
        const latitudeValue = form.querySelector('input[name="lat"]').value.trim();
        const longitudeValue = form.querySelector('input[name="lng"]').value.trim();

        const proprietaireNom = form.querySelector('input[name="proprietaire-nom"]').value.trim();
        const proprietairePrenom = form.querySelector('input[name="proprietaire-prenom"]').value.trim();
        const proprietaireTelephone = form.querySelector('input[name="proprietaire-telephone"]').value.trim();
        const proprietaireEmail = form.querySelector('input[name="proprietaire-email"]').value.trim();

        const carteGrise = form.querySelector('input[name="carte-grise"]').value.trim();
        const dateCarteGrise = form.querySelector('input[name="date-carte-grise"]').value;
        const assurance = form.querySelector('input[name="assurance"]').value.trim();
        const dateAssurance = form.querySelector('input[name="date-assurance"]').value;
        const visiteTechnique = form.querySelector('input[name="visite-technique"]').value.trim();
        const dateVisite = form.querySelector('input[name="date-visite"]').value;

        // ============================================================
        // 4. VÉRIFIER LES CHAMPS OBLIGATOIRES
        // ============================================================

        if (!matricule || !vin || !marque || !modele || !categorie || !province) {
            showMessage('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }

        if (Boolean(latitudeValue) !== Boolean(longitudeValue)) {
            showMessage('Renseignez la latitude et la longitude ensemble.', 'error');
            return;
        }
        const latitude = latitudeValue ? Number(latitudeValue) : null;
        const longitude = longitudeValue ? Number(longitudeValue) : null;
        if (latitudeValue && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
            showMessage('Les coordonnées GPS ne sont pas valides.', 'error');
            return;
        }

        if (!proprietaireNom || !proprietairePrenom) {
            showMessage('Le nom et le prénom du propriétaire sont obligatoires.', 'error');
            return;
        }

        // ============================================================
        // 5. VÉRIFIER QUE LE MATRICULE N'EXISTE PAS DÉJÀ
        // ============================================================

        const vehicles = JSON.parse(localStorage.getItem('kapitrans-vehicles') || '{}');

        if (vehicles[matricule]) {
            showMessage('Ce matricule existe déjà.', 'error');
            return;
        }

        // ============================================================
        // 6. CALCULER LE STATUT
        // ============================================================

        function getStatus(dateExpiration) {
            if (!dateExpiration) return 'conforme';
            const today = new Date();
            const expiry = new Date(dateExpiration);
            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) return 'non-conforme';
            if (diffDays < 30) return 'surveiller';
            return 'conforme';
        }

        const statuses = [
            getStatus(dateCarteGrise),
            getStatus(dateAssurance),
            getStatus(dateVisite)
        ];

        let statut = 'conforme';
        if (statuses.includes('non-conforme')) statut = 'non-conforme';
        else if (statuses.includes('surveiller')) statut = 'surveiller';

        // ============================================================
        // 7. CRÉER LE VÉHICULE
        // ============================================================

        const newVehicle = {
            matricule: matricule,
            vin: vin,
            marque: marque,
            modele: modele,
            annee: annee,
            couleur: couleur,
            categorie: categorie,
            type: type,
            capacite: capacite,
            usage: usage,
            province: province,
            ville: ville,
            zone: zone,
            lat: latitude,
            lng: longitude,
            proprietaire: {
                nom: proprietaireNom + ' ' + proprietairePrenom,
                telephone: proprietaireTelephone,
                email: proprietaireEmail
            },
            documents: {
                carteGrise: { numero: carteGrise, expiration: dateCarteGrise },
                assurance: { numero: assurance, expiration: dateAssurance },
                visiteTechnique: { numero: visiteTechnique, expiration: dateVisite }
            },
            statut: statut,
            dateCreation: new Date().toISOString()
        };

        // ============================================================
        // 8. SAUVEGARDER
        // ============================================================

        vehicles[matricule] = newVehicle;
        localStorage.setItem('kapitrans-vehicles', JSON.stringify(vehicles));
        let auditFailed = false;
        try {
            const session = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
            window.kapitransAudit?.add(session?.nom, 'Création véhicule', 'create', 'VEHICLE', matricule);
        } catch (error) {
            auditFailed = true;
            console.error('Véhicule enregistré, mais le journal d’audit n’a pas pu être actualisé.', error);
        }

        // ============================================================
        // 9. SUCCÈS
        // ============================================================

        showMessage(auditFailed
            ? 'Véhicule enregistré, mais le journal d’audit n’a pas pu être actualisé.'
            : 'Véhicule enregistré avec succès !', 'success');

        setTimeout(function () {
            window.location.href = 'admin-vehicles.html';
        }, 1500);
    });

    // ============================================================
    // 10. AFFICHER UN MESSAGE
    // ============================================================

    function showMessage(message, type) {
        window.kapitransToast(message, type);
    }

});