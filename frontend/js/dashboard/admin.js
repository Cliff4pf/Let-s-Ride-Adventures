// admin.js
import api from "../api.js";
import { icons, createNavItem, showToast } from "./shared.js";
import { attachLogoutListener } from "./logout-helper.js";
import { initializeProfileModal } from "./profile-modal.js";

let adminState = {
    bookings: [],
    users: [],
    vehicles: [],
    feedback: [],
    auditLogs: [],
    activeTab: 'overview', // 'overview', 'users', 'fleet', 'analytics', 'feedback'
    filters: { status: 'ALL', search: '' }
};

export async function renderAdminUI(sidebar, content) {
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
        const [bRes, uRes, vRes] = await Promise.all([
            api.getBookings(),
            api.getAllUsers(),
            api.getVehicles()
        ]);
        adminState.bookings = await bRes.json();
        adminState.users = await uRes.json();
        adminState.vehicles = await vRes.json();

        // Fetch feedback separately - it's optional
        try {
            const fRes = await api.getFeedback();
            adminState.feedback = fRes && fRes.ok ? await fRes.json() : [];
        } catch (err) {
            console.warn('Feedback endpoint not available yet:', err.message);
            adminState.feedback = [];
        }

        if (content) {
            renderAdminView(content);
        }
    } catch (e) {
        console.error(e);
        if (content) content.innerHTML = `<div style="padding:2rem;color:red;">Error loading admin data.</div>`;
    }
}

