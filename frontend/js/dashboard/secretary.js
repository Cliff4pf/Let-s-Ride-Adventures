import api from "../api.js";
import { icons, createNavItem, showToast } from "./shared.js";
import { attachLogoutListener } from "./logout-helper.js";
import { initializeProfileModal, openProfileModal } from "./profile-modal.js";
import { showBookingDetailModal } from "./booking-detail-modal.js";

let secretaryState = {
    activeTab: 'dashboard' // 'dashboard', 'create-booking', 'update-bookings'
};

// Setup menu bar events (settings dropdown, notifications, messages)
function setupMenuBarEvents() {
    const settingsBtn = document.getElementById('settingsBtnTopbar');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const profileSettingLink = document.getElementById('profileSettingLink');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const logoutSettingBtn = document.getElementById('logoutSettingBtn');
    const notificationBtn = document.getElementById('notificationBtnTopbar');
    const messageBtn = document.getElementById('messageBtnTopbar');

    // Settings dropdown toggle
    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.style.display = settingsDropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
                settingsDropdown.style.display = 'none';
            }
        });

        // Dropdown hover effects
        settingsDropdown.querySelectorAll('a, button').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--surface-hover)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });
        });
    }

    // Profile link
    if (profileSettingLink) {
        profileSettingLink.addEventListener('click', (e) => {
            e.preventDefault();
            settingsDropdown.style.display = 'none';
            openProfileModal();
        });
    }

    // Theme toggle
    if (themeToggleBtn) {
        const currentTheme = localStorage.getItem('ridehub_theme') || 'light';
        const updateThemeButton = () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            themeToggleBtn.innerHTML = isDark ? 
                '☀️ <span>Light Mode</span>' : 
                '🌙 <span>Dark Mode</span>';
        };
        
        updateThemeButton();
        
        themeToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('ridehub_theme', newTheme);
            updateThemeButton();
            showToast(`Switched to ${newTheme} mode`, '#10b981');
            settingsDropdown.style.display = 'none';
        });
    }

    // Logout button in settings
    if (logoutSettingBtn) {
        logoutSettingBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const { signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
            const { auth } = await import('./firebase.js');
            await signOut(auth);
            localStorage.removeItem('ridehub_token');
            localStorage.removeItem('ridehub_role');
            window.location.href = 'index.html';
        });
    }

    // Notifications button - show booking notifications
    if (notificationBtn) {
        notificationBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showSecretaryNotifications();
        });
    }

    // Message button - show booking notifications
    if (messageBtn) {
        messageBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showSecretaryNotifications();
        });
    }
}

// Show secretary notifications (recent bookings)
async function showSecretaryNotifications() {
    try {
        const bookingsRes = await api.getBookings();
        const bookings = await bookingsRes.json();
        
        // Get recent pending bookings (last 24 hours)
        const recentBookings = bookings.filter(b => {
            const bookingDate = new Date(b.createdAt || b.startDate);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return bookingDate > oneDayAgo && (b.status === 'PENDING' || b.status === 'APPROVED');
        });

        if (recentBookings.length === 0) {
            showToast('No recent booking notifications', '#6b7280');
            return;
        }

        // Create notification modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Recent Booking Notifications</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${recentBookings.map(b => `
                        <div class="notification-item" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${b.pickupLocation || 'N/A'} → ${b.destination || 'N/A'}</strong>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                        ${new Date(b.startDate).toLocaleString()} • KSH ${b.price || 0}
                                    </div>
                                </div>
                                <span class="badge badge-${b.status.toLowerCase()}">${b.status}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Close modal functionality
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

    } catch (error) {
        console.error('Failed to load notifications:', error);
        showToast('Failed to load notifications', '#ef4444');
    }
}

