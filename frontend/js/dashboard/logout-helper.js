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
        localStorage.removeItem('ridehub_role');
        localStorage.removeItem('ridehub_user');

        // Redirect to login
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout error:", error);
        alert('Failed to logout. Please try again.');
    }
}

// helper that binds handleLogout to both known logout targets
export function attachLogoutListener(logoutBtn) {
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

export function initializeLogoutButtons() {
    // central hookup for sidebar and settings buttons (used by older code paths)
    ['#logoutBtn', '#logoutSettingBtn'].forEach(sel => {
        const el = document.querySelector(sel);
        if (el) {
            el.addEventListener('click', handleLogout);
        }
    });
}

// automatically wire when document is ready so pages don't have to remember
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLogoutButtons);
} else {
    initializeLogoutButtons();
}

// -------------------------------------------------------------
// Global delegation: catch clicks on logout elements even if they
// are replaced later (sidebar re-render, dynamic insertion, etc.)
// This solves the "one works but the other doesn’t" problem.
// -------------------------------------------------------------
document.body.addEventListener('click', (e) => {
    const target = e.target.closest('#logoutBtn, #logoutSettingBtn');
    if (target) {
        handleLogout(e);
    }
});
