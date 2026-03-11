// admin.js
import api from "../api.js";
import { icons, createNavItem, showToast } from "./shared.js";
import { attachLogoutListener } from "./logout-helper.js";
import { initializeProfileModal, openProfileModal } from "./profile-modal.js";
import { showBookingDetailModal } from "./booking-detail-modal.js";

let adminState = {
    bookings: [],
    users: [],
    vehicles: [],
    feedback: [],
    auditLogs: [],
    activeTab: 'overview', // 'overview', 'users', 'fleet', 'analytics', 'feedback'
    filters: { status: 'ALL', search: '' }
};

// update the badge on the bell icon to reflect current audit log count
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    const count = (adminState.auditLogs || []).length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.textContent = '';
        badge.style.display = 'none';
    }
}

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
            const { auth } = await import('../firebase.js');
            await signOut(auth);
            localStorage.removeItem('ridehub_token');
            localStorage.removeItem('ridehub_role');
            window.location.href = 'index.html';
        });
    }

    // Notifications button - show audit logs
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuditLogs();
        });
    }

    // Message button - show audit logs (same as notifications for admin)
    if (messageBtn) {
        messageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuditLogs();
        });
    }
}

export async function renderAdminUI(sidebar, content) {
    console.log('Rendering admin UI...');
    sidebar.innerHTML = `
        ${createNavItem('Dashboard Overview', icons.dashboard, 'overview', adminState.activeTab === 'overview')}
        ${createNavItem('Business Analytics', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>', 'analytics', adminState.activeTab === 'analytics')}
        ${createNavItem('User Management', icons.users, 'users', adminState.activeTab === 'users')}
        ${createNavItem('Fleet Controls', icons.car, 'fleet', adminState.activeTab === 'fleet')}
        ${createNavItem('Customer Feedback', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 10.26 23.77 11.46 17.88 17.01 19.54 25.63 12 21.35 4.46 25.63 6.12 17.01 0.23 11.46 8.91 10.26 12 2"/></svg>', 'feedback', adminState.activeTab === 'feedback')}
        ${createNavItem('Logout', icons.logout, 'logout', false, true)}
    `;

    sidebar.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            adminState.activeTab = e.currentTarget.dataset.section;
            renderAdminView(content);
        });
    });

    // Attach logout listener
    const logoutBtn = sidebar.querySelector('#logoutBtn');
    attachLogoutListener(logoutBtn);

    // Initialize profile modal
    initializeProfileModal();

    // Setup menu bar events (settings dropdown, notifications, messages)
    setupMenuBarEvents();

    console.log('Admin state bookings length:', adminState.bookings.length);
    if (adminState.bookings.length === 0) {
        content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Admin Telemetry...</div>`;
        await loadAdminData(content);
    }

    // Initialize notification system
    setTimeout(() => initializeAdminNotifications(), 100);

    renderAdminView(content);
}

export async function loadAdminData(content) {
    try {
        console.log('Loading admin data...');
        const [bRes, uRes, vRes] = await Promise.all([
            api.getBookings(),
            api.getAllUsers(),
            api.getVehicles()
        ]);

        console.log('API responses received:', { bRes: bRes.ok, uRes: uRes.ok, vRes: vRes.ok });

        if (!bRes.ok) throw new Error(`Bookings API failed: ${bRes.status}`);
        if (!uRes.ok) throw new Error(`Users API failed: ${uRes.status}`);
        if (!vRes.ok) throw new Error(`Vehicles API failed: ${vRes.status}`);

        // API responses are wrapped in ApiResponse<T> with data in .data property
        const bData = await bRes.json();
        const uData = await uRes.json();
        const vData = await vRes.json();

        console.log('Parsed data:', { bookings: bData, users: uData, vehicles: vData });

        adminState.bookings = bData.data || bData || [];
        adminState.users = uData.data || uData || [];
        adminState.vehicles = vData.data || vData || [];

        console.log('Admin state updated:', adminState);

        // Fetch feedback separately - it's optional
        try {
            const fRes = await api.getFeedback();
            if (fRes && fRes.ok) {
                const fData = await fRes.json();
                adminState.feedback = fData.data || fData || [];
            } else {
                adminState.feedback = [];
            }
        } catch (err) {
            console.warn('Feedback endpoint not available yet:', err.message);
            adminState.feedback = [];
        }

        if (content) {
            renderAdminView(content);
        }
        // after loading fresh data, regenerate logs and update badge
        generateAuditLogs();
        updateNotificationBadge();
    } catch (e) {
        console.error('Error loading admin data:', e);
        if (content) content.innerHTML = `<div style="padding:2rem;color:red;">Error loading admin data: ${e.message}</div>`;
    }
}

// Generate audit logs from data
function generateAuditLogs() {
    const logs = [];

    // Helper function to create valid date
    const createValidDate = (dateStr) => {
        if (!dateStr) return new Date();
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? new Date() : date;
    };

    // Log recent bookings
    adminState.bookings.slice(0, 20).forEach(b => {
        const destination = b.destination || b.dropOffLocation || 'Unknown Destination';
        // try to surface registration number if available via vehicle lookup
        let vehicleInfo = b.vehicleType || 'Vehicle';
        if (b.vehicleId) {
            const veh = adminState.vehicles.find(v => v.id === b.vehicleId);
            if (veh) {
                vehicleInfo = `${veh.vehicleType || ''} ${veh.registrationNumber || ''}`.trim();
            }
        }
        logs.push({
            id: b.id,
            type: 'booking',
            icon: '🚗',
            title: 'New Booking Created',
            description: `${vehicleInfo} booked to ${destination}`,
            timestamp: createValidDate(b.createdAt),
            severity: 'info'
        });
    });

    // Log booking status changes
    adminState.bookings.slice(0, 10).forEach(b => {
        if (b.status === 'COMPLETED') {
            const destination = b.destination || b.dropOffLocation || 'Unknown Destination';
            // reuse vehicleInfo logic
            let vehicleInfo = b.vehicleType || 'Vehicle';
            if (b.vehicleId) {
                const veh = adminState.vehicles.find(v => v.id === b.vehicleId);
                if (veh) {
                    vehicleInfo = `${veh.vehicleType || ''} ${veh.registrationNumber || ''}`.trim();
                }
            }
            logs.push({
                id: `${b.id}-complete`,
                type: 'completion',
                icon: '✅',
                title: 'Trip Completed',
                description: `${vehicleInfo} trip to ${destination} completed`,
                timestamp: createValidDate(b.completedAt || b.updatedAt || b.createdAt),
                severity: 'success'
            });
        } else if (b.status === 'CANCELLED') {
            let vehicleInfo = b.vehicleType || 'Vehicle';
            if (b.vehicleId) {
                const veh = adminState.vehicles.find(v => v.id === b.vehicleId);
                if (veh) {
                    vehicleInfo = `${veh.vehicleType || ''} ${veh.registrationNumber || ''}`.trim();
                }
            }
            logs.push({
                id: `${b.id}-cancel`,
                type: 'cancellation',
                icon: '❌',
                title: 'Booking Cancelled',
                description: `${vehicleInfo} booking cancelled`,
                timestamp: createValidDate(b.updatedAt || b.createdAt),
                severity: 'warning'
            });
        }
    });

    // Log recent user registrations
    adminState.users
        .sort((a, b) => createValidDate(b.createdAt) - createValidDate(a.createdAt))
        .slice(0, 15)
        .forEach(u => {
            logs.push({
                id: `user-${u.uid}`,
                type: 'registration',
                icon: '👤',
                title: 'New User Registered',
                description: `${u.firstName || u.fullName || 'User'} ${u.lastName || ''} registered as ${u.role || 'Tourist'}`,
                timestamp: createValidDate(u.createdAt),
                severity: 'info'
            });
        });

    // Log high-priority events
    adminState.users
        .filter(u => u.status === 'Suspended')
        .forEach(u => {
            logs.push({
                id: `suspend-${u.uid}`,
                type: 'suspension',
                icon: '⛔',
                title: 'User Suspended',
                description: `${u.firstName || u.fullName || 'User'} ${u.lastName || ''} (${u.role || 'Tourist'}) has been suspended`,
                timestamp: createValidDate(u.updatedAt || u.createdAt),
                severity: 'critical'
            });
        });

    // Log feedback received
    adminState.feedback.slice(0, 10).forEach(f => {
        const ratingEmoji = f.rating >= 4 ? '⭐' : f.rating >= 3 ? '⚠️' : '❌';
        const booking = adminState.bookings.find(b => b.id === f.bookingId);
        const destination = booking ? (booking.destination || booking.dropOffLocation || 'Unknown Destination') : 'Trip';
        logs.push({
            id: `feedback-${f.id}`,
            type: 'feedback',
            icon: ratingEmoji,
            title: `Customer Review (${f.rating}⭐)`,
            description: `${f.comment || 'Review submitted'} - ${destination}`,
            timestamp: createValidDate(f.createdAt),
            severity: f.rating >= 4 ? 'success' : f.rating >= 3 ? 'warning' : 'critical'
        });
    });

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);
    adminState.auditLogs = logs;
    // refresh the badge count whenever logs are recalculated
    updateNotificationBadge();
    return logs;
}

// Show audit logs modal
function showAuditLogs() {
    const logs = generateAuditLogs();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'auditLogsModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';
    modal.style.opacity = '0';
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 300);
        }
    });

    const logItems = logs.slice(0, 50).map(log => `
        <div style="display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--border-color); hover:background: var(--surface-color); transition: background 0.2s; cursor: pointer;" 
             data-log-type="${log.type}" data-log-id="${log.id}" class="audit-log-item">
            <div style="font-size: 1.5rem; min-width: 2rem; text-align: center;">${log.icon}</div>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                    <div>
                        <h4 style="margin: 0 0 0.25rem; color: var(--text-primary); font-weight: 600;">${log.title}</h4>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">${log.description}</p>
                    </div>
                    <span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${log.timestamp.toLocaleString()}</span>
                </div>
            </div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="border-bottom: 2px solid var(--border-color);">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                    📋 Audit Log Monitor
                </h3>
                <button id="closeAuditModal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>
            <div style="flex: 1; overflow-y: auto; background: white;">
                ${logs.length > 0 ? logItems : '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No audit logs yet</div>'}
            </div>
            <div style="border-top: 1px solid var(--border-color); padding: 1rem; background: var(--surface-color); text-align: right;">
                <small style="color: var(--text-secondary);">Showing ${Math.min(logs.length, 50)} of ${logs.length} events</small>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.style.opacity = '1', 10);

    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    };

    const closeBtn = modal.querySelector('#closeAuditModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });
    }
    
    // Also allow clicking on the overlay background to close
    const overlay = modal;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    // Add click handlers for audit log items
    modal.querySelectorAll('.audit-log-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const logType = item.getAttribute('data-log-type');
            const logId = item.getAttribute('data-log-id');
            
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 300);
            
            // Navigate to relevant section based on log type
            const content = document.querySelector('.main-content');
            switch (logType) {
                case 'booking':
                case 'completion':
                case 'cancellation':
                    adminState.activeTab = 'overview';
                    renderAdminView(content);
                    // Scroll to the specific booking if possible
                    setTimeout(() => {
                        const bookingRow = document.querySelector(`[data-id="${logId.split('-')[0]}"]`);
                        if (bookingRow) {
                            bookingRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            bookingRow.style.backgroundColor = '#fff3cd';
                            setTimeout(() => bookingRow.style.backgroundColor = '', 2000);
                        }
                    }, 500);
                    break;
                case 'registration':
                case 'suspension':
                    adminState.activeTab = 'users';
                    renderAdminView(content);
                    // Scroll to the specific user if possible
                    setTimeout(() => {
                        const userId = logId.replace('user-', '').replace('suspend-', '');
                        const userRow = document.querySelector(`[data-id="${userId}"]`);
                        if (userRow) {
                            userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            userRow.style.backgroundColor = '#fff3cd';
                            setTimeout(() => userRow.style.backgroundColor = '', 2000);
                        }
                    }, 500);
                    break;
                case 'feedback':
                    adminState.activeTab = 'feedback';
                    renderAdminView(content);
                    break;
                default:
                    // Stay on current tab
                    break;
            }
        });
    });

    // Update notification badge
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        const unreadCount = Math.min(logs.length, 99);
        badge.textContent = unreadCount;
    }
}

