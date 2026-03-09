const fs = require('fs');
const filepath = 'C:\\Users\\Cliff\\OneDrive\\Documents\\RideHub\\frontend\\js\\dashboard.js';
let contents = fs.readFileSync(filepath, 'utf8');

const createNavItemReplacement = `function createNavItem(text, icon, section = null, isActive = false, isLogout = false) {
    return \`
        <li class="nav-item">
            <a href="#" 
               class="nav-link \${isActive ? 'active' : ''}" 
               \${section ? \`data-section="\${section}"\` : ''} 
               \${isLogout ? 'id="logoutBtn"' : ''}>
                \${icon} \${text}
            </a>
        </li>
    \`;
}`;

const touristUIReplacement = `async function renderTouristUI(sidebar, content, section = 'dashboard') {
    // 1. Produce Sidebar
    sidebar.innerHTML = \`
        \${createNavItem('Dashboard', icons.dashboard, 'dashboard', section === 'dashboard')}
        \${createNavItem('Bookings', icons.book, 'bookings', section === 'bookings')}
        \${createNavItem('Logout', icons.logout, null, false, true)}
    \`;

    // Bind sidebar clicks
    sidebar.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = e.currentTarget.dataset.section;

            if (targetSection === 'dashboard') {
                renderTouristUI(sidebar, content, 'dashboard');
            }

            if (targetSection === 'bookings') {
                renderTouristUI(sidebar, content, 'bookings');
            }
        });
    });

    if (section === 'dashboard') {
        await renderTouristDashboardView(sidebar, content);
    } else if (section === 'bookings') {
        await renderTouristBookingsView(sidebar, content);
    }
}`;

const bookingsViewReplacement = `async function renderTouristBookingsView(sidebar, content) {
    content.innerHTML = \`
        <div class="page-header">
            <h2>Create New Booking</h2>
        </div>

        <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 600px;">
            <form id="bookingForm">
                <div class="form-group">
                    <label>Destination</label>
                    <input type="text" id="bDestination" class="form-control" required />
                </div>

                <div class="form-group">
                    <label>Start Date</label>
                    <input type="date" id="bStartDate" class="form-control" required />
                </div>

                <div class="form-group">
                    <label>End Date</label>
                    <input type="date" id="bEndDate" class="form-control" />
                </div>

                <div class="form-group" style="margin-top: 1rem;">
                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        Proceed to Payment ($50.00)
                    </button>
                </div>
            </form>
        </div>
    \`;

    const form = document.getElementById('bookingForm');
    const paymentModal = document.getElementById('paymentModal');
    const confirmPayBtn = document.getElementById('confirmPayBtn');
    const cancelPayBtn = document.getElementById('cancelPayBtn');
    const paymentMethods = document.getElementById('paymentMethods');
    const paymentSpinner = document.getElementById('paymentSpinner');
    const paymentSuccess = document.getElementById('paymentSuccess');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            destination: document.getElementById('bDestination').value,
            startDate: new Date(document.getElementById('bStartDate').value).toISOString(),
            endDate: document.getElementById('bEndDate').value
                ? new Date(document.getElementById('bEndDate').value).toISOString()
                : null,
            price: 50,
            paymentStatus: "PAID",
            bookingType: "Transfer",  // Defaulting for the simplified form
            serviceType: "Transport", // Defaulting for the simplified form
            pickupLocation: "N/A"    // Defaulting for the simplified form
        };

        window.pendingPayload = payload;

        // Reset Payment UI State
        paymentMethods.style.display = 'flex';
        confirmPayBtn.style.display = 'block';
        cancelPayBtn.style.display = 'block';
        paymentSpinner.style.display = 'none';
        paymentSuccess.style.display = 'none';

        paymentModal.style.display = 'flex';
    });

    if (!window.paymentModalsInitialized) {
        cancelPayBtn.addEventListener('click', () => {
            paymentModal.style.display = 'none';
            window.pendingPayload = null;
        });

        confirmPayBtn.addEventListener('click', async () => {
            if (!window.pendingPayload) return;

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
                    await api.createBooking(window.pendingPayload);
                    paymentModal.style.display = 'none';
                    window.pendingPayload = null;
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

contents = contents.replace(
    /let pendingBookingPayload = null;/,
    () => ''
);

contents = contents.replace(
    /async function renderTouristUI[\s\S]*?^\}\s*(?=async function renderTouristDashboardView)/m,
    () => touristUIReplacement + '\n\n'
);

contents = contents.replace(
    /async function renderTouristBookingsView[\s\S]*?^\}\s*(?=async function renderDriverUI)/m,
    () => bookingsViewReplacement + '\n\n'
);

fs.writeFileSync(filepath, contents);
