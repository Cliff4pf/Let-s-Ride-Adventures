// logout-helper.js - Centralized logout functionality
import { auth } from "../firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export async function handleLogout(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        // Sign out from Firebase
        await signOut(auth);
        
        // Clear local storage
        localStorage.removeItem('ridehub_token');
        localStorage.removeItem('ridehub_role');
        localStorage.removeItem('ridehub_user');

        // Redirect to login
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout error:", error);
        alert('Failed to logout. Please try again.');
    }
}

export function attachLogoutListener(logoutBtn) {
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}