// Hook into bell button
export function initializeAdminNotifications() {
    const bellBtn = document.querySelector('.topbar-actions .action-btn');
    if (bellBtn) {
        bellBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuditLogs();
        });
    }
    // ensure badge starts in sync when notifications component is initialized
    updateNotificationBadge();
}

function renderAdminView(content) {
    if (adminState.activeTab === 'overview') return renderOverviewTab(content);
    if (adminState.activeTab === 'analytics') return renderAnalyticsTab(content);
    if (adminState.activeTab === 'users') return renderUsersTab(content);
    if (adminState.activeTab === 'fleet') return renderFleetTab(content);
    if (adminState.activeTab === 'feedback') return renderFeedbackTab(content);
}

function renderOverviewTab(content) {
    const revenue = adminState.bookings
        .filter(b => b.status === "COMPLETED" && b.paymentStatus === "PAID")
        .reduce((sum, b) => sum + (b.price || 0), 0);

    const commissionOwed = adminState.users
        .reduce((sum, u) => sum + (u.commissionBalance || 0), 0);

    const pendingBookings = adminState.bookings.filter(b => b.status === "PENDING").length;

    const totalDrivers = adminState.users.filter(u => u.role === "Driver").length;
    const totalSecretaries = adminState.users.filter(u => u.role === "Secretary").length;
    const totalUsers = adminState.users.length;
    const fleetSize = adminState.vehicles.length;

    // Filter Logic for Bookings
    let displayBookings = [...adminState.bookings];
    if (adminState.filters.status !== 'ALL') {
        displayBookings = displayBookings.filter(b => b.status === adminState.filters.status);
    }

    // Sort by Date Descending
    displayBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let bookingHtml = displayBookings.length === 0 ? `<tr><td colspan="6" style="text-align:center;">No bookings found.</td></tr>` :
        displayBookings.map(b => {
            let actions = '';
            if (b.status === 'PENDING') {
                actions = `
                    <button class="btn btn-primary approve-btn" data-id="${b.id}" style="margin-right:0.25rem; font-size:0.75rem; min-width:4rem; display:inline-block; text-align:center;">Approve</button>
                    <button class="btn btn-danger reject-btn" data-id="${b.id}" style="margin-right:0.25rem; font-size:0.75rem; min-width:4rem; display:inline-block; text-align:center;">Reject</button>
                    <button class="btn btn-secondary cancel-btn" data-id="${b.id}" style="font-size:0.75rem;">Cancel</button>
                `;
            } else if (b.status === 'APPROVED') {
                actions = `<button class="btn btn-warning update-status-btn" data-id="${b.id}" style="font-size:0.75rem;">Update Status</button>`;
            } else if (b.status === 'ASSIGNED' || b.status === 'IN_PROGRESS') {
                actions = `<button class="btn btn-warning update-status-btn" data-id="${b.id}" style="font-size:0.75rem;">Update Status</button>`;
            } else if (b.status === 'COMPLETED' || b.status === 'CANCELLED') {
                actions = `<span style="font-size:0.75rem; color:var(--text-secondary);">No actions available</span>`;
            }

            return `
            <tr class="booking-row" data-booking-id="${b.id}" style="cursor: pointer; transition: background-color 0.2s ease;" data-booking='${JSON.stringify(b)}'>
                <td>${new Date(b.createdAt).toLocaleDateString()}</td>
                <td>${b.destination || '-'}</td>
                <td>${b.userId}</td>
                <td><span class="badge badge-${b.status.toLowerCase()}">${b.status}</span></td>
                <td>KSH ${(b.price || 0).toLocaleString()}</td>
                <td>${actions}</td>
            </tr>
        `;
        }).join('');

    content.innerHTML = `
        <div class="page-header">
            <h2>Admin Executive Overview</h2>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-icon">${icons.money}</div>
                <div class="metric-info">
                    <h3>Realized Revenue</h3>
                    <div class="value">KSH ${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">${icons.money}</div>
                <div class="metric-info">
                    <h3>Commission Owed</h3>
                    <div class="value">KSH ${commissionOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">${icons.book}</div>
                <div class="metric-info">
                    <h3>Pending Bookings</h3>
                    <div class="value">${pendingBookings}</div>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">${icons.car}</div>
                <div class="metric-info">
                    <h3>Total Fleet Size</h3>
                    <div class="value">${fleetSize}</div>
                </div>
            </div>
             <div class="metric-card">
                <div class="metric-icon">${icons.users}</div>
                <div class="metric-info">
                    <h3>Total Users</h3>
                    <div class="value" style="font-size: 1.25rem;">
                        ${totalUsers} (${totalDrivers} Drv / ${totalSecretaries} Sec)
                    </div>
                </div>
            </div>
        </div>

        <div class="table-container">
            <div class="table-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size: 1rem; font-weight: 600;">Global Booking Registry</h3>
                <select id="overviewStatusFilter" class="form-control" style="width: auto;">
                    <option value="ALL" ${adminState.filters.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
                    <option value="PENDING" ${adminState.filters.status === 'PENDING' ? 'selected' : ''}>Pending</option>
                    <option value="APPROVED" ${adminState.filters.status === 'APPROVED' ? 'selected' : ''}>Approved</option>
                    <option value="ASSIGNED" ${adminState.filters.status === 'ASSIGNED' ? 'selected' : ''}>Assigned</option>
                    <option value="IN_PROGRESS" ${adminState.filters.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                    <option value="COMPLETED" ${adminState.filters.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                </select>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Created At</th>
                            <th>Destination</th>
                            <th>User ID</th>
                            <th>Status</th>
                            <th>Price</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookingHtml}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Commission & Driver Performance Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 3rem;">
            <!-- Commission Summary -->
            <div class="table-container">
                <div class="table-header">
                    <h3 style="font-size: 1rem; font-weight: 600;">Driver Commission Summary</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Driver</th>
                            <th>Commission</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${adminState.users
                            .filter(u => u.role === 'Driver' && (u.commissionBalance || 0) > 0)
                            .sort((a, b) => (b.commissionBalance || 0) - (a.commissionBalance || 0))
                            .slice(0, 10)
                            .map(d => `
                                <tr>
                                    <td>${d.fullName}</td>
                                    <td style="font-weight: 600; color: #10b981;">KSH ${(d.commissionBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('')}
                        ${adminState.users.filter(u => u.role === 'Driver' && (u.commissionBalance || 0) > 0).length === 0 ? '<tr><td colspan="2" style="text-align:center; color: var(--text-secondary);">No commissions yet</td></tr>' : ''}
                    </tbody>
                </table>
            </div>

            <!-- Driver Performance -->
            <div class="table-container">
                <div class="table-header">
                    <h3 style="font-size: 1rem; font-weight: 600;">Driver Performance</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Driver</th>
                            <th>Trips</th>
                            <th>Rating</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${adminState.users
                            .filter(u => u.role === 'Driver')
                            .map(d => {
                                const driverTrips = adminState.bookings.filter(b => b.assignedDriverId === d.uid);
                                const completedTrips = driverTrips.filter(b => b.status === 'COMPLETED').length;
                                const driverFeedback = adminState.feedback.filter(f => f.driverId === d.uid);
                                const avgRating = driverFeedback.length > 0
                                    ? (driverFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / driverFeedback.length).toFixed(1)
                                    : 'N/A';
                                
                                return `
                                    <tr>
                                        <td>${d.fullName}</td>
                                        <td>${completedTrips}</td>
                                        <td>${typeof avgRating === 'number' ? avgRating + ' ⭐' : avgRating}</td>
                                    </tr>
                                `;
                            }).join('')}
                        ${adminState.users.filter(u => u.role === 'Driver').length === 0 ? '<tr><td colspan="3" style="text-align:center; color: var(--text-secondary);">No drivers</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('overviewStatusFilter').addEventListener('change', (e) => {
        adminState.filters.status = e.target.value;
        renderOverviewTab(content);
    });

    // action buttons
    content.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            try {
                await api.approveBooking(id);
                showToast('Booking approved');
                await loadAdminData(content);
                // Show driver assignment modal after approval
                setTimeout(() => showDriverAssignmentModal(id), 500);
            } catch (err) {
                console.error(err);
                showToast('Approve failed', '#ef4444');
            }
        });
    });
    content.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            try {
                await api.rejectBooking(id);
                showToast('Booking rejected');
                await loadAdminData(content);
            } catch (err) {
                console.error(err);
                showToast('Reject failed', '#ef4444');
            }
        });
    });
    content.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            try {
                await api.cancelBooking(id);
                showToast('Booking cancelled');
                await loadAdminData(content);
            } catch (err) {
                console.error(err);
                showToast('Cancel failed', '#ef4444');
            }
        });
    });
    content.querySelectorAll('.update-status-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            showUpdateStatusModal(id);
        });
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
                    showBookingDetailModal(booking, adminState.users);
                } catch (err) {
                    console.error('Error parsing booking data:', err);
                }
            }
        });
    });
}


