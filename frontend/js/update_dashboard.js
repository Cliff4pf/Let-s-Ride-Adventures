const fs = require('fs');
const filepath = 'C:\\Users\\Cliff\\OneDrive\\Documents\\RideHub\\frontend\\js\\dashboard.js';
let contents = fs.readFileSync(filepath, 'utf8');

const createNavItemReplacement = `function createNavItem(text, icon, isActive = false, isLogout = false, sectionId = '') {
    return \`
        <li class="nav-item" \${sectionId ? \`data-section="\${sectionId}"\` : ''}>
            <a href="#" class="nav-link \${isActive ? 'active' : ''}" \${isLogout ? 'id="logoutBtn"' : ''}>
                \${icon} \${text}
            </a>
        </li>
    \`;
}

let pendingBookingPayload = null;`;

const touristUIReplacement = `async function renderTouristUI(sidebar, content, section = 'dashboard') {
    // 1. Produce Sidebar
    sidebar.innerHTML = \`
        \${createNavItem('Dashboard', icons.dashboard, section === 'dashboard', false, 'dashboard')}
        \${createNavItem('Bookings', icons.book, section === 'bookings', false, 'bookings')}
        \${createNavItem('Logout', icons.logout, false, true)}
    \`;

    // Bind sidebar clicks
    sidebar.querySelectorAll('li[data-section]').forEach(li => {
        li.addEventListener('click', (e) => {
            e.preventDefault();
            const target = li.getAttribute('data-section');
            renderTouristUI(sidebar, content, target);
        });
    });

    if (section === 'dashboard') {
        await renderTouristDashboardView(sidebar, content);
    } else if (section === 'bookings') {
        await renderTouristBookingsView(sidebar, content);
    }
}

async function renderTouristDashboardView(sidebar, content) {
    content.innerHTML = \`<div style="padding:2rem;text-align:center;">Loading Tourist Dashboard...</div>\`;

    try {
        const res = await api.getBookings();
        const bookings = await res.json();

        const pendingCount = bookings.filter(b => b.status === "PENDING" || b.status === "APPROVED").length;
        const historyCount = bookings.filter(b => b.status === "COMPLETED" || b.status === "CANCELLED").length;

        let tableHtml = '';
        if (bookings.length === 0) {
            tableHtml = \`<tr><td colspan="5" style="text-align:center;">No bookings found.</td></tr>\`;
        } else {
            tableHtml = bookings.map(b => \`
                <tr>
                    <td>\${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>\${b.destination || '-'}</td>
                    <td>\${b.bookingType}</td>
                    <td><span class="badge badge-\${b.status.toLowerCase()}">\${b.status}</span></td>
                    <td>
                        \${(b.status === 'PENDING' || b.status === 'APPROVED')
                    ? \`<button class="btn btn-secondary cancel-btn" data-id="\${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Cancel</button>\`
                    : \`<span style="font-size: 0.75rem; color: #aaa;">Locked</span>\`}
                    </td>
                </tr>
            \`).join('');
        }

        // 2. Produce Content
        content.innerHTML = \`
            <div class="page-header">
                <h2>Welcome to RideHub</h2>
                <button class="btn btn-primary" id="newBookingBtn">+ New Booking</button>
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">\${icons.book}</div>
                    <div class="metric-info">
                        <h3>Upcoming Trips</h3>
                        <div class="value">\${pendingCount}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">\${icons.dashboard}</div>
                    <div class="metric-info">
                        <h3>History Logs</h3>
                        <div class="value">\${historyCount}</div>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <h3 style="font-size: 1rem; font-weight: 600;">My Recent Bookings</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Start Date</th>
                            <th>Destination</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${tableHtml}
                    </tbody>
                </table>
            </div>
        \`;

        // Bind Tourist Buttons
        content.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm("Are you sure you want to cancel this booking?")) {
                    await api.cancelBooking(id);
                    alert("Booking cancelled.");
                    renderTouristUI(sidebar, content, 'dashboard'); // reload
                }
            });
        });

        // Bind New Booking Button
        const newBookingBtn = document.getElementById('newBookingBtn');
        if (newBookingBtn) {
            newBookingBtn.addEventListener('click', () => {
                renderTouristUI(sidebar, content, 'bookings');
            });
        }
    } catch (e) {
        console.error(e);
        content.innerHTML = \`<div style="padding:2rem;color:red;">Error loading dashboard data.</div>\`;
    }
}

async function renderTouristBookingsView(sidebar, content) {
    content.innerHTML = \`
        <div class="page-header">
            <h2>Create New Booking</h2>
        </div>
        <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 600px;">
            <form id="newBookingForm">
                <div class="form-group">
                    <label for="bBookingType">Booking Type</label>
                    <select id="bBookingType" class="form-control" required>
                        <option value="transfer">Transfer</option>
                        <option value="tour">Tour</option>
                        <option value="pickup">Pickup</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bServiceType">Service Type</label>
                    <select id="bServiceType" class="form-control" required>
                        <option value="Transport">Transport</option>
                        <option value="Tour">Tour</option>
                        <option value="Pickup">Pickup</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bPickupLocation">Pickup Location</label>
                    <input type="text" id="bPickupLocation" class="form-control" required
                        placeholder="e.g. Kigali Airport">
                </div>
                <div class="form-group">
                    <label for="bDestination">Destination</label>
                    <input type="text" id="bDestination" class="form-control" required
                        placeholder="e.g. Marriott Hotel">
                </div>

                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group" style="flex: 1; margin: 0;">
                        <label for="bStartDate">Start Date</label>
                        <input type="date" id="bStartDate" class="form-control" required>
                    </div>
                    <div class="form-group" style="flex: 1; margin: 0;">
                        <label for="bEndDate">End Date</label>
                        <input type="date" id="bEndDate" class="form-control" required>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group" style="flex: 1; margin: 0;">
                        <label for="bStartTime">Start Time</label>
                        <input type="time" id="bStartTime" class="form-control">
                    </div>
                    <div class="form-group" style="flex: 1; margin: 0;">
                        <label for="bEndTime">End Time</label>
                        <input type="time" id="bEndTime" class="form-control">
                    </div>
                </div>

                <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="bIsFullDay" style="width: auto;">
                    <label for="bIsFullDay" style="margin: 0;">Is this a full day booking?</label>
                </div>

                <div class="form-group" style="margin-top: 1rem;">
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Proceed to Payment
                        ($50.00)</button>
                </div>
            </form>
        </div>
    \`;

    const form = document.getElementById('newBookingForm');
    const paymentModal = document.getElementById('paymentModal');
    const confirmPayBtn = document.getElementById('confirmPayBtn');
    const cancelPayBtn = document.getElementById('cancelPayBtn');
    const paymentMethods = document.getElementById('paymentMethods');
    const paymentSpinner = document.getElementById('paymentSpinner');
    const paymentSuccess = document.getElementById('paymentSuccess');

    form.onsubmit = async (e) => {
        e.preventDefault();

        // Format dates slightly if needed, but the model accepts yyyy-MM-dd string.
        const startDateStr = document.getElementById('bStartDate').value;
        const endDateStr = document.getElementById('bEndDate').value;

        pendingBookingPayload = {
            destination: document.getElementById('bDestination').value,
            bookingType: document.getElementById('bBookingType').value,
            serviceType: document.getElementById('bServiceType').value,
            pickupLocation: document.getElementById('bPickupLocation').value,
            startDate: startDateStr ? new Date(startDateStr).toISOString() : "",
            endDate: endDateStr ? new Date(endDateStr).toISOString() : "",
            startTime: document.getElementById('bStartTime').value || null,
            endTime: document.getElementById('bEndTime').value || null,
            isFullDay: document.getElementById('bIsFullDay').checked,
            price: 50.0, // Default static, could be calculated later
            paymentStatus: "PAID" // Appended after successful mock
        };

        // Reset Payment UI State
        paymentMethods.style.display = 'flex';
        confirmPayBtn.style.display = 'block';
        cancelPayBtn.style.display = 'block';
        paymentSpinner.style.display = 'none';
        paymentSuccess.style.display = 'none';

        paymentModal.style.display = 'flex';
    };

    if (!window.paymentModalsInitialized) {
        cancelPayBtn.addEventListener('click', () => {
            paymentModal.style.display = 'none';
            pendingBookingPayload = null;
        });

        confirmPayBtn.addEventListener('click', async () => {
            if (!pendingBookingPayload) return;

            // Start Mock Spinner
            paymentMethods.style.display = 'none';
            confirmPayBtn.style.display = 'none';
            cancelPayBtn.style.display = 'none';
            paymentSpinner.style.display = 'block';

            // Simulate Network Delay (2 seconds)
            await new Promise(r => setTimeout(r, 2000));

            paymentSpinner.style.display = 'none';
            paymentSuccess.style.display = 'block';

            // Execute Backend Call after a tiny readable delay
            setTimeout(async () => {
                try {
                    await api.createBooking(pendingBookingPayload);
                    paymentModal.style.display = 'none';
                    pendingBookingPayload = null;
                    renderTouristUI(sidebar, content, 'dashboard'); // switch back to dashboard after success
                } catch (err) {
                    alert("Error finalizing booking.");
                    paymentModal.style.display = 'none';
                }
            }, 1000);
        });
        window.paymentModalsInitialized = true;
    }
}`;

contents = contents.replace(
    /function createNavItem[\s\S]*?<\/li>\s*`;\s*}/,
    () => createNavItemReplacement
);

// We need to replace async function renderTouristUI(sidebar, content) ... until the end of the function.
// Since we might have modified it earlier (e.g. the 7 line replace), we shouldn't rely on line count.
contents = contents.replace(
    /async function renderTouristUI\(sidebar, content\) \{[\s\S]*?^\}\s*(?=async function renderDriverUI)/m,
    () => touristUIReplacement + '\n\n'
);

fs.writeFileSync(filepath, contents);
