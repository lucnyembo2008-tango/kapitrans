import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('.login-form');
    if (!form) return;

    let errorDiv = document.querySelector('.login-error');
    if (!errorDiv) {
        errorDiv = document.createElement('p');
        errorDiv.className = 'login-error';
        errorDiv.style.color = '#fca5a5';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.marginTop = '1rem';
        errorDiv.style.fontSize = '0.9rem';
        errorDiv.style.fontWeight = '600';
        form.appendChild(errorDiv);
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim().toLowerCase();
        const password = document.getElementById('password').value.trim();
        errorDiv.textContent = '';

        if (!username || !password) {
            errorDiv.textContent = '❌ Veuillez remplir tous les champs.';
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, username, password);
            const user = userCredential.user;

            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                
                errorDiv.style.color = '#86efac';
                errorDiv.textContent = '✅ Connexion réussie. Redirection...';

                localStorage.setItem('kapitrans-user', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    nom: userData.nom,
                    role: userData.role
                }));

                setTimeout(function () {
                    if (userData.role === 'ADMIN') window.location.href = 'admin-dashboard.html';
                    else if (userData.role === 'AGENT') window.location.href = 'agent-search.html';
                    else window.location.href = 'admin-dashboard.html';
                }, 800);
            } else {
                errorDiv.textContent = '❌ Profil introuvable dans la base de données.';
            }

        } catch (error) {
            console.error(error);
            errorDiv.textContent = '❌ Email ou mot de passe incorrect.';
        }
    });
});