function renderUsersTab(content) {
    let usersHtml = adminState.users.map(u => `
        <tr>
            <td>${u.fullName}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>
                ${u.status === 'Active'
            ? '<span class="badge badge-approved" style="background:#10b981;color:white;">ACTIVE</span>'
            : '<span class="badge badge-pending">SUSPENDED</span>'}
            </td>
            <td>${u.role === 'Tourist' ? '-' : `KSH ${(u.commissionBalance || 0).toLocaleString()}`}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    ${u.status === 'Active' ? `
                        <button class="btn btn-secondary promote-btn" data-id="${u.uid}" data-role="Driver" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #8b5cf6; color: white;">Make Driver</button>
                        <button class="btn btn-secondary promote-btn" data-id="${u.uid}" data-role="Secretary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #06b6d4; color: white;">Make Secretary</button>
                        <button class="btn btn-primary suspend-btn" data-id="${u.uid}" style="background-color: #ef4444; padding: 0.25rem 0.5rem; font-size: 0.75rem;">Suspend</button>
                    ` : `
                        <button class="btn btn-success reinstate-btn" data-id="${u.uid}" style="background-color: #22c55e; padding: 0.25rem 0.5rem; font-size: 0.75rem;">Reinstate</button>
                    `}
                </div>
            </td>
        </tr>
    `).join('');

    content.innerHTML = `
        <div class="page-header">
            <h2>User Management</h2>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Commission</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${usersHtml}
                </tbody>
            </table>
        </div>
    `;

    content.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const btnEl = e.currentTarget;
            btnEl.disabled = true;
            btnEl.textContent = 'Wait...';
            const uid = btnEl.getAttribute('data-id');
            const role = btnEl.getAttribute('data-role');
            await promoteUser(uid, role, content);
            btnEl.disabled = false;
        });
    });

    content.querySelectorAll('.suspend-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const btnEl = e.currentTarget;
            btnEl.disabled = true;
            btnEl.textContent = 'Wait...';
            const uid = btnEl.getAttribute('data-id');
            await suspendUser(uid, content);
            btnEl.disabled = false;
        });
    });

    content.querySelectorAll('.reinstate-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const btnEl = e.currentTarget;
            btnEl.disabled = true;
            btnEl.textContent = 'Wait...';
            const uid = btnEl.getAttribute('data-id');
            await reinstateUser(uid, content);
            btnEl.disabled = false;
        });
    });
}