// Generate audit logs from data
function generateAuditLogs() {
    const logs = [];

    // Log recent bookings
    adminState.bookings.slice(0, 20).forEach(b => {
        logs.push({
            id: b.id,
            type: 'booking',
            icon: '🚗',
            title: 'New Booking Created',
            description: `${b.vehicleType} booked to ${b.destination || 'Unknown'}`,
            timestamp: new Date(b.createdAt),
            severity: 'info'
        });
    });

    // Log booking status changes
    adminState.bookings.slice(0, 10).forEach(b => {
        if (b.status === 'COMPLETED') {
            logs.push({
                id: `${b.id}-complete`,
                type: 'completion',
                icon: '✅',
                title: 'Trip Completed',
                description: `${b.vehicleType} trip to ${b.destination || 'Unknown'} completed`,
                timestamp: new Date(b.completedAt || b.createdAt),
                severity: 'success'
            });
        } else if (b.status === 'CANCELLED') {
            logs.push({
                id: `${b.id}-cancel`,
                type: 'cancellation',
                icon: '❌',
                title: 'Booking Cancelled',
                description: `${b.vehicleType} booking cancelled`,
                timestamp: new Date(b.createdAt),
                severity: 'warning'
            });
        }
    });

    // Log recent user registrations
    adminState.users
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 15)
        .forEach(u => {
            logs.push({
                id: `user-${u.uid}`,
                type: 'registration',
                icon: '👤',
                title: 'New User Registered',
                description: `${u.firstName} ${u.lastName} registered as ${u.role}`,
                timestamp: new Date(u.createdAt),
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
                description: `${u.firstName} ${u.lastName} (${u.role}) has been suspended`,
                timestamp: new Date(u.updatedAt || u.createdAt),
                severity: 'critical'
            });
        });

    // Log feedback received
    adminState.feedback.slice(0, 10).forEach(f => {
        const ratingEmoji = f.rating >= 4 ? '⭐' : f.rating >= 3 ? '⚠️' : '❌';
        logs.push({
            id: `feedback-${f.id}`,
            type: 'feedback',
            icon: ratingEmoji,
            title: `Customer Review (${f.rating}⭐)`,
            description: f.comment || 'Review submitted',
            timestamp: new Date(f.createdAt),
            severity: f.rating >= 4 ? 'success' : f.rating >= 3 ? 'warning' : 'critical'
        });
    });

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);
    adminState.auditLogs = logs;
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
        <div style="display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--border-color); hover:background: var(--surface-color); transition: background 0.2s;">
            <div style="font-size: 1.5rem; min-width: 2rem; text-align: center;">${log.icon}</div>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                    <div>
                        <h4 style="margin: 0 0 0.25rem; color: var(--text-primary); font-weight: 600;">${log.title}</h4>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">${log.description}</p>
                    </div>
                    <span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${log.timestamp.toLocaleTimeString()}</span>
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

    document.getElementById('closeAuditModal').addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
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
                    <button class="btn btn-primary approve-btn" data-id="${b.id}" style="margin-right:0.25rem; font-size:0.75rem;">Approve</button>
                    <button class="btn btn-danger reject-btn" data-id="${b.id}" style="margin-right:0.25rem; font-size:0.75rem;">Reject</button>
                    <button class="btn btn-secondary cancel-btn" data-id="${b.id}" style="font-size:0.75rem;">Cancel</button>
                `;
            } else if (b.status === 'APPROVED' || b.status === 'ASSIGNED') {
                actions = `<button class="btn btn-secondary cancel-btn" data-id="${b.id}" style="font-size:0.75rem;">Cancel</button>`;
            }

            return `
            <tr>
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
                    <button class="btn btn-secondary promote-btn" data-id="${u.uid}" data-role="Driver" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Make Driver</button>
                    <button class="btn btn-secondary promote-btn" data-id="${u.uid}" data-role="Secretary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Make Secretary</button>
                    ${u.status === 'Active' ?
            `<button class="btn btn-primary suspend-btn" data-id="${u.uid}" style="background-color: #ef4444; padding: 0.25rem 0.5rem; font-size: 0.75rem;">Suspend</button>` :
            ''
        }
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
        <div class="table-container">
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
        
        // Calculate feedback statistics
        const totalFeedback = feedback.length;
        const averageRating = totalFeedback > 0 ? 
            (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / totalFeedback).toFixed(1) : 0;
        
        const ratingDistribution = [0, 0, 0, 0, 0]; // 1-5 stars
        feedback.forEach(f => {
            if (f.rating >= 1 && f.rating <= 5) {
                ratingDistribution[f.rating - 1]++;
            }
        });

        let feedbackHtml = '';
        if (totalFeedback === 0) {
            feedbackHtml = `<div style="padding: 3rem; text-align: center; color: var(--text-secondary); background: #f9f9f9; border-radius: 8px;">No customer feedback yet.</div>`;
        } else {
            feedbackHtml = feedback.map(f => {
                const booking = adminState.bookings.find(b => b.id === f.bookingId);
                const user = adminState.users.find(u => u.uid === (booking?.userId));
                const driver = adminState.users.find(u => u.uid === (booking?.assignedDriverId));
                
                const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
                
                return `
                    <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <div>
                                <div style="font-size: 1.25rem; color: #fbbf24; margin-bottom: 0.5rem;">${stars}</div>
                                <h3 style="margin: 0; color: var(--text-primary); font-size: 1rem; font-weight: 600;">
                                    ${booking ? `${booking.pickupLocation} → ${booking.destination}` : 'Trip'}
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
        }

        content.innerHTML = `
            <div class="page-header">
                <h2>Customer Feedback & Ratings</h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Monitor customer satisfaction and service quality</p>
            </div>

            <!-- Feedback Statistics -->
            <div class="metrics-grid" style="margin-bottom: 2rem;">
                <div class="metric-card">
                    <div class="metric-icon">${icons.book}</div>
                    <div class="metric-info">
                        <h3>Total Reviews</h3>
                        <div class="value">${totalFeedback}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">⭐</div>
                    <div class="metric-info">
                        <h3>Average Rating</h3>
                        <div class="value">${averageRating}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">${icons.users}</div>
                    <div class="metric-info">
                        <h3>5-Star Reviews</h3>
                        <div class="value">${ratingDistribution[4]}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">📊</div>
                    <div class="metric-info">
                        <h3>Response Rate</h3>
                        <div class="value">${totalFeedback > 0 ? Math.round((feedback.filter(f => f.comment).length / totalFeedback) * 100) : 0}%</div>
                    </div>
                </div>
            </div>

            <!-- Rating Distribution Chart -->
            <div style="background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Rating Distribution</h3>
                <canvas id="ratingChart" style="max-height: 200px;"></canvas>
            </div>

            <!-- Feedback List -->
            <div class="table-container">
                <div class="table-header">
                    <h3 style="font-size: 1rem; font-weight: 600;">Recent Customer Feedback</h3>
                </div>
                <div style="max-height: 600px; overflow-y: auto;">
                    ${feedbackHtml}
                </div>
            </div>
        `;

        // Render rating distribution chart
        if (totalFeedback > 0) {
            setTimeout(() => {
                try {
                    new Chart(document.getElementById("ratingChart"), {
                        type: "bar",
                        data: {
                            labels: ["1 Star", "2 Stars", "3 Stars", "4 Stars", "5 Stars"],
                            datasets: [{
                                label: "Number of Reviews",
                                data: ratingDistribution,
                                backgroundColor: [
                                    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e'
                                ],
                                borderRadius: 4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, ticks: { stepSize: 1 } }
                            }
                        }
                    });
                } catch (chartError) {
                    console.error("Chart rendering error:", chartError);
                }
            }, 50);
        }

    } catch (e) {
        console.error("Feedback Tab Error:", e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading feedback data.</div>`;
    }
}
