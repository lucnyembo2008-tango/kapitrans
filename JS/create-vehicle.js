import { db, storage } from './firebase.js';
import { logAudit } from './audit-log.js';
import { collection, doc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('create-vehicle-form');
    if (!form) return;

    const statusMessage = document.getElementById('create-vehicle-status');
    const submitButton = form.querySelector('button[type="submit"]');

    function showFormStatus(message, type) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `form-feedback form-feedback-${type}`;
        statusMessage.hidden = false;
    }

    form.addEventListener('invalid', function () {
        showFormStatus('Complétez les champs obligatoires, notamment la province, la position GPS et le propriétaire.', 'error');
    }, true);

    const locationButton = document.getElementById('get-current-location');
    locationButton?.addEventListener('click', function () {
        if (!navigator.geolocation) {
            alert('❌ La géolocalisation n’est pas disponible dans ce navigateur.');
            return;
        }

        locationButton.disabled = true;
        navigator.geolocation.getCurrentPosition(
            function (position) {
                form.querySelector('input[name="lat"]').value = position.coords.latitude;
                form.querySelector('input[name="lng"]').value = position.coords.longitude;
                locationButton.disabled = false;
            },
            function (error) {
                locationButton.disabled = false;
                console.error('Impossible de récupérer la position GPS.', error);
                if (error.code === error.PERMISSION_DENIED) {
                    alert('❌ Autorisez l’accès à votre position dans les paramètres du navigateur.');
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    alert('❌ Votre position est actuellement indisponible.');
                } else if (error.code === error.TIMEOUT) {
                    alert('❌ La recherche de position a expiré. Réessayez.');
                } else {
                    alert('❌ Impossible de récupérer votre position GPS.');
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (statusMessage) statusMessage.hidden = true;

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

        const proprietaireNom = form.querySelector('input[name="proprietaire-nom"]').value.trim();
        const proprietairePrenom = form.querySelector('input[name="proprietaire-prenom"]').value.trim();
        const conducteur = form.querySelector('input[name="conducteur"]').value.trim();
        const numeroPermis = form.querySelector('input[name="permis-numero"]').value.trim();
        const expirationPermis = form.querySelector('input[name="permis-expiration"]').value;
        const fichierPermis = form.querySelector('input[name="permis-fichier"]').files[0] || null;
        const latitude = Number(form.querySelector('input[name="lat"]').value);
        const longitude = Number(form.querySelector('input[name="lng"]').value);
        const province = form.querySelector('select[name="province"]').value;
        const ville = form.querySelector('input[name="ville"]').value.trim();
        const zone = form.querySelector('input[name="zone"]').value.trim();

        if (!matricule || !vin || !marque || !modele || !categorie) {
            alert('❌ Veuillez remplir tous les champs obligatoires.');
            return;
        }

        if (!form.querySelector('input[name="lat"]').value.trim() ||
            !form.querySelector('input[name="lng"]').value.trim() ||
            !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            showFormStatus('Saisissez une latitude et une longitude GPS valides pour localiser le véhicule.', 'error');
            form.querySelector('input[name="lat"]').focus();
            return;
        }

        if (numeroPermis && !expirationPermis) {
            alert('❌ Renseignez la date d’expiration du permis de conduire.');
            form.querySelector('input[name="permis-expiration"]').focus();
            return;
        }

        if (expirationPermis && !numeroPermis) {
            alert('❌ Renseignez le numéro du permis de conduire.');
            form.querySelector('input[name="permis-numero"]').focus();
            return;
        }

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Enregistrement...';
            }
            const vehicleRef = doc(collection(db, 'vehicles'));
            const batch = writeBatch(db);
            let permitRef = null;
            const vehicleData = {
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
                proprietaire: proprietaireNom + ' ' + proprietairePrenom,
                conducteur: conducteur,
                numeroPermis: numeroPermis,
                expirationPermis: expirationPermis,
                statut: 'non-conforme',
                dateCreation: new Date().toISOString()
            };

            batch.set(vehicleRef, vehicleData);

            if (numeroPermis) {
                permitRef = doc(collection(db, 'documents'));
                const daysRemaining = Math.ceil((new Date(`${expirationPermis}T23:59:59`).getTime() - Date.now()) / 86400000);
                batch.set(permitRef, {
                    matricule: matricule,
                    type: 'permis',
                    organisme: '',
                    numero: numeroPermis,
                    dateEmission: '',
                    dateExpiration: expirationPermis,
                    vehiculeId: vehicleRef.id,
                    marque: marque,
                    modele: modele,
                    proprietaire: vehicleData.proprietaire,
                    statut: daysRemaining < 0 ? 'expire' : daysRemaining < 30 ? 'bientot' : 'valide',
                    dateCreation: new Date().toISOString()
                });
            }

            await batch.commit();
            await logAudit({
                actionType: 'create',
                action: 'Création',
                entite: 'Véhicule',
                details: `${matricule} — ${marque} ${modele}`
            });
            showFormStatus(
                fichierPermis
                    ? 'Véhicule enregistré avec succès. Ajout du permis en cours...'
                    : 'Véhicule enregistré avec succès. Redirection en cours...',
                'success'
            );
            if (submitButton) submitButton.textContent = 'Véhicule enregistré';

            if (fichierPermis) {
                const safeFileName = fichierPermis.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const attachmentPath = `vehicles/${vehicleRef.id}/permis/${Date.now()}-${safeFileName}`;
                const attachmentRef = ref(storage, attachmentPath);
                try {
                    await uploadBytes(attachmentRef, fichierPermis, {
                        contentType: fichierPermis.type || 'application/octet-stream'
                    });
                    const attachment = {
                        nom: fichierPermis.name,
                        url: await getDownloadURL(attachmentRef),
                        chemin: attachmentPath,
                        typeMime: fichierPermis.type || '',
                        taille: fichierPermis.size
                    };
                    const attachmentUpdates = [updateDoc(vehicleRef, { permisFichier: attachment })];
                    if (permitRef) attachmentUpdates.push(updateDoc(permitRef, { pieceJointe: attachment }));
                    await Promise.all(attachmentUpdates);
                } catch (storageError) {
                    await deleteObject(attachmentRef).catch(() => {});
                    console.error('Le véhicule est enregistré, mais le fichier du permis n’a pas pu être joint.', storageError);
                    showFormStatus(`Véhicule créé, mais le fichier du permis n’a pas pu être enregistré : ${storageError.message || 'vérifiez les règles Firebase Storage'}`, 'error');
                    window.setTimeout(() => {
                        window.location.href = 'admin-vehicles.html';
                    }, 3500);
                    return;
                }
            }

            showFormStatus(
                fichierPermis
                    ? 'Véhicule et permis enregistrés avec succès. Redirection en cours...'
                    : 'Véhicule enregistré avec succès. Redirection en cours...',
                'success'
            );
            window.setTimeout(() => {
                window.location.href = 'admin-vehicles.html';
            }, 1800);

        } catch (error) {
            console.error(error);
            const message = error.code === 'permission-denied'
                ? 'Firebase a refusé la création. Vérifiez les règles Firestore et les droits du compte connecté.'
                : error.code === 'storage/unauthorized'
                    ? 'Firebase Storage a refusé le fichier du permis. Vérifiez ses règles de sécurité.'
                    : `La création a échoué : ${error.message || 'erreur inconnue'}`;
            showFormStatus(message, 'error');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = '<span aria-hidden="true">＋</span> Enregistrer le véhicule';
            }
        }
    });
});