async function promoteUser(uid, role, content) {
    try {
        const response = await api.promoteUser(uid, role);
        
        // Handle response - API might return empty 204 or JSON response
        let result = {};
        const contentType = response.headers.get('content-type');
        
        if (response.ok) {
            // Only try to parse JSON if response has content
            if (contentType && contentType.includes('application/json')) {
                try {
                    result = await response.json();
                } catch (e) {
                    // Empty body or invalid JSON - that's okay for 204/200 success
                    result = { message: `User promoted to ${role}` };
                }
            } else {
                result = { message: `User promoted to ${role}` };
            }
            
            showToast(result.message || `User promoted to ${role}`, '#10b981');
            await loadAdminData(content);
        } else {
            // Error response
            try {
                result = await response.json();
            } catch (e) {
                result = { message: 'Promotion failed' };
            }
            
            console.error("Promotion failed:", result);
            showToast(result.message || "Promotion failed", "#ef4444");
        }
    } catch (e) {
        console.error("Network error during promotion:", e);
        showToast("Network error: " + e.message, "#ef4444");
    }
}

async function suspendUser(uid, content) {
    if (!confirm("Are you sure you want to suspend this user?")) return;

    try {
        const response = await api.suspendUser(uid);
        
        // Handle response - API might return empty 204 or JSON response
        let result = {};
        const contentType = response.headers.get('content-type');
        
        if (response.ok) {
            // Only try to parse JSON if response has content
            if (contentType && contentType.includes('application/json')) {
                try {
                    result = await response.json();
                } catch (e) {
                    // Empty body or invalid JSON - that's okay for 204/200 success
                    result = { message: 'User suspended successfully' };
                }
            } else {
                result = { message: 'User suspended successfully' };
            }
            
            showToast(result.message || 'User suspended successfully', '#10b981');
            await loadAdminData(content);
        } else {
            // Error response
            try {
                result = await response.json();
            } catch (e) {
                result = { message: 'Suspension failed' };
            }
            
            console.error("Suspension failed", result);
            showToast(result.message || "Suspension failed", "#ef4444");
        }
    } catch (e) {
        console.error("Network error during suspension", e);
        showToast("Network error: " + e.message, "#ef4444");
    }
}

async function reinstateUser(uid, content) {
    try {
        const response = await api.reinstateUser(uid);
        
        // Handle response - API might return empty 204 or JSON response
        let result = {};
        const contentType = response.headers.get('content-type');
        
        if (response.ok) {
            // Only try to parse JSON if response has content
            if (contentType && contentType.includes('application/json')) {
                try {
                    result = await response.json();
                } catch (e) {
                    // Empty body or invalid JSON - that's okay for 204/200 success
                    result = { message: 'User reinstated successfully' };
                }
            } else {
                result = { message: 'User reinstated successfully' };
            }
            
            showToast(result.message || 'User reinstated successfully', '#10b981');
            await loadAdminData(content);
        } else {
            // Error response
            try {
                result = await response.json();
            } catch (e) {
                result = { message: 'Reinstatement failed' };
            }
            
            console.error("Reinstatement failed", result);
            showToast(result.message || "Reinstatement failed", "#ef4444");
        }
    } catch (e) {
        console.error("Network error during reinstatement", e);
        showToast("Network error: " + e.message, "#ef4444");
    }
}

