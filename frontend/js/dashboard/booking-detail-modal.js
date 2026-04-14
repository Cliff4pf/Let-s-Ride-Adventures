// booking-detail-modal.js - Booking detail view for admin and secretary
import api from "../api.js";
import { showToast } from "./shared.js";

export async function showBookingDetailModal(booking, allUsers = []) {
    try {
        console.log('Showing booking detail modal for booking:', booking);
        console.log('All users provided:', allUsers);
        // Fetch full user details if not provided
        let touristData = allUsers.find(u => u.uid === booking.userId);
        let driverData = booking.assignedDriverId ? allUsers.find(u => u.uid === booking.assignedDriverId) : null;
        let vehicleData = null;

        console.log('Initial data lookup - touristData:', touristData, 'driverData:', driverData);

        // prepare list of drivers for potential assignment
        const drivers = allUsers.filter(u => u.role === 'Driver' && u.status === 'Active');
        // preload available vehicles (we may need them for assignment even if booking has none yet)
        let vehicleList = [];
        try {
            const vresAll = await api.getVehicles();
            if (vresAll.ok) {
                const allV = await vresAll.json();
                vehicleList = (allV.data || allV || []).filter(v => v.isAvailable);
            }
        } catch (err) {
            console.warn('Could not preload vehicles:', err);
        }

        // If user data not provided, fetch it
        if (!touristData && booking.userId) {
            try {
                console.log('Fetching tourist data for userId:', booking.userId);
                const res = await api.getUser(booking.userId);
                console.log('API response for tourist:', res.ok, res.status);
                if (res.ok) {
                    const userData = await res.json();
                    touristData = userData.data || userData;
                    console.log('Fetched tourist data:', touristData);
                }
            } catch (err) {
                console.warn('Could not fetch tourist details:', err);
            }
        }

        // Fetch vehicles if needed
        if (booking.vehicleId) {
            try {
                const res = await api.getVehicles();
                if (res.ok) {
                    const vesData = await res.json();
                    const vehicles = vesData.data || vesData || [];
                    vehicleData = vehicles.find(v => v.id === booking.vehicleId);
                }
            } catch (err) {
                console.warn('Could not fetch vehicle details:', err);
            }
        }

        // Format dates - handle Firestore timestamps
        const createValidDate = (dateValue) => {
            if (!dateValue) return new Date();
            // Handle Firestore timestamp objects
            if (typeof dateValue === 'object' && dateValue._seconds) {
                return new Date(dateValue._seconds * 1000 + (dateValue._nanoseconds || 0) / 1000000);
            }
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? new Date() : date;
        };

        const startDate = createValidDate(booking.startDate);
        const endDate = booking.endDate ? createValidDate(booking.endDate) : null;

        const modalHtml = `
            <div class="modal-overlay" id="bookingDetailModal">
                <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2 style="margin: 0; flex: 1;">Booking Details</h2>
                        <span class="badge badge-${booking.status.toLowerCase()}" style="font-size: 0.875rem; padding: 0.5rem 1rem;">${booking.status}</span>
                        <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); margin-left: 1rem;">×</button>
                    </div>

                    <div class="modal-body" style="padding: 2rem;">
                        <!-- Booking Summary -->
                        <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                            <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Trip Information</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Booking ID</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.id || 'N/A'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Booking Type</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.bookingType || 'Transfer'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Service Type</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.serviceType || 'Transport'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">No. of Guests</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.numberOfGuests || 1}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Location Information -->
                        <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                            <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Location & Schedule</h3>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Pickup Location</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.pickupLocation || 'Not specified'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Destination</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.destination || 'Not specified'}</p>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Start Date</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()}</p>
                                    </div>
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">End Date</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${endDate ? endDate.toLocaleDateString() + ' ' + endDate.toLocaleTimeString() : 'Not specified'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Vehicle Preference</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.vehiclePreference || 'Any'}</p>
                                </div>
                                ${booking.specialRequests ? `
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Special Requests</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.specialRequests}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Tourist Information -->
                        <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                            <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Tourist Information</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Name</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${touristData?.fullName || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Email</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${touristData?.email || 'Not available'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Phone Number</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${touristData?.phoneNumber || 'Not provided'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">User ID</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.userId}</p>
                                </div>
                            </div>
                        </div>

                        ${booking.assignedDriverId && driverData ? `
                            <!-- Driver Information -->
                            <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                                <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Driver Information</h3>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Name</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${driverData.fullName || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Email</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${driverData.email || 'Not available'}</p>
                                    </div>
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Phone Number</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${driverData.phoneNumber || 'Not provided'}</p>
                                    </div>
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">License Number</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${driverData.licenseNumber || 'Not available'}</p>
                                    </div>
                                </div>
                            </div>
                        ` : booking.assignedDriverId ? `
                            <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                                <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Driver Information</h3>
                                <p style="color: var(--text-secondary); margin: 0;">Driver assigned but details not available</p>
                            </div>
                        ` : ''}

                        ${vehicleData ? `
                            <!-- Vehicle Information -->
                            <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                                <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Vehicle Information</h3>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Registration</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${vehicleData.registrationNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Type</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${vehicleData.vehicleType || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Capacity</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${vehicleData.capacity || 'N/A'} seats</p>
                                    </div>
                                    <div>
                                        <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Status</p>
                                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${vehicleData.status || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Pricing & Payment -->
                        <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                            <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Pricing & Payment</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Price</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${booking.price != null ? `KSH ${booking.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'N/A'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Payment Status</p>
                                    <p style="margin: 0; font-weight: 600; color: ${booking.paymentStatus === 'PAID' ? '#10b981' : '#ef4444'};">${booking.paymentStatus || 'UNPAID'}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Timeline -->
                        <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                            <h3 style="margin: 0 0 1rem; color: var(--text-primary);">Timeline</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Created At</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">
                                        ${(() => {
                                            if (!booking.createdAt) return 'N/A';
                                            const d = new Date(booking.createdAt);
                                            return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
                                        })()}
                                    </p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--text-secondary);">Last Updated</p>
                                    <p style="margin: 0; font-weight: 600; color: var(--text-primary);">
                                        ${(() => {
                                            if (!booking.updatedAt) return 'Never';
                                            const d = new Date(booking.updatedAt);
                                            return isNaN(d.getTime()) ? 'Never' : d.toLocaleString();
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 1.5rem; border-top: 1px solid var(--border-color); background: var(--surface-hover); border-radius: 0 0 var(--radius-lg) var(--radius-lg);">
                        <button class="modal-close-btn" style="padding: 0.75rem 1.5rem; background: var(--primary-color); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 500;">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Create and append modal
        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);

        // now that modal exists we can inject optional action controls
        const modalElement = document.getElementById('bookingDetailModal');
        const roleElem = document.getElementById('userRole');
        const currentRole = roleElem ? roleElem.textContent.trim() : '';

        // helper to dispatch update event so callers can refresh UI
        const notifyChange = () => {
            window.dispatchEvent(new CustomEvent('bookingUpdated', { detail: booking }));
        };

        if ((currentRole === 'Secretary' || currentRole === 'Admin')) {
            const footer = modalElement.querySelector('.modal-footer');
            if (booking.status === 'PENDING') {
                const actionDiv = document.createElement('div');
                actionDiv.style.display = 'flex';
                actionDiv.style.gap = '1rem';
                actionDiv.style.justifyContent = 'flex-end';

                const rejectBtn = document.createElement('button');
                rejectBtn.id = 'rejectBookingBtn';
                // make it visually prominent
                rejectBtn.className = 'btn btn-danger';
                rejectBtn.style.background = '#ef4444';
                rejectBtn.style.color = 'white';
                rejectBtn.textContent = 'Reject';

                const approveBtn = document.createElement('button');
                approveBtn.id = 'approveBookingBtn';
                approveBtn.className = 'btn btn-primary';
                approveBtn.textContent = 'Approve & Assign';

                actionDiv.appendChild(rejectBtn);
                actionDiv.appendChild(approveBtn);
                footer.parentNode.insertBefore(actionDiv, footer);

                // create hidden assignment section
                const assignDiv = document.createElement('div');
                assignDiv.id = 'assignSection';
                assignDiv.style.display = 'none';
                assignDiv.style.marginTop = '1rem';
                assignDiv.style.borderTop = '1px solid var(--border-color)';
                assignDiv.style.paddingTop = '1rem';
                assignDiv.innerHTML = `
                    <h4 style="margin:0 0 0.5rem;">Assign Driver & Vehicle</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label style="font-size:0.875rem;color:var(--text-secondary);display:block;margin-bottom:0.25rem;">Driver</label>
                            <select id="assignDriverSelect" style="width:100%;padding:0.5rem;">
                                <option value="">Auto-assigned from vehicle</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.875rem;color:var(--text-secondary);display:block;margin-bottom:0.25rem;">Vehicle</label>
                            <select id="assignVehicleSelect" style="width:100%;padding:0.5rem;">
                                <option value="">Select Vehicle</option>
                            </select>
                        </div>
                    </div>
                    <button id="confirmAssignBtn" class="btn btn-primary" style="margin-top:1rem;">Confirm Assignment</button>
                `;
                footer.parentNode.insertBefore(assignDiv, footer.nextSibling);

                // populate driver and vehicle dropdowns
                const driverSelect = assignDiv.querySelector('#assignDriverSelect');
                drivers.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.uid;
                    opt.textContent = d.fullName;
                    driverSelect.appendChild(opt);
                });
                
                const vehicleSelect = assignDiv.querySelector('#assignVehicleSelect');
                // Filter to only show available vehicles
                vehicleList.filter(v => v.isAvailable === true).forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = `${v.registrationNumber} (${v.model}) - ${v.assignedDriverId ? 'Assigned to Driver' : 'Unassigned'}`;
                    vehicleSelect.appendChild(opt);
                });

                // Auto-assign driver when vehicle is selected
                vehicleSelect.addEventListener('change', () => {
                    const selectedVehicleId = vehicleSelect.value;
                    if (selectedVehicleId) {
                        const vehicle = vehicleList.find(v => v.id === selectedVehicleId);
                        if (vehicle && vehicle.assignedDriverId) {
                            driverSelect.value = vehicle.assignedDriverId;
                            driverSelect.disabled = true;
                            driverSelect.style.opacity = '0.7';
                            driverSelect.style.cursor = 'not-allowed';
                        } else {
                            driverSelect.disabled = false;
                            driverSelect.style.opacity = '1';
                            driverSelect.style.cursor = 'pointer';
                            driverSelect.value = '';
                        }
                    } else {
                        driverSelect.disabled = false;
                        driverSelect.style.opacity = '1';
                        driverSelect.style.cursor = 'pointer';
                        driverSelect.value = '';
                    }
                });

                // handlers
                rejectBtn.addEventListener('click', async () => {
                    if (confirm('Reject this booking?')) {
                        try {
                            await api.rejectBooking(booking.id);
                            showToast('Booking rejected', '#ef4444');
                            // visual feedback: status badge inside modal
                            const badge = modalElement.querySelector('.badge');
                            if (badge) badge.textContent = 'REJECTED';
                            closeModal();
                            notifyChange();
                        } catch (err) {
                            console.error(err);
                            showToast('Failed to reject booking', '#ef4444');
                        }
                    }
                });

                approveBtn.addEventListener('click', () => {
                    assignDiv.style.display = 'block';
                    approveBtn.style.display = 'none';
                    rejectBtn.style.display = 'none';
                });

                assignDiv.querySelector('#confirmAssignBtn').addEventListener('click', async () => {
                    const driverId = driverSelect.value;
                    const vehicleId = vehicleSelect.value;
                    if (!vehicleId) {
                        alert('Please select a vehicle.');
                        return;
                    }
                    try {
                        // Send only vehicleId; backend will auto-assign driver if not specified
                        const response = await api.assignBooking({ bookingId: booking.id, driverId: driverId || undefined, vehicleId });
                        if (!response.ok) {
                            let errorMessage = 'Assignment failed';
                            try {
                                const errorData = await response.json();
                                if (errorData && errorData.message) {
                                    errorMessage = errorData.message;
                                }
                            } catch (parseError) {
                                const errorText = await response.text();
                                if (errorText) {
                                    errorMessage = errorText;
                                }
                            }
                            throw new Error(errorMessage);
                        }
                        showToast('Booking approved and assigned!', '#10b981');
                        closeModal();
                        notifyChange();
                    } catch (err) {
                        console.error(err);
                        showToast(`Failed to assign booking: ${err.message}`, '#ef4444');
                    }
                });
            } else if (booking.status === 'APPROVED') {
                // allow assignment when already approved
                const assignDiv = document.createElement('div');
                assignDiv.id = 'assignSection';
                assignDiv.style.marginTop = '1rem';
                assignDiv.style.borderTop = '1px solid var(--border-color)';
                assignDiv.style.paddingTop = '1rem';
                assignDiv.innerHTML = `
                    <h4 style="margin:0;">Assign Driver & Vehicle</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label style="font-size:0.875rem;color:var(--text-secondary);display:block;margin-bottom:0.25rem;">Driver</label>
                            <select id="assignDriverSelect" style="width:100%;padding:0.5rem;">
                                <option value="">Auto-assigned from vehicle</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.875rem;color:var(--text-secondary);display:block;margin-bottom:0.25rem;">Vehicle</label>
                            <select id="assignVehicleSelect" style="width:100%;padding:0.5rem;">
                                <option value="">Select Vehicle</option>
                            </select>
                        </div>
                    </div>
                    <button id="confirmAssignBtn" class="btn btn-primary" style="align-self:flex-end;margin-top:1rem;">Assign</button>
                `;
                footer.parentNode.insertBefore(assignDiv, footer);

                const driverSelect = assignDiv.querySelector('#assignDriverSelect');
                drivers.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.uid;
                    opt.textContent = d.fullName;
                    driverSelect.appendChild(opt);
                });
                
                const vehicleSelect = assignDiv.querySelector('#assignVehicleSelect');
                // Filter to only show available vehicles
                vehicleList.filter(v => v.isAvailable === true).forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = `${v.registrationNumber} (${v.model}) - ${v.assignedDriverId ? 'Assigned to Driver' : 'Unassigned'}`;
                    vehicleSelect.appendChild(opt);
                });

                // Auto-assign driver when vehicle is selected
                vehicleSelect.addEventListener('change', () => {
                    const selectedVehicleId = vehicleSelect.value;
                    if (selectedVehicleId) {
                        const vehicle = vehicleList.find(v => v.id === selectedVehicleId);
                        if (vehicle && vehicle.assignedDriverId) {
                            driverSelect.value = vehicle.assignedDriverId;
                            driverSelect.disabled = true;
                            driverSelect.style.opacity = '0.7';
                            driverSelect.style.cursor = 'not-allowed';
                        } else {
                            driverSelect.disabled = false;
                            driverSelect.style.opacity = '1';
                            driverSelect.style.cursor = 'pointer';
                            driverSelect.value = '';
                        }
                    } else {
                        driverSelect.disabled = false;
                        driverSelect.style.opacity = '1';
                        driverSelect.style.cursor = 'pointer';
                        driverSelect.value = '';
                    }
                });

                assignDiv.querySelector('#confirmAssignBtn').addEventListener('click', async () => {
                    const driverId = driverSelect.value;
                    const vehicleId = vehicleSelect.value;
                    if (!vehicleId) {
                        alert('Please select a vehicle.');
                        return;
                    }
                    try {
                        // Send only vehicleId; backend will auto-assign driver if not specified
                        const response = await api.assignBooking({ bookingId: booking.id, driverId: driverId || undefined, vehicleId });
                        if (!response.ok) {
                            let errorMessage = 'Assignment failed';
                            try {
                                const errorData = await response.json();
                                if (errorData && errorData.message) {
                                    errorMessage = errorData.message;
                                }
                            } catch (parseError) {
                                const errorText = await response.text();
                                if (errorText) {
                                    errorMessage = errorText;
                                }
                            }
                            throw new Error(errorMessage);
                        }
                        showToast('Booking assigned!', '#10b981');
                        closeModal();
                        notifyChange();
                    } catch (err) {
                        console.error(err);
                        showToast(`Assignment failed: ${err.message}`, '#ef4444');
                    }
                });
            }
        }

        // Attach event listeners
        const closeButtons = modalElement.querySelectorAll('.modal-close-btn');
        
        const closeModal = () => {
            modalElement.style.opacity = '0';
            setTimeout(() => modalElement.remove(), 300);
        };

        closeButtons.forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) closeModal();
        });

        // Show modal with animation
        setTimeout(() => {
            console.log('Setting modal display to flex and opacity to 1');
            modalElement.style.display = 'flex';
            modalElement.style.opacity = '1';
            modalElement.style.pointerEvents = 'auto';
        }, 10);

    } catch (error) {
        console.error('Error showing booking detail modal:', error);
        showToast('Failed to load booking details', '#ef4444');
    }
}

export async function createNotificationWithDetails(booking, touristData, driverData, type = 'booking_created') {
    const notification = {
        bookingId: booking.id,
        type: type,
        title: 'New Booking Created',
        message: `Trip to ${booking.destination}`,
        details: {
            pickupLocation: booking.pickupLocation,
            destination: booking.destination,
            startDate: booking.startDate,
            endDate: booking.endDate,
            numberOfGuests: booking.numberOfGuests
        },
        touristInfo: {
            name: touristData?.fullName,
            email: touristData?.email,
            phoneNumber: touristData?.phoneNumber
        },
        driverInfo: driverData ? {
            name: driverData.fullName,
            email: driverData.email,
            phoneNumber: driverData.phoneNumber,
            licenseNumber: driverData.licenseNumber
        } : null
    };

    return notification;
}
