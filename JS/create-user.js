import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('create-user-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Récupérer les valeurs
        const nom = form.querySelector('input[name="nom"]').value.trim();
        const prenom = form.querySelector('input[name="prenom"]').value.trim();
        const email = form.querySelector('input[name="email"]').value.trim().toLowerCase();
        const telephone = form.querySelector('input[name="telephone"]').value.trim();
        const role = form.querySelector('select[name="role"]').value;
        const zone = form.querySelector('input[name="zone"]').value.trim();
        const password = form.querySelector('input[name="password"]').value;
        const passwordConfirm = form.querySelector('input[name="password-confirm"]').value;

        // Vérifications
        if (!nom || !prenom || !email || !role || !password) {
            alert('❌ Veuillez remplir tous les champs obligatoires.');
            return;
        }

        if (password !== passwordConfirm) {
            alert('❌ Les mots de passe ne correspondent pas.');
            return;
        }

        if (password.length < 6) {
            alert('❌ Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }

        // Définir le rôle Firebase
        let firebaseRole = 'AGENT';
        if (role === 'Administrateur') firebaseRole = 'ADMIN';
        else if (role === 'Superviseur') firebaseRole = 'SUPERVISEUR';
        else if (role === 'Garage') firebaseRole = 'GARAGE';
        else if (role === 'DGI') firebaseRole = 'DGI';

        try {
            // 1. Créer l'utilisateur dans Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Créer son profil dans Firestore
            await setDoc(doc(db, "users", user.uid), {
                nom: nom + ' ' + prenom,
                email: email,
                telephone: telephone,
                role: firebaseRole,
                zone: zone,
                dateCreation: new Date().toISOString()
            });

            alert('✅ Utilisateur créé avec succès !');
            window.location.href = 'admin-users.html';

        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                alert('❌ Cet email est déjà utilisé.');
            } else {
                alert('❌ Erreur : ' + error.message);
            }
        }
    });
});
