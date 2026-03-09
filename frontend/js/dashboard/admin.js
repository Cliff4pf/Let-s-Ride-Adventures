// admin.js
import api from "../api.js";
import { icons, createNavItem, showToast } from "./shared.js";

let adminState = {
    bookings: [],
    users: [],
    vehicles: [],
    feedback: [],
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

    if (adminState.bookings.length === 0) {
        content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Admin Telemetry...</div>`;
        await loadAdminData(content);
    }

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
        const result = await response.json();

        if (response.ok) {
            showToast(result.message);
            await loadAdminData(content);
        } else {
            console.error("Promotion failed:", result);
            showToast(result.message || "Promotion failed", "#ef4444");
            alert("Error: " + (result.message || "Promotion failed"));
        }
    } catch (e) {
        console.error("Network error during promotion:", e);
        showToast("Network error during promotion", "#ef4444");
        alert("Network error: " + e.message);
    }
}

async function suspendUser(uid, content) {
    if (!confirm("Are you sure you want to suspend this user?")) return;

    try {
        const response = await api.suspendUser(uid);
        const result = await response.json();

        if (response.ok) {
            showToast(result.message);
            await loadAdminData(content);
        } else {
            console.error("Suspension failed", result);
            showToast(result.message || "Suspension failed", "#ef4444");
            alert("Error: " + (result.message || "Suspension failed"));
        }
    } catch (e) {
        console.error("Network error during suspension", e);
        showToast("Network error during suspension", "#ef4444");
        alert("Network error: " + e.message);
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

        const tData = Array.isArray(trendsData) ? trendsData : [];
        const tLabels = tData.map(d => d.destination || d.Destination || 'Unknown');
        const tCounts = tData.map(d => d.count || d.Count || 0);

        content.innerHTML = `
            <div class="page-header">
                <h2>Data-Driven Intelligence Dashboard</h2>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary-color), #4338ca); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.2rem;">Platform Summary</h3>
                    <p style="opacity: 0.9;">Real-time Business Metrics</p>
                </div>
                <div style="text-align: right; display: flex; gap: 2rem;">
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase;">Total Revenue</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">KSH ${totalRevenue.toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase;">Total Bookings</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${totalBookings}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase;">Completed Trips</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${completedTrips}</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div class="metric-card" style="display: block;">
                    <h3 style="margin-bottom: 1rem;">Platform Metrics Overview</h3>
                    <canvas id="revenueChart"></canvas>
                </div>
                <div class="metric-card" style="display: block;">
                    <h3 style="margin-bottom: 1rem;">Predictive Demand by Destination</h3>
                    <div style="max-height: 300px; display: flex; justify-content: center;">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>
            </div>
            <div class="metric-card" style="display:block;">
                <h3 style="margin-bottom:1rem;">Monthly Bookings & Forecast</h3>
                <canvas id="bookingTimeChart"></canvas>
            </div>
        `;

        setTimeout(() => {
            new Chart(document.getElementById("revenueChart"), {
                type: "bar",
                data: {
                    labels: ["Revenue", "Bookings", "Completed"],
                    datasets: [{
                        label: "Platform Metrics",
                        data: [
                            totalRevenue,
                            totalBookings,
                            completedTrips
                        ],
                        backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"],
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });

            new Chart(document.getElementById("trendChart"), {
                type: "pie",
                data: {
                    labels: tLabels,
                    datasets: [{
                        data: tCounts,
                        backgroundColor: [
                            '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
                        ]
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            // prepare monthly booking counts for descriptive+predictive
            const monthMap = {};
            adminState.bookings.forEach(b => {
                const d = new Date(b.createdAt);
                const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
                monthMap[key] = (monthMap[key] || 0) + 1;
            });
            const months = Object.keys(monthMap).sort((a,b) => new Date(a) - new Date(b));
            const counts = months.map(m => monthMap[m]);
            // linear regression forecast next month
            const x = months.map((_,i) => i+1);
            const y = counts;
            const xMean = x.reduce((a,c)=>a+c,0)/x.length;
            const yMean = y.reduce((a,c)=>a+c,0)/y.length;
            let num=0, den=0;
            for(let i=0;i<x.length;i++){ num += (x[i]-xMean)*(y[i]-yMean); den += (x[i]-xMean)**2; }
            const slope = den===0?0:num/den;
            const intercept = yMean - slope*xMean;
            const nextVal = Math.max(0, Math.round(intercept + slope*(x.length+1)));
            const forecastLabels = months.concat(['Next']);
            const forecastData = counts.concat([nextVal]);

            new Chart(document.getElementById("bookingTimeChart"), {
                type: "line",
                data: {
                    labels: forecastLabels,
                    datasets:[{
                        label:'Bookings',
                        data: forecastData,
                        fill:false,
                        borderColor:'#3b82f6',
                        tension:0.2
                    }]
                },
                options:{responsive:true, plugins:{legend:{display:false}}}
            });
        }, 50);

    } catch (e) {
        console.error("Analytics Error: ", e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Failed to process predictive analytics model. See console.</div>`;
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
