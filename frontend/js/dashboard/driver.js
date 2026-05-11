import api from "../api.js";
import { icons, createNavItem, showToast, setupMenuBarEvents } from "./shared.js";
import { escapeHTML } from "../utils.js";
import { attachLogoutListener, handleLogout } from "./logout-helper.js";
import { initializeProfileModal } from "./profile-modal.js";
import { showTripDetailsModal, ensureGetUserAPI } from "./trip-details-modal.js";
import { showBillingModal } from "./billing-modal.js";

let driverState = {
    activeTab: 'trips', // 'trips', 'schedule', 'history'
    currentUserId: null
};

// Ensure API has getUser method
ensureGetUserAPI();

// setupMenuBarEvents moved to shared.js

// Update notification badge for drivers (assigned trips count)
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    // fetch bookings and count ASSIGNED for this driver
    api.getBookings()
        .then(res => res.ok ? res.json() : Promise.reject(`status ${res.status}`))
        .then(bookings => {
            const uid = localStorage.getItem('uid');
            const count = bookings.filter(b => b.assignedDriverId === uid && b.status === 'ASSIGNED').length;
            badge.textContent = count > 0 ? count : '';
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        })
        .catch(err => {
            console.warn('Could not update notification badge:', err);
        });
}

// Show driver notifications (assigned trips and system notifications)
async function showDriverNotifications() {
    try {
        // Get both bookings and system notifications
        const [bookingsRes, notificationsRes] = await Promise.all([
            api.getBookings(),
            api.getNotifications()
        ]);

        if (!bookingsRes.ok) {
            throw new Error(`Failed to fetch bookings: ${bookingsRes.status}`);
        }

        const bookings = await bookingsRes.json();
        let notifications = [];
        if (notificationsRes && notificationsRes.ok) {
            const notifData = await notificationsRes.json();
            notifications = notifData.data || notifData || [];
        }

        // Get driver's newly assigned trips (ASSIGNED status = just assigned, not started yet)
        const assignedTrips = bookings.filter(b => b.assignedDriverId && b.status === 'ASSIGNED');

        // Get unread system notifications for this driver
        const uid = localStorage.getItem('uid');
        const unreadNotifications = notifications.filter(n => n.userId === uid && !n.isRead);

        if (assignedTrips.length === 0 && unreadNotifications.length === 0) {
            const noNotifModal = document.createElement('div');
            noNotifModal.className = 'modal-overlay';
            noNotifModal.style.display = 'flex';
            noNotifModal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; text-align: center; padding: 2rem;">
                    <h3>No New Notifications</h3>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">You don't have any new trip assignments or notifications at the moment.</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;">Close</button>
                </div>
            `;
            document.body.appendChild(noNotifModal);
            noNotifModal.querySelector('button').addEventListener('click', () => noNotifModal.remove());
            return;
        }

        // Create notification modal with both trip assignments and system notifications
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Notifications</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                    ${assignedTrips.map(trip => `
                        <div class="notification-item" style="padding: 1rem; border-bottom: 1px solid var(--border-color); background: #f0f9ff;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>🚗 New Trip Assignment</strong>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                        ${trip.pickupLocation || 'N/A'} → ${trip.destination || 'N/A'}<br>
                                        ${new Date(trip.startDate).toLocaleString()}
                                    </div>
                                </div>
                                <span class="badge badge-assigned">ASSIGNED</span>
                            </div>
                        </div>
                    `).join('')}
                    ${unreadNotifications.map(notif => `
                        <div class="notification-item" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${notif.title}</strong>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                        ${notif.message}
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                                        ${new Date(notif.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-footer" style="padding: 1rem; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-secondary" id="markAllReadBtn">Mark All as Read</button>
                    <button class="btn btn-primary" id="closeNotificationsBtn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Close modal functionality
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#closeNotificationsBtn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Mark all notifications as read
        modal.querySelector('#markAllReadBtn').addEventListener('click', async () => {
            try {
                // Mark notifications as read (this would need a backend endpoint)
                // For now, just close the modal
                modal.remove();
                showToast('Notifications marked as read', '#10b981');
            } catch (error) {
                console.error('Failed to mark notifications as read:', error);
            }
        });

    } catch (error) {
        console.error('Failed to load notifications:', error);
        showToast('Failed to load notifications', '#ef4444');
    }
}

export async function renderDriverUI(sidebar, content) {
    sidebar.innerHTML = `
        ${createNavItem('Assigned Trips', icons.car, 'trips', driverState.activeTab === 'trips')}
        ${createNavItem('Schedule', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', 'schedule', driverState.activeTab === 'schedule')}
        ${createNavItem('History', icons.dashboard, 'history', driverState.activeTab === 'history')}
        ${createNavItem('Logout', icons.logout, false, true)}
    `;

    sidebar.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.currentTarget.dataset.section;
            if (['trips', 'schedule', 'history'].includes(section)) {
                driverState.activeTab = section;
                renderDriverUI(sidebar, content);
            }
        });
    });

    // Attach logout listener
    const logoutBtn = sidebar.querySelector('#logoutBtn');
    attachLogoutListener(logoutBtn);

    // Initialize profile modal
    initializeProfileModal();

    // Setup menu bar events
    setupMenuBarEvents(showDriverNotifications, null);
    // update badge once initially
    updateNotificationBadge();

    if (driverState.activeTab === 'trips') {
        await renderTripsView(content);
    } else if (driverState.activeTab === 'schedule') {
        await renderScheduleView(content);
    } else if (driverState.activeTab === 'history') {
        await renderHistoryView(content);
    }
}

