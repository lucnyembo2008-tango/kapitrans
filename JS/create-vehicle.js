import { db } from './firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('create-vehicle-form');
    if (!form) return;

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
        const latitude = Number(form.querySelector('input[name="lat"]').value);
        const longitude = Number(form.querySelector('input[name="lng"]').value);
        const province = form.querySelector('select[name="province"]').value;
        const ville = form.querySelector('input[name="ville"]').value.trim();
        const zone = form.querySelector('input[name="zone"]').value.trim();

        if (!matricule || !vin || !marque || !modele || !categorie) {
            alert('❌ Veuillez remplir tous les champs obligatoires.');
            return;
        }

        let statut = 'conforme';

        try {
            await addDoc(collection(db, "vehicles"), {
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
                statut: statut,
                dateCreation: new Date().toISOString()
            });

            alert('✅ Véhicule enregistré avec succès !');
            window.location.href = 'admin-vehicles.html';

        } catch (error) {
            console.error(error);
            alert('❌ Erreur : ' + error.message);
        }
    });
});