function renderFleetTab(content) {
    // form to add new vehicle
    const addFormHtml = `
        <div class="form-card" style="margin-bottom:2rem; max-width:600px;">
            <h3 style="margin-bottom:1rem;">Add New Vehicle</h3>
            <form id="vehicleForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div>
                    <label>Registration #</label>
                    <input type="text" id="regNumber" class="form-control" required />
                </div>
                <div>
                    <label>Type</label>
                    <select id="vehType" class="form-control">
                        <option value="sedan">Sedan</option>
                        <option value="suv">SUV</option>
                        <option value="van">Van</option>
                        <option value="bike">Bike</option>
                    </select>
                </div>
                <div>
                    <label>Make</label>
                    <input type="text" id="make" class="form-control" />
                </div>
                <div>
                    <label>Model</label>
                    <input type="text" id="model" class="form-control" />
                </div>
                <div>
                    <label>Year</label>
                    <input type="number" id="year" class="form-control" />
                </div>
                <div>
                    <label>Price/Day</label>
                    <input type="number" id="priceDay" class="form-control" step="0.01" />
                </div>
                <div style="grid-column: span 2; text-align:right;">
                    <button type="submit" class="btn btn-primary" style="width:150px;">Add Vehicle</button>
                </div>
            </form>
        </div>
    `;

    let fleetHtml = adminState.vehicles.map(v => `
        <tr>
            <td>${v.registrationNumber}</td>
            <td>${v.model} (${v.year})</td>
            <td>${v.vehicleType || ''}</td>
            <td>
                ${v.isAvailable ? '<span class="badge badge-approved" style="background:#10b981;color:white;">AVAILABLE</span>' : '<span class="badge badge-pending">DISPATCHED</span>'}
            </td>
            <td>
                <button class="btn btn-secondary edit-veh" data-id="${v.id}" style="padding:0.25rem; font-size:0.75rem; margin-right:0.25rem;">Edit</button>
                ${v.status !== 'active' ?
            `<button class="btn btn-primary activate-btn" data-id="${v.id}" style="padding: 0.25rem; font-size: 0.75rem;">Activate</button>` :
            `<button class="btn btn-secondary deactivate-btn" data-id="${v.id}" style="padding: 0.25rem; font-size: 0.75rem;">Deactivate</button>`
        }
                <button class="btn btn-danger delete-veh" data-id="${v.id}" style="padding:0.25rem; font-size:0.75rem; margin-left:0.25rem;">Delete</button>
            </td>
        </tr>
    `).join('');

    content.innerHTML = `
        <div class="page-header">
            <h2>Live Fleet Controls</h2>
        </div>
        ${addFormHtml}
        
        <!-- Driver-Vehicle Assignment Section -->
        <div class="form-card" style="margin-bottom:2rem; max-width:600px;">
            <h3 style="margin-bottom:1rem;">Assign Driver to Vehicle</h3>
            <form id="fleetAssignmentForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div>
                    <label>Select Driver</label>
                    <select id="assignDriver" class="form-control" required>
                        <option value="">Choose driver...</option>
                        ${adminState.users.filter(u => u.role === 'Driver' && u.status === 'Active').map(d => 
                            `<option value="${d.uid}">${d.fullName} (${d.email})</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label>Select Vehicle</label>
                    <select id="assignVehicle" class="form-control" required>
                        <option value="">Choose vehicle...</option>
                        ${adminState.vehicles.filter(v => v.status === 'active').map(v => 
                            `<option value="${v.id}">${v.registrationNumber} - ${v.make} ${v.model}</option>`
                        ).join('')}
                    </select>
                </div>
                <div style="grid-column: span 2; text-align:right;">
                    <button type="submit" class="btn btn-primary" style="width:150px;">Assign</button>
                </div>
            </form>
        </div>

        <!-- Current Assignments -->
        <div class="table-container" style="margin-bottom:2rem;">
            <div class="table-header">
                <h3 style="font-size: 1rem; font-weight: 600;">Current Driver-Vehicle Assignments</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Driver</th>
                        <th>Vehicle</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${adminState.vehicles.filter(v => v.assignedDriverId).map(v => {
                        const driver = adminState.users.find(u => u.uid === v.assignedDriverId);
                        return `
                            <tr>
                                <td>${driver ? driver.fullName : 'Unknown Driver'}</td>
                                <td>${v.registrationNumber} - ${v.make} ${v.model}</td>
                                <td>
                                    ${v.isAvailable ? 
                                        '<span class="badge badge-approved" style="background:#10b981;color:white;">AVAILABLE</span>' : 
                                        '<span class="badge badge-pending">IN USE</span>'}
                                </td>
                                <td>
                                    <button class="btn btn-danger unassign-btn" data-vehicle-id="${v.id}" style="padding: 0.25rem; font-size: 0.75rem;">Unassign</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="table-container">
            <div class="table-header">
                <h3 style="font-size: 1rem; font-weight: 600;">Fleet Inventory</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Plate</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Controls</th>
                    </tr>
                </thead>
                <tbody>
                    ${fleetHtml}
                </tbody>
            </table>
        </div>
    `;

    // bind add form
    const vehicleForm = document.getElementById('vehicleForm');
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                registrationNumber: document.getElementById('regNumber').value,
                vehicleType: document.getElementById('vehType').value,
                make: document.getElementById('make').value,
                model: document.getElementById('model').value,
                year: parseInt(document.getElementById('year').value) || 0,
                pricePerDay: parseFloat(document.getElementById('priceDay').value) || 0,
            };
            try {
                await api.addVehicle(data);
                showToast('Vehicle added');
                await loadAdminData(content);
            } catch (err) {
                console.error(err);
                showToast('Add vehicle failed', '#ef4444');
            }
        });
    }

    content.querySelectorAll('.activate-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await api.activateVehicle(id);
            adminState.bookings = [];
            renderAdminUI(document.getElementById('sidebarMenu'), content);
        });
    });

    content.querySelectorAll('.deactivate-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await api.deactivateVehicle(id);
            adminState.bookings = [];
            renderAdminUI(document.getElementById('sidebarMenu'), content);
        });
    });

    content.querySelectorAll('.delete-veh').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (!confirm('Remove this vehicle from fleet?')) return;
            try {
                await api.deleteVehicle(id);
                showToast('Vehicle deleted');
                await loadAdminData(content);
            } catch (err) {
                console.error(err);
                showToast('Delete failed', '#ef4444');
            }
        });
    });

    // Edit vehicle entries
    content.querySelectorAll('.edit-veh').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            showEditVehicleModal(id);
        });
    });

    // Driver-Vehicle Assignment
    const fleetAssignmentForm = document.getElementById('fleetAssignmentForm');
    if (fleetAssignmentForm) {
        fleetAssignmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const driverId = document.getElementById('assignDriver').value;
            const vehicleId = document.getElementById('assignVehicle').value;

            if (!driverId || !vehicleId) {
                showToast('Please select both driver and vehicle', '#ef4444');
                return;
            }

            try {
                await api.assignDriverToVehicle(driverId, vehicleId);
                showToast('Driver assigned to vehicle successfully');
                await loadAdminData(content);
            } catch (err) {
                console.error(err);
                showToast('Assignment failed', '#ef4444');
            }
        });
    }

    // Unassign buttons
    content.querySelectorAll('.unassign-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const vehicleId = e.target.getAttribute('data-vehicle-id');
            if (!confirm('Unassign driver from this vehicle?')) return;

            try {
                await api.unassignDriverFromVehicle(vehicleId);
                showToast('Driver unassigned successfully');
                await loadAdminData(content);
            } catch (err) {
                console.error(err);
                showToast('Unassignment failed', '#ef4444');
            }
        });
    });
}

