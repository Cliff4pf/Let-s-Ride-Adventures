import api from "../api.js";
import { icons, createNavItem, showToast } from "./shared.js";

let secretaryState = {
    activeTab: 'dashboard' // 'dashboard', 'create-booking', 'update-bookings'
};

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
            <div class="page-header">
                <h2>Create New Booking</h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Create a booking on behalf of a tourist</p>
            </div>

            <div class="booking-container">
                <div class="booking-form-section">
                    <div class="form-card">
                        <form id="secretaryBookingForm" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div class="form-group">
                                    <label for="bookingType">Booking Type</label>
                                    <select id="bookingType" name="bookingType" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px; background: white; cursor: pointer;">
                                        <option value="Transfer">Transfer</option>
                                        <option value="Tour">Tour</option>
                                        <option value="Pickup">Pickup</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="guests">Number of Guests</label>
                                    <input type="number" id="guests" name="numberOfGuests" min="1" required value="1" style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="pickup">Pickup Location</label>
                                <input type="text" id="pickup" name="pickupLocation" placeholder="Enter pickup location" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>

                            <div class="form-group">
                                <label for="destination">Destination</label>
                                <input type="text" id="destination" name="destination" placeholder="Enter destination" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div class="form-group">
                                    <label for="startDate">Start Date & Time</label>
                                    <input type="datetime-local" id="startDate" name="startDate" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                                </div>
                                <div class="form-group">
                                    <label for="vehiclePreference">Vehicle Type</label>
                                    <select id="vehiclePreference" name="vehiclePreference" style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px; background: white; cursor: pointer;">
                                        <option value="Any">Any</option>
                                        ${vehicleOptions}
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="specialRequests">Special Requests (Optional)</label>
                                <textarea id="specialRequests" name="specialRequests" placeholder="Any special requests?" style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px; resize: vertical; min-height: 80px;"></textarea>
                            </div>

                            <div class="form-group">
                                <label for="price">Estimated Price (KSH)</label>
                                <input type="number" id="price" name="price" min="0" step="50" placeholder="0.00" required style="width: 100%; padding: 0.875rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>

                            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem; font-weight: 600;">Create Booking</button>
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

        const allBookings = await bookingsRes.json();
        const allUsers = await driversRes.json();
        const allVehicles = await vehiclesRes.json();

        const pendingBookings = allBookings.filter(b => b.status === "PENDING");
        const approvedBookings = allBookings.filter(b => b.status === "APPROVED");
        const activeDrivers = allUsers.filter(u => u.role === "Driver" && u.status === "Active");
        const availableVehicles = allVehicles.filter(v => v.isAvailable);

        let tableHtml = '';
        if (pendingBookings.length === 0 && approvedBookings.length === 0) {
            tableHtml = `<tr><td colspan="5" style="text-align:center;">No bookings need attention.</td></tr>`;
        } else {
            tableHtml += pendingBookings.map(b => `
                <tr>
                    <td>${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>${b.destination || '-'}</td>
                    <td><span class="badge badge-pending">PENDING</span></td>
                    <td>
                        <button class="btn btn-primary approve-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Approve</button>
                        <button class="btn btn-secondary reject-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Reject</button>
                    </td>
                </tr>
            `).join('');

            tableHtml += approvedBookings.map(b => {
                const driverOptions = activeDrivers.map(d => `<option value="${d.uid}">${d.fullName}</option>`).join('');
                const vehicleOptions = availableVehicles.map(v => `<option value="${v.id}">${v.registrationNumber} (${v.model})</option>`).join('');
                return `
                <tr>
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
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await api.approveBooking(id);
                renderDispatcherDashboard(content);
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
                <tr>
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
    modal.querySelector('#editStartDate').value = booking.startDate ? new Date(booking.startDate).toISOString().slice(0, 16) : '';
    modal.querySelector('#editPrice').value = booking.price || 0;
    modal.querySelector('#editSpecialRequests').value = booking.specialRequests || '';
}