export async function renderSecretaryUI(sidebar, content) {
    sidebar.innerHTML = `
        ${createNavItem('Dispatcher Dashboard', icons.dashboard, 'dashboard', secretaryState.activeTab === 'dashboard')}
        ${createNavItem('Create Booking', icons.book, 'create-booking', secretaryState.activeTab === 'create-booking')}
        ${createNavItem('Update Bookings', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', 'update-bookings', secretaryState.activeTab === 'update-bookings')}
        ${createNavItem('Logout', icons.logout, false, true)}
    `;

    sidebar.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.currentTarget.dataset.section;
            if (section === 'dashboard' || section === 'create-booking' || section === 'update-bookings') {
                secretaryState.activeTab = section;
                renderSecretaryUI(sidebar, content);
            }
        });
    });

    // Attach logout listener
    const logoutBtn = sidebar.querySelector('#logoutBtn');
    attachLogoutListener(logoutBtn);

    // Initialize profile modal
    initializeProfileModal();

    // Setup menu bar events
    setupMenuBarEvents();

    if (secretaryState.activeTab === 'dashboard') {
        await renderDispatcherDashboard(content);
    } else if (secretaryState.activeTab === 'create-booking') {
        await renderCreateBookingView(content);
    } else if (secretaryState.activeTab === 'update-bookings') {
        await renderUpdateBookingsView(content);
    }
}

