import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut, getIdToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import api from "./api.js";

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

        if (profile.status !== 'Active') {
            throw new Error('Account inactive');
        }

        const role = profile.role;
        if (!role) {
            throw new Error('User has no role assigned');
        }

        // Initialize layout
        initializeDashboard(role);
    } catch (error) {
        console.error("Dashboard initialization error:", error);
        await signOut(auth);
        localStorage.removeItem('ridehub_token');
        localStorage.removeItem('ridehub_role');
        window.location.href = 'index.html';
    }
});

async function initializeDashboard(role) {
    // 1. Setup User Profile UI
    const roleElem = document.getElementById('userRole');
    if (roleElem) roleElem.textContent = role;

    const nameElem = document.getElementById('userName');
    if (nameElem && role === 'Admin') nameElem.textContent = 'Administrator';
    if (nameElem && role === 'Tourist') nameElem.textContent = 'Tourist User';

    // 2. Clear loading state
    const contentArea = document.getElementById('dashboardContent');
    const sidebarMenu = document.getElementById('sidebarMenu');
    sidebarMenu.innerHTML = '';
    contentArea.innerHTML = '';

    // 3. Render Role-Specific UI
    switch (role) {
        case 'Tourist':
            await renderTouristUI(sidebarMenu, contentArea);
            break;
        case 'Driver':
            await renderDriverUI(sidebarMenu, contentArea);
            break;
        case 'Secretary':
            await renderSecretaryUI(sidebarMenu, contentArea);
            break;
        case 'Admin':
            await renderAdminUI(sidebarMenu, contentArea);
            break;
        default:
            console.error('Unknown role: ', role);
            window.location.href = 'index.html';
            break;
    }

    // Attach logout event
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                localStorage.removeItem('ridehub_token');
                localStorage.removeItem('ridehub_role');
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Logout error", error);
            }
        });
    }
}