async function renderAnalyticsTab(content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Analyzing System Data...</div>`;
    try {
        const [sumRes, trRes] = await Promise.all([
            api.getSummary(),
            api.getTrends()
        ]);

        if (!sumRes.ok) throw new Error(`Summary API Failed: ${sumRes.status} ${await sumRes.text()}`);
        if (!trRes.ok) throw new Error(`Trends API Failed: ${trRes.status} ${await trRes.text()}`);

        const sumRaw = await sumRes.json();
        const trRaw = await trRes.json();

        const summaryData = sumRaw.data || sumRaw;
        const trendsData = trRaw.data || trRaw;

        const totalRevenue = summaryData.totalRevenue ?? summaryData.TotalRevenue ?? 0;
        const totalBookings = summaryData.totalBookings ?? summaryData.TotalBookings ?? 0;
        const completedTrips = summaryData.completedTrips ?? summaryData.CompletedTrips ?? 0;

        // Calculate analytics metrics
        const cancelledBookings = adminState.bookings.filter(b => b.status === "CANCELLED").length;
        const cancellationRate = totalBookings > 0 ? ((cancelledBookings / totalBookings) * 100).toFixed(1) : 0;
        
        // Revenue by vehicle type
        const vehicleRevenue = {};
        adminState.bookings
            .filter(b => b.status === "COMPLETED" && b.paymentStatus === "PAID")
            .forEach(b => {
                const type = b.vehicleType || 'Unknown';
                vehicleRevenue[type] = (vehicleRevenue[type] || 0) + (b.price || 0);
            });

        // Employee performance metrics
        const driverPerformance = {};
        adminState.users.filter(u => u.role === 'Driver').forEach(driver => {
            const driverBookings = adminState.bookings.filter(b => b.driverId === driver.uid);
            const driverFeedback = adminState.feedback.filter(f => f.driverId === driver.uid);
            const avgRating = driverFeedback.length > 0 
                ? (driverFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / driverFeedback.length).toFixed(1)
                : 'N/A';
            const completedTrips = driverBookings.filter(b => b.status === 'COMPLETED').length;
            
            driverPerformance[driver.uid] = {
                name: driver.firstName + ' ' + driver.lastName,
                bookings: driverBookings.length,
                completed: completedTrips,
                avgRating: avgRating,
                revenue: driverBookings.filter(b => b.paymentStatus === 'PAID').reduce((sum, b) => sum + (b.price || 0), 0),
                feedbackCount: driverFeedback.length
            };
        });

        // Sort drivers by rating
        const sortedDrivers = Object.entries(driverPerformance)
            .map(([id, perf]) => ({ id, ...perf }))
            .sort((a, b) => {
                const ratingA = typeof a.avgRating === 'number' ? a.avgRating : 0;
                const ratingB = typeof b.avgRating === 'number' ? b.avgRating : 0;
                return ratingB - ratingA;
            });

        // Workload analysis - bookings per employee
        const employeeWorkload = {};
        adminState.bookings.forEach(b => {
            if (b.driverId) {
                employeeWorkload[b.driverId] = (employeeWorkload[b.driverId] || 0) + 1;
            }
        });

        // Peak hours analysis
        const hoursData = {};
        adminState.bookings.forEach(b => {
            if (b.scheduledDate) {
                const hour = new Date(b.scheduledDate).getHours();
                hoursData[hour] = (hoursData[hour] || 0) + 1;
            }
        });

        // Average order value
        const completedRevenue = adminState.bookings
            .filter(b => b.status === "COMPLETED" && b.paymentStatus === "PAID")
            .map(b => b.price || 0);
        const avgOrderValue = completedRevenue.length > 0 
            ? (completedRevenue.reduce((a, b) => a + b, 0) / completedRevenue.length).toFixed(0)
            : 0;

        const tData = Array.isArray(trendsData) ? trendsData : [];
        const tLabels = tData.map(d => d.destination || d.Destination || 'Unknown');
        const tCounts = tData.map(d => d.count || d.Count || 0);

        content.innerHTML = `
            <div class="page-header">
                <h2>📊 Data-Driven Intelligence Dashboard</h2>
            </div>
            
            <!-- Key Metrics Banner -->
            <div style="background: linear-gradient(135deg, var(--primary-color), #4338ca); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 2rem;">
                <div>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.2rem;">Platform Summary</h3>
                    <p style="opacity: 0.9;">Real-time Business Metrics</p>
                </div>
                <div style="text-align: right; display: flex; gap: 2rem; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase;">Total Revenue</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">KSH ${totalRevenue.toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase;">Avg Order Value</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">KSH ${avgOrderValue}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase;">Total Bookings</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${totalBookings}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase;">Cancellation Rate</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: ${cancellationRate > 10 ? '#ff6b6b' : '#51cf66'};">${cancellationRate}%</div>
                    </div>
                </div>
            </div>

            <!-- Revenue & Booking Charts -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div class="metric-card" style="display: block;">
                    <h3 style="margin-bottom: 1rem;">💰 Revenue by Vehicle Type</h3>
                    <canvas id="vehicleRevenueChart"></canvas>
                </div>
                <div class="metric-card" style="display: block;">
                    <h3 style="margin-bottom: 1rem;">🎯 Demand by Destination</h3>
                    <div style="max-height: 300px; display: flex; justify-content: center;">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Peak Hours & Workload -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div class="metric-card" style="display: block;">
                    <h3 style="margin-bottom: 1rem;">⏰ Peak Hours Analysis</h3>
                    <canvas id="peakHoursChart"></canvas>
                </div>
                <div class="metric-card" style="display: block;">
                    <h3 style="margin-bottom: 1rem;">👥 Workload Distribution</h3>
                    <canvas id="workloadChart"></canvas>
                </div>
            </div>

            <!-- Employee Performance Section -->
            <div class="metric-card" style="display: block; margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1.5rem;">⭐ Driver Performance Rankings</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--primary-light);">
                                <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border-color);">Driver Name</th>
                                <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--border-color);">Rating ⭐</th>
                                <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--border-color);">Completed Trips</th>
                                <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--border-color);">Reviews</th>
                                <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--border-color);">Revenue Generated</th>
                                <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--border-color);">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedDrivers.map((driver, idx) => {
                                const ratingNum = typeof driver.avgRating === 'number' ? driver.avgRating : parseFloat(driver.avgRating) || 0;
                                const isTopPerformer = idx < 3 && ratingNum >= 4;
                                const isPoorPerformer = ratingNum < 3 && driver.feedbackCount >= 3;
                                const statusColor = isTopPerformer ? '#10b981' : isPoorPerformer ? '#ef4444' : '#f59e0b';
                                const statusLabel = isTopPerformer ? '🏆 Top Performer' : isPoorPerformer ? '⚠️ Needs Review' : '✓ Active';
                                
                                return `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 0.75rem; font-weight: 500;">${driver.name}</td>
                                        <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: ${ratingNum >= 4 ? '#10b981' : ratingNum >= 3 ? '#f59e0b' : '#ef4444'};">
                                            ${driver.avgRating !== 'N/A' ? driver.avgRating : 'No ratings'}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">${driver.completed}/${driver.bookings}</td>
                                        <td style="padding: 0.75rem; text-align: center;">${driver.feedbackCount}</td>
                                        <td style="padding: 0.75rem; text-align: center;">KSH ${driver.revenue.toLocaleString()}</td>
                                        <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: ${statusColor};">${statusLabel}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                    💡 <strong>Insights:</strong> Top performers have 4+ rating | Poor performers (below 3⭐) with 3+ reviews need follow-up
                </p>
            </div>

            <!-- Monthly Booking Chart -->
            <div class="metric-card" style="display:block;">
                <h3 style="margin-bottom:1rem;">📈 Monthly Bookings & Revenue Forecast</h3>
                <canvas id="bookingTimeChart"></canvas>
            </div>
        `;

        setTimeout(() => {
            // Revenue by Vehicle Type
            const vehicleLabels = Object.keys(vehicleRevenue);
            const vehicleValues = Object.values(vehicleRevenue);
            new Chart(document.getElementById("vehicleRevenueChart"), {
                type: "doughnut",
                data: {
                    labels: vehicleLabels.length > 0 ? vehicleLabels : ['No Data'],
                    datasets: [{
                        data: vehicleValues.length > 0 ? vehicleValues : [0],
                        backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });

            // Demand by Destination
            new Chart(document.getElementById("trendChart"), {
                type: "pie",
                data: {
                    labels: tLabels.length > 0 ? tLabels : ['No Data'],
                    datasets: [{
                        data: tCounts.length > 0 ? tCounts : [0],
                        backgroundColor: [
                            '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
                        ]
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            // Peak Hours
            const hoursLabels = Array.from({length: 24}, (_, i) => i + ':00');
            const hoursValues = hoursLabels.map((_, i) => hoursData[i] || 0);
            new Chart(document.getElementById("peakHoursChart"), {
                type: "line",
                data: {
                    labels: hoursLabels,
                    datasets: [{
                        label: 'Bookings per Hour',
                        data: hoursValues,
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });

            // Workload Distribution (Top 10 drivers)
            const topDrivers = sortedDrivers.slice(0, 10);
            new Chart(document.getElementById("workloadChart"), {
                type: "bar",
                data: {
                    labels: topDrivers.map(d => d.name.split(' ')[0]),
                    datasets: [{
                        label: 'Total Bookings',
                        data: topDrivers.map(d => d.bookings),
                        backgroundColor: '#3b82f6'
                    }]
                },
                options: { 
                    responsive: true, 
                    indexAxis: 'x',
                    plugins: { legend: { display: false } }
                }
            });

            // Monthly Bookings
            new Chart(document.getElementById("bookingTimeChart"), {
                type: "bar",
                data: {
                    labels: ["Revenue", "Bookings", "Completed", "Cancelled"],
                    datasets: [{
                        label: "Platform Metrics",
                        data: [
                            totalRevenue,
                            totalBookings,
                            completedTrips,
                            cancelledBookings
                        ],
                        backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }, 100);
    } catch (e) {
        console.error('Analytics error:', e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading analytics: ${e.message}</div>`;
    }
}

function renderFeedbackTab(content) {
    try {
        const feedback = adminState.feedback || [];
        
        // Separate feedback types
        const customerFeedback = feedback.filter(f => f.type === 'SERVICE' || f.type === 'GENERAL');
        const driverFeedback = feedback.filter(f => f.targetUserId && f.type === 'SERVICE');
        
        // Calculate statistics for customer feedback
        const totalCustomerFeedback = customerFeedback.length;
        const avgCustomerRating = totalCustomerFeedback > 0 ? 
            (customerFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / totalCustomerFeedback).toFixed(1) : 0;
        
        // Calculate statistics for driver performance
        const totalDriverFeedback = driverFeedback.length;
        const avgDriverRating = totalDriverFeedback > 0 ? 
            (driverFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / totalDriverFeedback).toFixed(1) : 0;
        
        // Rating distribution for customer feedback
        const customerRatingDistribution = [0, 0, 0, 0, 0];
        customerFeedback.forEach(f => {
            if (f.rating >= 1 && f.rating <= 5) {
                customerRatingDistribution[f.rating - 1]++;
            }
        });
        
        // Rating distribution for driver feedback
        const driverRatingDistribution = [0, 0, 0, 0, 0];
        driverFeedback.forEach(f => {
            if (f.rating >= 1 && f.rating <= 5) {
                driverRatingDistribution[f.rating - 1]++;
            }
        });

        const renderFeedbackList = (feedbackList, title, emptyMessage) => {
            if (feedbackList.length === 0) {
                return `<div style="padding: 3rem; text-align: center; color: var(--text-secondary); background: #f9f9f9; border-radius: 8px;">${emptyMessage}</div>`;
            }
            
            return feedbackList.map(f => {
                const booking = adminState.bookings.find(b => b.id === f.bookingId);
                const user = adminState.users.find(u => u.uid === (booking?.userId));
                const driver = adminState.users.find(u => u.uid === (booking?.assignedDriverId || f.targetUserId));
                
                const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
                
                return `
                    <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <div>
                                <div style="font-size: 1.25rem; color: #fbbf24; margin-bottom: 0.5rem;">${stars}</div>
                                <h3 style="margin: 0; color: var(--text-primary); font-size: 1rem; font-weight: 600;">
                                    ${booking ? `${booking.pickupLocation || 'N/A'} → ${booking.destination || 'N/A'}` : 'Trip'}
                                </h3>
                                <p style="margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                                    👤 ${user?.fullName || 'Customer'} | 🚗 ${driver?.fullName || 'Driver'} | 📅 ${booking ? new Date(booking.startDate).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <div style="text-align: right;">
                                <span class="badge badge-completed">${f.rating}/5</span>
                            </div>
                        </div>
                        
                        ${f.comment ? `
                            <div style="background: #f9fafb; border-radius: 8px; padding: 1rem; margin-top: 1rem;">
                                <p style="margin: 0; color: var(--text-primary); font-style: italic;">"${f.comment}"</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        };

        content.innerHTML = `
            <div class="page-header">
                <h2>Customer Feedback & Driver Performance</h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Monitor customer satisfaction and driver performance</p>
            </div>

            <!-- Customer Feedback Section -->
            <div style="margin-bottom: 3rem;">
                <h3 style="color: var(--text-primary); font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Customer Feedback</h3>
                
                <!-- Customer Feedback Statistics -->
                <div class="metrics-grid" style="margin-bottom: 2rem;">
                    <div class="metric-card">
                        <div class="metric-icon">${icons.book}</div>
                        <div class="metric-info">
                            <h3>Total Reviews</h3>
                            <div class="value">${totalCustomerFeedback}</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">⭐</div>
                        <div class="metric-info">
                            <h3>Average Rating</h3>
                            <div class="value">${avgCustomerRating}</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">${icons.users}</div>
                        <div class="metric-info">
                            <h3>5-Star Reviews</h3>
                            <div class="value">${customerRatingDistribution[4]}</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">📊</div>
                        <div class="metric-info">
                            <h3>Response Rate</h3>
                            <div class="value">${totalCustomerFeedback > 0 ? Math.round((customerFeedback.filter(f => f.comment).length / totalCustomerFeedback) * 100) : 0}%</div>
                        </div>
                    </div>
                </div>

                <!-- Customer Feedback List -->
                <div class="table-container">
                    <div class="table-header">
                        <h3 style="font-size: 1rem; font-weight: 600;">Recent Customer Reviews</h3>
                    </div>
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${renderFeedbackList(customerFeedback.slice(0, 10), 'Customer Feedback', 'No customer feedback yet.')}
                    </div>
                </div>
            </div>

            <!-- Driver Performance Section -->
            <div>
                <h3 style="color: var(--text-primary); font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Driver Performance</h3>
                
                <!-- Driver Performance Statistics -->
                <div class="metrics-grid" style="margin-bottom: 2rem;">
                    <div class="metric-card">
                        <div class="metric-icon">${icons.book}</div>
                        <div class="metric-info">
                            <h3>Total Reviews</h3>
                            <div class="value">${totalDriverFeedback}</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">⭐</div>
                        <div class="metric-info">
                            <h3>Average Rating</h3>
                            <div class="value">${avgDriverRating}</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">${icons.users}</div>
                        <div class="metric-info">
                            <h3>5-Star Reviews</h3>
                            <div class="value">${driverRatingDistribution[4]}</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">📊</div>
                        <div class="metric-info">
                            <h3>Response Rate</h3>
                            <div class="value">${totalDriverFeedback > 0 ? Math.round((driverFeedback.filter(f => f.comment).length / totalDriverFeedback) * 100) : 0}%</div>
                        </div>
                    </div>
                </div>

                <!-- Driver Performance List -->
                <div class="table-container">
                    <div class="table-header">
                        <h3 style="font-size: 1rem; font-weight: 600;">Recent Driver Reviews</h3>
                    </div>
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${renderFeedbackList(driverFeedback.slice(0, 10), 'Driver Performance', 'No driver feedback yet.')}
                    </div>
                </div>
            </div>
        `;

        // Optional: Render rating distribution charts if needed
        // You can add chart rendering here if desired
    } catch (error) {
        console.error('Error rendering feedback tab:', error);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading feedback data.</div>`;
    }
}

// Driver Assignment Modal after booking approval
function showDriverAssignmentModal(bookingId) {
    // Find the booking
    const booking = adminState.bookings.find(b => b.id === bookingId);
    if (!booking) {
        showToast('Booking not found', '#ef4444');
        return;
    }

    // Get available drivers and vehicles
    const availableDrivers = adminState.users.filter(u => u.role === 'Driver' && u.status === 'Active');
    const availableVehicles = adminState.vehicles.filter(v => v.status === 'active' && v.isAvailable);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'driverAssignmentModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';

    const driverOptions = availableDrivers.map(d => 
        `<option value="${d.uid}">${d.fullName} (${d.email})</option>`
    ).join('');

    const vehicleOptions = availableVehicles.map(v => 
        `<option value="${v.id}">${v.registrationNumber} - ${v.make} ${v.model} (${v.vehicleType})</option>`
    ).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Assign Driver & Vehicle</h3>
                <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div style="margin-bottom: 1rem; padding: 1rem; background: var(--surface-color); border-radius: 8px;">
                    <h4 style="margin: 0 0 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">BOOKING DETAILS</h4>
                    <p style="margin: 0; font-weight: 500;">${booking.pickupLocation || 'N/A'} → ${booking.destination || 'N/A'}</p>
                    <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--text-secondary);">
                        ${new Date(booking.startDate).toLocaleDateString()} | ${booking.vehicleType || 'Any'} | KSH ${booking.price?.toLocaleString() || 'N/A'}
                    </p>
                </div>

                <form id="driverAssignmentForm">
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Select Driver</label>
                        <select id="driverSelect" class="form-control" required style="width: 100%;">
                            <option value="">Choose a driver...</option>
                            ${driverOptions}
                        </select>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Select Vehicle</label>
                        <select id="vehicleSelect" class="form-control" required style="width: 100%;">
                            <option value="">Choose a vehicle...</option>
                            ${vehicleOptions}
                        </select>
                    </div>

                    <div style="display: flex; gap: 0.75rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Assign & Update Status</button>
                        <button type="button" class="btn btn-secondary" id="skipAssignmentBtn" style="flex: 1;">Skip for Now</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.getElementById('skipAssignmentBtn').addEventListener('click', () => {
        modal.remove();
        showToast('Assignment skipped - you can assign later', '#f59e0b');
    });

    document.getElementById('driverAssignmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const driverId = document.getElementById('driverSelect').value;
        const vehicleId = document.getElementById('vehicleSelect').value;

        if (!driverId || !vehicleId) {
            showToast('Please select both driver and vehicle', '#ef4444');
            return;
        }

        try {
            // Assign driver and vehicle to booking
            await api.assignBooking({ bookingId, driverId, vehicleId });
            showToast('Driver and vehicle assigned successfully!');
            modal.remove();
            // Refresh data
            await loadAdminData(document.querySelector('.main-content'));
        } catch (error) {
            console.error('Assignment failed:', error);
            showToast('Failed to assign driver and vehicle', '#ef4444');
        }
    });
}

// Edit vehicle modal
function showEditVehicleModal(vehicleId) {
    const vehicle = adminState.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
        showToast('Vehicle not found', '#ef4444');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';

    modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;">
            <div class="modal-header">
                <h3>Edit Vehicle</h3>
                <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>
            <div class="modal-body" style="padding:1.5rem;">
                <form id="editVehicleForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label>Registration #</label>
                        <input type="text" id="editRegNumber" class="form-control" required value="${vehicle.registrationNumber || ''}" />
                    </div>
                    <div>
                        <label>Type</label>
                        <select id="editVehType" class="form-control">
                            <option value="sedan" ${vehicle.vehicleType === 'sedan' ? 'selected' : ''}>Sedan</option>
                            <option value="suv" ${vehicle.vehicleType === 'suv' ? 'selected' : ''}>SUV</option>
                            <option value="van" ${vehicle.vehicleType === 'van' ? 'selected' : ''}>Van</option>
                            <option value="bike" ${vehicle.vehicleType === 'bike' ? 'selected' : ''}>Bike</option>
                        </select>
                    </div>
                    <div>
                        <label>Make</label>
                        <input type="text" id="editMake" class="form-control" value="${vehicle.make || ''}" />
                    </div>
                    <div>
                        <label>Model</label>
                        <input type="text" id="editModel" class="form-control" value="${vehicle.model || ''}" />
                    </div>
                    <div>
                        <label>Year</label>
                        <input type="number" id="editYear" class="form-control" value="${vehicle.year || ''}" />
                    </div>
                    <div>
                        <label>Price/Day</label>
                        <input type="number" id="editPriceDay" class="form-control" step="0.01" value="${vehicle.pricePerDay || ''}" />
                    </div>
                    <div style="grid-column: span 2; text-align:right;">
                        <button type="submit" class="btn btn-primary" style="width:150px;">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.remove();
    });

    const editForm = document.getElementById('editVehicleForm');
    const submitBtn = editForm.querySelector('button[type="submit"]');
    
    editForm.addEventListener('submit', async e => {
        e.preventDefault();
        
        // Disable button and show loading state
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        
        const data = {
            id: vehicleId,
            RegistrationNumber: document.getElementById('editRegNumber').value,
            VehicleType: document.getElementById('editVehType').value,
            Make: document.getElementById('editMake').value,
            Model: document.getElementById('editModel').value,
            Year: parseInt(document.getElementById('editYear').value) || 0,
            PricePerDay: parseFloat(document.getElementById('editPriceDay').value) || 0,
        };
        
        try {
            await api.updateVehicle(vehicleId, data);
            showToast('Vehicle updated successfully', '#10b981');
            
            // Remove modal completely from DOM
            modal.remove();
            
            // Re-render fleet tab directly without full data reload
            const content = document.querySelector('.main-content');
            renderFleetTab(content);
            
        } catch (err) {
            console.error(err);
            showToast('Update failed: ' + (err.message || 'Unknown error'), '#ef4444');
            
            // Re-enable button on error
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Update Status Modal
function showUpdateStatusModal(bookingId) {
    const booking = adminState.bookings.find(b => b.id === bookingId);
    if (!booking) {
        showToast('Booking not found', '#ef4444');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'statusUpdateModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';

    const currentStatus = booking.status;
    const statusOptions = [
        { value: 'APPROVED', label: 'Approved', color: '#10b981' },
        { value: 'ASSIGNED', label: 'Assigned', color: '#3b82f6' },
        { value: 'IN_PROGRESS', label: 'In Progress', color: '#f59e0b' },
        { value: 'COMPLETED', label: 'Completed', color: '#22c55e' },
        { value: 'CANCELLED', label: 'Cancelled', color: '#ef4444' }
    ];

    const statusHtml = statusOptions.map(option => `
        <option value="${option.value}" ${option.value === currentStatus ? 'selected' : ''} 
                style="color: ${option.color};">${option.label}</option>
    `).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3>Update Booking Status</h3>
                <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div style="margin-bottom: 1rem; padding: 1rem; background: var(--surface-color); border-radius: 8px;">
                    <h4 style="margin: 0 0 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">BOOKING DETAILS</h4>
                    <p style="margin: 0; font-weight: 500;">${booking.pickupLocation || 'N/A'} → ${booking.destination || 'N/A'}</p>
                    <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--text-secondary);">
                        Current Status: <span style="font-weight: 600; color: ${statusOptions.find(s => s.value === currentStatus)?.color || '#666'};">${currentStatus}</span>
                    </p>
                </div>

                <form id="statusUpdateForm">
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">New Status</label>
                        <select id="statusSelect" class="form-control" required style="width: 100%;">
                            ${statusHtml}
                        </select>
                    </div>

                    <div style="display: flex; gap: 0.75rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Update Status</button>
                        <button type="button" class="btn btn-secondary" id="cancelStatusUpdateBtn" style="flex: 1;">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.getElementById('cancelStatusUpdateBtn').addEventListener('click', () => modal.remove());

    document.getElementById('statusUpdateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newStatus = document.getElementById('statusSelect').value;

        if (newStatus === currentStatus) {
            showToast('Status unchanged', '#f59e0b');
            modal.remove();
            return;
        }

        try {
            await api.updateBookingStatus(bookingId, newStatus);
            showToast(`Status updated to ${newStatus}`);
            modal.remove();
            // Refresh data
            await loadAdminData(document.querySelector('.main-content'));
        } catch (error) {
            console.error('Status update failed:', error);
            showToast('Failed to update status', '#ef4444');
        }
    });
}
