import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut, getIdToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import api from "./api.js";
import { handleLogout } from "./dashboard/logout-helper.js";

import { renderTouristUI } from "./dashboard/tourist.js";
import { renderDriverUI } from "./dashboard/driver.js";
import { renderSecretaryUI } from "./dashboard/secretary.js";
import { renderAdminUI } from "./dashboard/admin.js";

// Handle state hydration from Firebase -> Backend -> UI
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        const token = await getIdToken(user, true);
        localStorage.setItem('ridehub_token', token);

        const response = await fetch('http://localhost:5202/api/User/me', {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const apiRes = await response.json();
        const profile = apiRes.data;

        console.log('User profile:', profile);
        console.log('User role:', profile.role);

        if (profile.status !== 'Active') {
            throw new Error('Account inactive');
        }

        const role = profile.role;
        if (!role) {
            throw new Error('User has no role assigned');
        }

        // Initialize layout with profile data
        initializeDashboard(role, profile);
    } catch (error) {
        console.error("Dashboard initialization error:", error);
        await signOut(auth);
        localStorage.removeItem('ridehub_token');
        localStorage.removeItem('ridehub_role');
        window.location.href = 'index.html';
    }
});

async function initializeDashboard(role, profile) {
    // 1. Setup User Profile UI with actual data
    const roleElem = document.getElementById('userRole');
    if (roleElem) roleElem.textContent = role;

    const nameElem = document.getElementById('userName');
    if (nameElem) nameElem.textContent = profile.fullName || 'User';

    const avatarElem = document.getElementById('userAvatar');
    if (avatarElem) {
        const initials = (profile.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
        avatarElem.textContent = initials || 'U';
        // Store profile data in element for profile modal
        avatarElem.dataset.profile = JSON.stringify(profile);
    }

    // 2. Clear loading state
    const contentArea = document.getElementById('dashboardContent');
    const sidebarMenu = document.getElementById('sidebarMenu');
    sidebarMenu.innerHTML = '';
    contentArea.innerHTML = '';

    // 3. Render Role-Specific UI
    console.log('Initializing dashboard for role:', role.toLowerCase());
    switch (role.toLowerCase()) {
        case 'tourist':
            console.log('Rendering tourist UI');
            await renderTouristUI(sidebarMenu, contentArea);
            break;
        case 'driver':
            console.log('Rendering driver UI');
            await renderDriverUI(sidebarMenu, contentArea);
            break;
        case 'secretary':
            console.log('Rendering secretary UI');
            await renderSecretaryUI(sidebarMenu, contentArea);
            break;
        case 'admin':
            console.log('Rendering admin UI');
            await renderAdminUI(sidebarMenu, contentArea);
            break;
        default:
            console.error('Unknown role: ', role);
            window.location.href = 'index.html';
            break;
    }

    // Attach logout event (fallback)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}