async function renderTripsView(content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Assigned Trips...</div>`;

    try {
        const res = await api.getBookings();
        const myBookings = await res.json();

        // Fetch Driver Earnings
        const uid = localStorage.getItem("uid");
        let driverData = { totalTrips: 0, totalEarnings: 0 };
        try {
            const earnRes = await api.getDriverEarnings(uid);
            if (!earnRes.ok) throw new Error(`Earnings API Failed: ${earnRes.status} ${await earnRes.text()}`);

            const rawEarn = await earnRes.json();
            const eData = rawEarn.data || rawEarn;
            driverData = {
                totalTrips: eData.totalTrips ?? eData.TotalTrips ?? 0,
                totalEarnings: eData.totalEarnings ?? eData.TotalEarnings ?? 0
            };
        } catch (err) { console.error("Could not fetch earnings: ", err.message); }

        const activeTrip = myBookings.find(b => b.status === "ACCEPTED" || b.status === "IN_PROGRESS");
        const assignedOnly = myBookings.find(b => b.status === "ASSIGNED");

        let activeHtml = '';
        if (activeTrip) {
            activeHtml = `
            <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Current Mission: ${activeTrip.destination || 'City Transfer'}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">Scheduled: ${new Date(activeTrip.startDate).toLocaleString()}</p>
                    <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;"><span class="badge badge-${activeTrip.status.toLowerCase()}">${activeTrip.status}</span></p>
                </div>
                <div>
                    ${activeTrip.status === 'ACCEPTED' ?
                    `<button class="btn btn-primary start-trip-btn" data-id="${activeTrip.id}">Start Trip</button>` :
                    `<button class="btn btn-primary finish-trip-btn" data-id="${activeTrip.id}" style="background: #10b981; border-color: #10b981;">Complete Trip</button>`
                }
                </div>
            </div>
            `;
        } else if (assignedOnly) {
            // show accept/decline card when there's an assigned trip but it hasn't been accepted
            activeHtml = `
            <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">New Assignment: ${assignedOnly.destination || ''}</h3>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">Scheduled: ${new Date(assignedOnly.startDate).toLocaleString()}</p>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    <button class="btn btn-success accept-trip-inline" data-id="${assignedOnly.id}">Accept</button>
                    <button class="btn btn-danger decline-trip-inline" data-id="${assignedOnly.id}">Decline</button>
                </div>
            </div>
            `;
        } else {
            activeHtml = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: #f9f9f9; border-radius: 8px;">No active assignments. Grab a coffee!</div>`;
        }

        content.innerHTML = `
            <div class="page-header">
                <h2>Driver Portal - Assigned Trips</h2>
            </div>
            
            <div style="margin-bottom: 2rem; display: flex; gap: 1.5rem;">
                <div style="flex: 1; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.875rem; text-transform: uppercase;">Total Trips</div>
                    <div style="font-size: 2.5rem; font-weight: bold;">${driverData.totalTrips}</div>
                </div>
                <div style="flex: 1; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.875rem; text-transform: uppercase;">Total Earnings</div>
                    <div style="font-size: 2.5rem; font-weight: bold;">KSH ${driverData.totalEarnings.toLocaleString()}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem;">Active Assignment</h3>
                ${activeHtml}
            </div>
        `;

        const startBtn = content.querySelector('.start-trip-btn');
        if (startBtn) {
            startBtn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('Start this trip?')) {
                    try {
                        await api.startTrip(id);
                        showToast('Trip is now in progress', '#3b82f6');
                        renderTripsView(content);
                    } catch (err) {
                        console.error('Error starting trip:', err);
                        showToast('Unable to start trip', '#ef4444');
                    }
                }
            });
        }

        // handlers for inline accept/decline when shown in the main card
        content.querySelectorAll('.accept-trip-inline').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await api.acceptTrip(id);
                    showToast('Trip accepted! You can now start when ready.', '#10b981');
                    renderTripsView(content);
                } catch (err) {
                    console.error('Error accepting trip inline:', err);
                    showToast('Failed to accept trip', '#ef4444');
                }
            });
        });

        content.querySelectorAll('.decline-trip-inline').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!confirm('Decline this trip?')) return;
                try {
                    await api.declineTrip(id);
                    showToast('Trip declined.', '#ef4444');
                    renderTripsView(content);
                } catch (err) {
                    console.error('Error declining trip inline:', err);
                    showToast('Failed to decline trip', '#ef4444');
                }
            });
        });

        const finishBtn = content.querySelector('.finish-trip-btn');
        if (finishBtn) {
            finishBtn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const trip = myBookings.find(b => b.id === id);
                
                if (!trip) return;

                if (!confirm('Mark this trip as completed?')) return;

                try {
                    // Update trip status to COMPLETED via dedicated endpoint
                    await api.completeTrip(id);
                    showToast('Trip marked as completed!', '#10b981');
                    
                    // Show billing modal for tourist (will prompt payment if unpaid)
                    showBillingModal(trip, async (completedTrip) => {
                        // After payment, refresh view
                        setTimeout(() => {
                            renderTripsView(content);
                        }, 1000);
                    });
                    
                } catch (error) {
                    console.error('Error completing trip:', error);
                    showToast('Failed to complete trip', '#ef4444');
                }
            });
        }

    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading driver data.</div>`;
    }
}

async function renderScheduleView(content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Schedule...</div>`;

    try {
        const res = await api.getBookings();
        const allBookings = await res.json();

        // Filter for upcoming and in-progress trips (include accepted)
        const upcomingTrips = allBookings.filter(b =>
            (b.status === "ASSIGNED" || b.status === "ACCEPTED" || b.status === "IN_PROGRESS") && new Date(b.startDate) > new Date()
        ).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        const activeTrip = allBookings.find(b => b.status === "IN_PROGRESS");

        let scheduleHtml = '';
        if (upcomingTrips.length === 0) {
            scheduleHtml = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: #f9f9f9; border-radius: 8px;">No upcoming trips scheduled.</div>`;
        } else {
            scheduleHtml = upcomingTrips.map((trip, idx) => {
                const date = new Date(trip.startDate);
                const isToday = date.toDateString() === new Date().toDateString();
                const isTomorrow = new Date(date.getTime() + 86400000).toDateString() === new Date().toDateString();
                let dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                if (isToday) dateLabel = `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
                if (isTomorrow) dateLabel = `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

                const isActive = activeTrip && activeTrip.id === trip.id;
                const bgColor = isActive ? '#ecfdf5' : '#f9fafb';
                const borderColor = isActive ? '#10b981' : '#e5e7eb';

                return `
                    <div class="trip-card" data-trip-id="${trip.id}" style="background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <div style="font-size: 0.875rem; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 0.5rem;">
                                    ${isActive ? '🔴 IN PROGRESS' : '📍 ' + dateLabel}
                                </div>
                                <h3 style="margin: 0.5rem 0; color: var(--text-primary); font-size: 1.1rem; font-weight: 600;">
                                    ${trip.pickupLocation} → ${trip.destination || 'TBD'}
                                </h3>
                                <p style="margin: 0.5rem 0; color: var(--text-secondary); font-size: 0.875rem;">
                                    Guests: ${trip.numberOfGuests} | Type: ${trip.bookingType}
                                </p>
                                ${trip.specialRequests ? `<p style="margin: 0.5rem 0; color: #6366f1; font-size: 0.875rem;">📝 ${trip.specialRequests}</p>` : ''}
                                <p style="margin: 0.75rem 0 0; font-size: 0.75rem; color: var(--text-secondary); cursor: help;">👆 Click for full details</p>
                            </div>
                            <div style="text-align: right;">
                                <span class="badge badge-${trip.status.toLowerCase()}">${trip.status}</span>
                                <div style="margin-top: 0.5rem; font-size: 1.25rem; font-weight: bold; color: #f59e0b;">KSH ${trip.price}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        content.innerHTML = `
            <div class="page-header">
                <h2>Trip Schedule</h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Your upcoming and in-progress trips</p>
            </div>

            <div style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                ${scheduleHtml}
            </div>
        `;

        // Attach click listeners to trip cards
        content.querySelectorAll('.trip-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                card.style.transform = 'translateY(-2px)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                card.style.transform = 'translateY(0)';
            });

            card.addEventListener('click', async () => {
                const tripId = card.getAttribute('data-trip-id');
                const trip = allBookings.find(b => b.id === tripId);
                if (trip) {
                    showTripDetailsModal(trip, 'driver');
                }
            });
        });
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading schedule.</div>`;
    }
}

async function renderHistoryView(content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Trip History...</div>`;

    try {
        const res = await api.getBookings();
        const allBookings = await res.json();
        const completedTrips = allBookings.filter(b => b.status === "COMPLETED" && b.paymentStatus === "PAID").sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

        let historyHtml = '';
        if (completedTrips.length === 0) {
            historyHtml = `<tr><td colspan="5" style="text-align:center;">No completed trips yet.</td></tr>`;
        } else {
            historyHtml = completedTrips.map(b => `
                <tr>
                    <td>${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>${b.pickupLocation || '-'}</td>
                    <td>${escapeHTML(b.destination || '-')}</td>
                    <td><strong>KSH ${b.price}</strong></td>
                    <td><span class="badge badge-completed">COMPLETED</span></td>
                </tr>
            `).join('');
        }

        content.innerHTML = `
            <div class="page-header">
                <h2>Trip History</h2>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <h3 style="font-size: 1rem; font-weight: 600;">Completed Trips</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Pickup</th>
                            <th>Destination</th>
                            <th>Earnings</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${historyHtml}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading history.</div>`;
    }
}