async function renderCreateBookingView(content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Booking Creation Form...</div>`;

    try {
        const vres = await api.getVehicles();
        const vehicles = await vres.json();
        const vehicleOptions = vehicles
            .filter(v => v.isAvailable)
            .map(v => `<option value="${v.vehicleType}">${v.vehicleType} - ${v.model}</option>`)
            .join('');

        content.innerHTML = `
            <div class="page-header" style="margin-bottom: 2rem;">
                <div>
                    <h2 style="margin: 0; color: var(--text-primary); font-size: 1.75rem; font-weight: 700;">Create New Booking</h2>
                    <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Arrange a ride for your guests with flexible options and real-time pricing</p>
                </div>
            </div>

            <div class="booking-container" style="max-width: 900px; margin: 0 auto;">
                <div class="booking-form-section">
                    <div class="card-modern" style="border: 1px solid var(--border-light); box-shadow: var(--shadow-lg);">
                        <div style="padding: 2rem; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600;">Booking Details</h3>
                            <p style="margin: 0.5rem 0 0; opacity: 0.9;">Fill in all details for a new ride</p>
                        </div>
                        
                        <form id="secretaryBookingForm" style="padding: 2rem;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                                <div class="form-group-modern">
                                    <label for="bookingType" style="display: flex; align-items: center; gap: 0.5rem;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                        Booking Type
                                    </label>
                                    <select id="bookingType" name="bookingType" required style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); background: white; cursor: pointer; font-size: 0.875rem; transition: border-color 0.2s;">
                                        <option value="Transfer">🚗 Transfer</option>
                                        <option value="Tour">🗺️ Tour</option>
                                        <option value="Pickup">📍 Pickup/Dropoff</option>
                                    </select>
                                </div>
                                <div class="form-group-modern">
                                    <label for="guests" style="display: flex; align-items: center; gap: 0.5rem;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/></svg>
                                        Passengers
                                    </label>
                                    <input type="number" id="guests" name="numberOfGuests" min="1" max="8" required value="1" style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); font-size: 0.875rem; transition: border-color 0.2s;">
                                </div>
                            </div>

                            <div class="form-group-modern">
                                <label for="pickup" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                    Pickup Location
                                </label>
                                <input type="text" id="pickup" name="pickupLocation" placeholder="Enter or select pickup location" required style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); font-size: 0.875rem; transition: border-color 0.2s;">
                            </div>

                            <div class="form-group-modern">
                                <label for="destination" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                                    Destination
                                </label>
                                <input type="text" id="destination" name="destination" placeholder="Enter destination" required style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); font-size: 0.875rem; transition: border-color 0.2s;">
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                                <div class="form-group-modern">
                                    <label for="startDate" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        Date & Time
                                    </label>
                                    <input type="datetime-local" id="startDate" name="startDate" required style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); font-size: 0.875rem; transition: border-color 0.2s;">
                                </div>
                                <div class="form-group-modern">
                                    <label for="vehiclePreference" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                        Vehicle Type
                                    </label>
                                    <select id="vehiclePreference" name="vehiclePreference" style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); background: white; cursor: pointer; font-size: 0.875rem; transition: border-color 0.2s;">
                                        <option value="Any">Any Available</option>
                                        ${vehicleOptions}
                                    </select>
                                </div>
                            </div>

                            <div class="form-group-modern">
                                <label for="specialRequests" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Special Requests
                                </label>
                                <textarea id="specialRequests" name="specialRequests" placeholder="Any special requests? (baby seat, extra luggage, etc.)" style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); resize: vertical; min-height: 80px; font-size: 0.875rem; transition: border-color 0.2s; font-family: inherit;"></textarea>
                            </div>

                            <div class="form-group-modern">
                                <label for="price" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    Estimated Price (KSH)
                                </label>
                                <input type="number" id="price" name="price" min="0" step="50" placeholder="Enter price estimate" required style="width: 100%; padding: 0.875rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg); font-size: 0.875rem; transition: border-color 0.2s;">
                            </div>

                            <button type="submit" class="btn-modern btn-primary-modern" style="width: 100%; padding: 1rem; font-weight: 600; margin-top: 1rem; font-size: 1rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block;"><path d="M12 4v16m8-8H4"/></svg>
                                Create Booking
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        const form = content.querySelector('#secretaryBookingForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);

            try {
                const bookingData = {
                    pickupLocation: formData.get('pickupLocation'),
                    destination: formData.get('destination'),
                    startDate: new Date(formData.get('startDate')).toISOString(),
                    numberOfGuests: parseInt(formData.get('numberOfGuests')),
                    vehiclePreference: formData.get('vehiclePreference'),
                    specialRequests: formData.get('specialRequests'),
                    price: parseFloat(formData.get('price')),
                    bookingType: formData.get('bookingType'),
                    serviceType: 'Transport'
                };

                await api.createBooking(bookingData);
                showToast('Booking created successfully!', '#10b981');
                form.reset();
                setTimeout(() => {
                    secretaryState.activeTab = 'dashboard';
                    renderSecretaryUI(sidebar, content);
                }, 1000);
            } catch (err) {
                console.error(err);
                showToast('Failed to create booking', '#ef4444');
            }
        });
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading form.</div>`;
    }
}

async function renderDispatcherDashboard(content) {
    // listen for updates resulting from actions in detail modal
    if (!renderDispatcherDashboard._listenerAttached) {
        window.addEventListener('bookingUpdated', () => renderDispatcherDashboard(content));
        renderDispatcherDashboard._listenerAttached = true;
    }

    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Dispatcher Board...</div>`;

    try {
        const [bookingsRes, driversRes, vehiclesRes] = await Promise.all([
            api.getBookings(),
            api.getAllUsers(),
            api.getVehicles()
        ]);

        // Check if responses are ok before parsing JSON
        if (!bookingsRes.ok) {
            throw new Error(`Failed to load bookings: ${bookingsRes.status} ${bookingsRes.statusText}`);
        }
        if (!driversRes.ok) {
            throw new Error(`Failed to load users: ${driversRes.status} ${driversRes.statusText}`);
        }
        if (!vehiclesRes.ok) {
            throw new Error(`Failed to load vehicles: ${vehiclesRes.status} ${vehiclesRes.statusText}`);
        }

        const allBookingsResp = await bookingsRes.json();
        const allUsersResp = await driversRes.json();
        const allVehiclesResp = await vehiclesRes.json();

        const allBookings = allBookingsResp.data || allBookingsResp || [];
        const allUsers = allUsersResp.data || allUsersResp || [];
        const allVehicles = allVehiclesResp.data || allVehiclesResp || [];

        const pendingBookings = allBookings.filter(b => b.status === "PENDING");
        const approvedBookings = allBookings.filter(b => b.status === "APPROVED");
        const activeDrivers = allUsers.filter(u => u.role === "Driver" && u.status === "Active");
        const availableVehicles = allVehicles.filter(v => v.isAvailable);

        let tableHtml = '';
        if (pendingBookings.length === 0 && approvedBookings.length === 0) {
            tableHtml = `<tr><td colspan="5" style="text-align:center;">No bookings need attention.</td></tr>`;
        } else {
            tableHtml += pendingBookings.map(b => `
                <tr class="booking-row" data-booking='${JSON.stringify(b)}' style="cursor:pointer;">
                    <td>${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>${b.destination || '-'}</td>
                    <td><span class="badge badge-pending">PENDING</span></td>
                    <td>
                        <button class="btn btn-primary approve-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right:0.25rem; min-width:4rem; display:inline-block; text-align:center;">Approve</button>
                        <button class="btn btn-danger reject-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; min-width:4rem; display:inline-block; text-align:center;">Reject</button>
                    </td>
                </tr>
            `).join('');

            tableHtml += approvedBookings.map(b => {
                const driverOptions = activeDrivers.map(d => `<option value="${d.uid}">${d.fullName}</option>`).join('');
                const vehicleOptions = availableVehicles.map(v => `<option value="${v.id}">${v.registrationNumber} (${v.model})</option>`).join('');
                return `
                <tr class="booking-row" data-booking='${JSON.stringify(b)}' style="cursor:pointer;">
                    <td>${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>${b.destination || '-'}</td>
                    <td><span class="badge badge-approved">APPROVED</span></td>
                    <td style="display:flex;gap:0.5rem;">
                        <select class="form-control" id="dsel-${b.id}" style="font-size:0.75rem;padding:0.25rem;">
                            <option value="">Select Driver</option>
                            ${driverOptions}
                        </select>
                        <select class="form-control" id="vsel-${b.id}" style="font-size:0.75rem;padding:0.25rem;">
                            <option value="">Select Vehicle</option>
                            ${vehicleOptions}
                        </select>
                        <button class="btn btn-primary assign-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Assign</button>
                    </td>
                </tr>
            `}).join('');
        }

        content.innerHTML = `
            <div class="page-header">
                <h2>Dispatcher Dashboard</h2>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">${icons.book}</div>
                    <div class="metric-info">
                        <h3>Pending Approval</h3>
                        <div class="value">${pendingBookings.length}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">${icons.users}</div>
                    <div class="metric-info">
                        <h3>Needs Assignment</h3>
                        <div class="value">${approvedBookings.length}</div>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <h3 style="font-size: 1rem; font-weight: 600;">Action Required Queue</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Destination</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableHtml}
                    </tbody>
                </table>
            </div>
        `;

        content.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const booking = pendingBookings.find(b => b.id === id);
                if (booking) {
                    showBookingDetailModal(booking, allUsers);
                    // once modal is shown, trigger its approve button so assignment section appears
                    setTimeout(() => {
                        const modalEl = document.getElementById('bookingDetailModal');
                        const aprov = modalEl?.querySelector('#approveBookingBtn');
                        if (aprov) aprov.click();
                    }, 200);
                }
            });
        });

        content.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('Reject this booking?')) {
                    await api.rejectBooking(id);
                    renderDispatcherDashboard(content);
                }
            });
        });

        // make rows clickable to review booking details
        content.querySelectorAll('.booking-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // ignore clicks on buttons or selects inside the row
                if (e.target.closest('button') || e.target.closest('select')) return;
                const data = row.getAttribute('data-booking');
                if (data) {
                    try {
                        const b = JSON.parse(data);
                        showBookingDetailModal(b, allUsers);
                    } catch (err) {
                        console.error('Error parsing booking data from row', err);
                    }
                }
            });
        });

        content.querySelectorAll('.assign-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const driverId = document.getElementById(`dsel-${id}`).value;
                const vehicleId = document.getElementById(`vsel-${id}`).value;

                if (!driverId || !vehicleId) {
                    alert('Please select both a driver and a vehicle.');
                    return;
                }

                try {
                    await api.assignBooking({ bookingId: id, driverId, vehicleId });
                    alert('Assignment locked successfully!');
                    renderDispatcherDashboard(content);
                } catch (err) {
                    alert('Failed to assign booking. Vehicle might be taken.');
                }
            });
        });

    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading dispatcher data.</div>`;
    }
}

async function renderUpdateBookingsView(content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Bookings for Update...</div>`;

    try {
        const bookingsRes = await api.getBookings();
        if (!bookingsRes.ok) {
            throw new Error(`Failed to load bookings: ${bookingsRes.status} ${bookingsRes.statusText}`);
        }

        const allBookings = await bookingsRes.json();
        const updateableBookings = allBookings.filter(b => b.status !== "COMPLETED" && b.status !== "CANCELLED");

        let tableHtml = '';
        if (updateableBookings.length === 0) {
            tableHtml = `<tr><td colspan="6" style="text-align:center;">No bookings available for update.</td></tr>`;
        } else {
            tableHtml = updateableBookings.map(b => `
                <tr class="booking-row" data-booking-id="${b.id}" style="cursor: pointer; transition: background-color 0.2s ease;" data-booking='${JSON.stringify(b)}'>
                    <td>${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>${b.pickupLocation || '-'}</td>
                    <td>${b.destination || '-'}</td>
                    <td><span class="badge badge-${b.status.toLowerCase()}">${b.status}</span></td>
                    <td>KSH ${b.price || 0}</td>
                    <td>
                        <button class="btn btn-primary edit-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</button>
                        ${(b.status === 'PENDING' || b.status === 'APPROVED')
                            ? `<button class="btn btn-secondary cancel-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Cancel</button>`
                            : ''}
                    </td>
                </tr>
            `).join('');
        }

        content.innerHTML = `
            <div class="page-header">
                <h2>Update Bookings</h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Modify existing bookings on behalf of tourists</p>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <h3 style="font-size: 1rem; font-weight: 600;">All Active Bookings</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Pickup</th>
                            <th>Destination</th>
                            <th>Status</th>
                            <th>Price</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableHtml}
                    </tbody>
                </table>
            </div>

            <!-- Edit Booking Modal -->
            <div id="editBookingModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>Edit Booking</h3>
                        <button class="modal-close" id="closeEditModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="editBookingForm" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            <input type="hidden" id="editBookingId">

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div class="form-group">
                                    <label for="editBookingType">Booking Type</label>
                                    <select id="editBookingType" name="bookingType" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px; background: white; cursor: pointer;">
                                        <option value="Transfer">Transfer</option>
                                        <option value="Tour">Tour</option>
                                        <option value="Pickup">Pickup</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="editGuests">Number of Guests</label>
                                    <input type="number" id="editGuests" name="numberOfGuests" min="1" required value="1" style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="editPickup">Pickup Location</label>
                                <input type="text" id="editPickup" name="pickupLocation" placeholder="Enter pickup location" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>

                            <div class="form-group">
                                <label for="editDestination">Destination</label>
                                <input type="text" id="editDestination" name="destination" placeholder="Enter destination" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div class="form-group">
                                    <label for="editStartDate">Start Date & Time</label>
                                    <input type="datetime-local" id="editStartDate" name="startDate" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                                </div>
                                <div class="form-group">
                                    <label for="editPrice">Price (KSH)</label>
                                    <input type="number" id="editPrice" name="price" min="0" step="50" placeholder="0.00" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="editSpecialRequests">Special Requests (Optional)</label>
                                <textarea id="editSpecialRequests" name="specialRequests" placeholder="Any special requests?" style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px; resize: vertical; min-height: 80px;"></textarea>
                            </div>

                            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                                <button type="button" class="btn btn-secondary" id="cancelEditBtn">Cancel</button>
                                <button type="submit" class="btn btn-primary">Update Booking</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Edit button handlers
        content.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = e.target.getAttribute('data-id');
                const booking = updateableBookings.find(b => b.id === bookingId);
                if (booking) {
                    populateEditForm(content, booking);
                    const modal = content.querySelector('#editBookingModal');
                    modal.classList.add('active');
                }
            });
        });

        // Cancel booking handlers
        content.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = e.target.getAttribute('data-id');
                if (confirm('Are you sure you want to cancel this booking?')) {
                    try {
                        await api.cancelBooking(bookingId);
                        showToast('Booking cancelled successfully', '#10b981');
                        await renderUpdateBookingsView(content); // Refresh the view
                    } catch (err) {
                        console.error(err);
                        showToast('Failed to cancel booking', '#ef4444');
                    }
                }
            });
        });

        // Modal handlers
        content.querySelector('#closeEditModal').addEventListener('click', () => {
            content.querySelector('#editBookingModal').classList.remove('active');
        });

        content.querySelector('#cancelEditBtn').addEventListener('click', () => {
            content.querySelector('#editBookingModal').classList.remove('active');
        });

        // Close modal when clicking outside
        content.querySelector('#editBookingModal').addEventListener('click', (e) => {
            if (e.target.id === 'editBookingModal') {
                content.querySelector('#editBookingModal').classList.remove('active');
            }
        });

        // Edit form submission
        content.querySelector('#editBookingForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const bookingId = content.querySelector('#editBookingId').value;

            try {
                const updateData = {
                    pickupLocation: formData.get('pickupLocation'),
                    destination: formData.get('destination'),
                    startDate: new Date(formData.get('startDate')).toISOString(),
                    numberOfGuests: parseInt(formData.get('numberOfGuests')),
                    price: parseFloat(formData.get('price')),
                    specialRequests: formData.get('specialRequests'),
                    bookingType: formData.get('bookingType')
                };

                await api.updateBooking(bookingId, updateData);
                showToast('Booking updated successfully!', '#10b981');
                content.querySelector('#editBookingModal').classList.remove('active');
                await renderUpdateBookingsView(content); // Refresh the view

            } catch (err) {
                console.error(err);
                showToast('Failed to update booking', '#ef4444');
            }
        });

        // Add click handlers for booking rows to show detail modal
        content.querySelectorAll('.booking-row').forEach(row => {
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = 'var(--surface-hover)';
            });
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = 'transparent';
            });
            row.addEventListener('click', (e) => {
                // Don't open modal if clicking on a button
                if (e.target.closest('button')) return;
                
                const bookingData = row.getAttribute('data-booking');
                if (bookingData) {
                    try {
                        const booking = JSON.parse(bookingData);
                        // Fetch all users for the modal
                        api.getAllUsers().then(res => {
                            if (res.ok) {
                                res.json().then(userData => {
                                    const users = userData.data || userData || [];
                                    showBookingDetailModal(booking, users);
                                });
                            }
                        }).catch(err => console.error('Error fetching users:', err));
                    } catch (err) {
                        console.error('Error parsing booking data:', err);
                    }
                }
            });
        });

    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading bookings for update.</div>`;
    }
}

function populateEditForm(content, booking) {
    const modal = content.querySelector('#editBookingModal');
    if (!modal) return;
    
    modal.querySelector('#editBookingId').value = booking.id;
    modal.querySelector('#editBookingType').value = booking.bookingType || 'Transfer';
    modal.querySelector('#editGuests').value = booking.numberOfGuests || 1;
    modal.querySelector('#editPickup').value = booking.pickupLocation || '';
    modal.querySelector('#editDestination').value = booking.destination || '';
    if (booking.startDate) {
        const dt = new Date(booking.startDate);
        // adjust to local timezone for datetime-local input
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        modal.querySelector('#editStartDate').value = dt.toISOString().slice(0, 16);
    } else {
        modal.querySelector('#editStartDate').value = '';
    }
    modal.querySelector('#editPrice').value = booking.price || 0;
    modal.querySelector('#editSpecialRequests').value = booking.specialRequests || '';
}
