// trip-details-modal.js - Reusable trip details modal for drivers and tourists
import api from "../api.js";
import { showToast } from "./shared.js";
import { escapeHTML } from "../utils.js";

export async function showTripDetailsModal(trip, userRole = 'driver') {
    try {
        // Fetch user/driver info if needed
        let touristInfo = null;
        let driverInfo = null;

        if (trip.userId && userRole === 'driver') {
            const userRes = await api.getUser(trip.userId);
            if (userRes && userRes.ok) {
                const userData = await userRes.json();
                touristInfo = userData.data || {};
            }
        }

        if (trip.assignedDriverId && userRole === 'tourist') {
            const driverRes = await api.getUser(trip.assignedDriverId);
            if (driverRes && driverRes.ok) {
                const dData = await driverRes.json();
                driverInfo = dData.data || {};
            }
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.style.zIndex = '2000';
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';

        const modalContent = createTripDetailsHtml(trip, touristInfo, driverInfo, userRole);
        modal.innerHTML = modalContent;

        document.body.appendChild(modal);

        // Attach event listeners
        attachTripDetailsEvents(modal, trip, userRole);

        // Fade in
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);

        return modal;
    } catch (error) {
        console.error('Failed to show trip details:', error);
        showToast('Failed to load trip details', '#ef4444');
    }
}

function createTripDetailsHtml(trip, touristInfo, driverInfo, userRole) {
    const startDate = new Date(trip.startDate);
    const endDate = trip.endDate ? new Date(trip.endDate) : null;

    let detailsHtml = '';
    
    if (userRole === 'driver' && touristInfo) {
        detailsHtml = `
            <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0;">
                <h4 style="margin: 0 0 1rem; font-weight: 600;">Passenger Information</h4>
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">Passenger Name</p>
                        <p style="margin: 0.5rem 0 0; font-size: 1rem; font-weight: 600;">${touristInfo.fullName || 'N/A'}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">Phone Number</p>
                        <p style="margin: 0.5rem 0 0; font-size: 1rem; font-weight: 600;">${touristInfo.phoneNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">Email</p>
                        <p style="margin: 0.5rem 0 0; font-size: 1rem; word-break: break-all;">${touristInfo.email || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;
    } else if (userRole === 'tourist' && driverInfo) {
        detailsHtml = `
            <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0;">
                <h4 style="margin: 0 0 1rem; font-weight: 600;">Driver Information</h4>
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">Driver Name</p>
                        <p style="margin: 0.5rem 0 0; font-size: 1rem; font-weight: 600;">${driverInfo.fullName || 'Not Assigned'}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">Phone Number</p>
                        <p style="margin: 0.5rem 0 0; font-size: 1rem; font-weight: 600;">${driverInfo.phoneNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">License Number</p>
                        <p style="margin: 0.5rem 0 0; font-size: 1rem; font-weight: 600;">${driverInfo.licenseNumber || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="modal-content" style="max-width: 600px; max-height: 85vh; overflow-y: auto;">
            <div class="modal-header" style="border-bottom: 2px solid var(--border-color);">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                    🚗 Trip Details
                </h3>
                <button class="trip-modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>

            <div class="modal-body" style="padding: 2rem;">
                <!-- Trip Status Badge -->
                <div style="margin-bottom: 1.5rem;">
                    <span class="badge badge-${trip.status.toLowerCase()}" style="font-size: 0.875rem; padding: 0.5rem 1rem;">${trip.status}</span>
                    ${trip.paymentStatus ? `<span class="badge badge-${trip.paymentStatus.toLowerCase()}" style="margin-left: 0.5rem; font-size: 0.875rem; padding: 0.5rem 1rem;">${trip.paymentStatus}</span>` : ''}
                </div>

                <!-- Trip Location & Route -->
                <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 1rem; font-weight: 600; font-size: 0.875rem; text-transform: uppercase; opacity: 0.9;">Route</h4>
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            <p style="margin: 0; font-size: 0.875rem; opacity: 0.9;">Pickup Location</p>
                            <p style="margin: 0.5rem 0 0; font-size: 1.1rem; font-weight: 600;">${trip.pickupLocation || 'TBD'}</p>
                        </div>
                        <div style="font-size: 1.5rem; opacity: 0.8;">→</div>
                        <div style="flex: 1;">
                            <p style="margin: 0; font-size: 0.875rem; opacity: 0.9;">Destination</p>
                            <p style="margin: 0.5rem 0 0; font-size: 1.1rem; font-weight: 600;">${trip.destination || 'TBD'}</p>
                        </div>
                    </div>
                </div>

                <!-- Trip Details Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: var(--surface-hover); padding: 1rem; border-radius: 8px;">
                        <p style="margin: 0; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Date & Time</p>
                        <p style="margin: 0.5rem 0 0; font-size: 0.95rem; font-weight: 600;">${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div style="background: var(--surface-hover); padding: 1rem; border-radius: 8px;">
                        <p style="margin: 0; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Passengers</p>
                        <p style="margin: 0.5rem 0 0; font-size: 0.95rem; font-weight: 600;">${trip.numberOfGuests || 0} Guest${trip.numberOfGuests !== 1 ? 's' : ''}</p>
                    </div>
                    <div style="background: var(--surface-hover); padding: 1rem; border-radius: 8px;">
                        <p style="margin: 0; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Service Type</p>
                        <p style="margin: 0.5rem 0 0; font-size: 0.95rem; font-weight: 600;">${trip.bookingType || 'Transfer'}</p>
                    </div>
                    <div style="background: var(--surface-hover); padding: 1rem; border-radius: 8px;">
                        <p style="margin: 0; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Price</p>
                        <p style="margin: 0.5rem 0 0; font-size: 0.95rem; font-weight: 600; color: var(--success);">KSH ${trip.price || 0}</p>
                    </div>
                </div>

                <!-- Special Requests -->
                ${trip.specialRequests ? `
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;">
                        <p style="margin: 0; font-size: 0.875rem; color: #92400e; font-weight: 600;">Special Requests</p>
                        <p style="margin: 0.5rem 0 0; color: #78350f;">${trip.specialRequests}</p>
                    </div>
                ` : ''}

                <!-- User Info Section -->
                ${detailsHtml}

                <!-- Close Button -->
                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                    <button class="btn btn-secondary trip-modal-close" style="flex: 1;">Close</button>
                </div>
            </div>
        </div>
    `;
}

function attachTripDetailsEvents(modal, trip, userRole) {
    const closeBtn = modal.querySelector('.trip-modal-close');
    const closeOverlay = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeOverlay);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeOverlay();
        }
    });

    // Smooth fade in
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);
}

// Helper function to allow API calls by user ID if not existing in api.js
async function getUser(userId) {
    const token = await api.getToken();
    try {
        const response = await fetch(`http://localhost:5202/api/User/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        return null;
    }
}

// Add getUser method to API if it doesn't exist
export function ensureGetUserAPI() {
    if (!api.getUser) {
        api.getUser = async function (userId) {
            return this.fetchWithAuth(`/User/${userId}`);
        };
    }
}
