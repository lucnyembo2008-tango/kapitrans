import { db } from './firebase.js';
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function logAudit({ actionType, action, entite, details }) {
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
    } catch (error) {
        console.warn('Impossible de lire l’utilisateur pour le journal d’audit.', error);
    }

    try {
        const now = new Date();
        await addDoc(collection(db, 'audit'), {
            date: now.toLocaleString('fr-FR'),
            timestamp: now.toISOString(),
            utilisateur: user?.nom || user?.email || 'Utilisateur',
            uid: user?.uid || '',
            actionType: actionType || 'update',
            action: action || 'Action',
            entite: entite || 'Système',
            details: details || '',
            ip: '—'
        });
        return true;
    } catch (error) {
        console.warn('Impossible d’enregistrer l’action dans le journal d’audit.', error);
        return false;
    }
}