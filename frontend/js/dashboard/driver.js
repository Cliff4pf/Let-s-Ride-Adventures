import api from "../api.js";
import { icons, createNavItem } from "./shared.js";
import { attachLogoutListener } from "./logout-helper.js";
import { initializeProfileModal } from "./profile-modal.js";

let driverState = {
    activeTab: 'trips' // 'trips', 'schedule', 'history'
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
            // Driver profile modal would be implemented here
            alert('Profile modal not yet implemented for drivers');
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
            // Show toast would need to be imported
            alert(`Switched to ${newTheme} mode`);
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

    // Notifications button - show trip notifications
    if (notificationBtn) {
        notificationBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showDriverNotifications();
        });
    }

    // Message button - show trip notifications
    if (messageBtn) {
        messageBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showDriverNotifications();
        });
    }
}

// Show driver notifications (assigned trips)
async function showDriverNotifications() {
    try {
        const bookingsRes = await api.getBookings();
        const bookings = await bookingsRes.json();
        const usersRes = await api.getAllUsers();
        const usersData = await usersRes.json();
        const allUsers = usersData.data || usersData || [];
        
        // Get driver's newly assigned trips (ASSIGNED status = just assigned, not started yet)
        const assignedTrips = bookings.filter(b => b.assignedDriverId && b.status === 'ASSIGNED');

        if (assignedTrips.length === 0) {
            const noNotifModal = document.createElement('div');
            noNotifModal.className = 'modal-overlay';
            noNotifModal.style.display = 'flex';
            noNotifModal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; text-align: center; padding: 2rem;">
                    <h3>No New Assignments</h3>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">You don't have any new trip assignments at the moment.</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;">Close</button>
                </div>
            `;
            document.body.appendChild(noNotifModal);
            noNotifModal.querySelector('button').addEventListener('click', () => noNotifModal.remove());
            noNotifModal.addEventListener('click', e => {
                if (e.target === noNotifModal) noNotifModal.remove();
            });
            return;
        }

        // Create notification modal with contact details and actions
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.style.zIndex = '3000';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 85vh; overflow-y: auto; display: flex; flex-direction: column;">
                <div class="modal-header" style="border-bottom: 2px solid var(--border-color); padding: 1.5rem;">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                        🔔 New Trip Assignments
                        <span style="background: #3b82f6; color: white; font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 999px; font-weight: bold;">${assignedTrips.length}</span>
                    </h3>
                    <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>
                
                <div style="flex: 1; overflow-y: auto; padding: 1rem;">
                    ${assignedTrips.map((b, idx) => {
                        const tourist = allUsers.find(u => u.uid === b.userId);
                        const vehicle = b.vehicleId ? `Vehicle assigned: ${b.vehicleId}` : 'No vehicle info';
                        const startTime = new Date(b.startDate);
                        const timeStr = startTime.toLocaleString();
                        const fareAmount = b.price ? `KSH ${parseInt(b.price).toLocaleString()}` : 'Price TBD';
                        
                        return `
                            <div class="assignment-card" data-booking-id="${b.id}" style="
                                padding: 1.5rem; 
                                border-left: 4px solid #3b82f6;
                                background: var(--surface-hover); 
                                margin-bottom: 1rem; 
                                border-radius: 8px;
                                transition: all 0.3s ease;
                            ">
                                <!-- Trip Overview -->
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                    <div style="flex: 1;">
                                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
                                            📍 ${b.pickupLocation || 'Pickup location'}
                                        </div>
                                        <div style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                            ↓
                                        </div>
                                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">
                                            🎯 ${b.destination || 'Destination'}
                                        </div>
                                    </div>
                                    <span class="badge" style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem;">ASSIGNED</span>
                                </div>

                                <!-- Trip Details Grid -->
                                <div style="background: white; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                        <div>
                                            <p style="margin: 0 0 0.25rem; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Scheduled Time</p>
                                            <p style="margin: 0; font-size: 0.95rem; color: var(--text-primary); font-weight: 600;">🕐 ${timeStr}</p>
                                        </div>
                                        <div>
                                            <p style="margin: 0 0 0.25rem; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Trip Fare</p>
                                            <p style="margin: 0; font-size: 0.95rem; color: #10b981; font-weight: 600;">💰 ${fareAmount}</p>
                                        </div>
                                        <div>
                                            <p style="margin: 0 0 0.25rem; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Passengers</p>
                                            <p style="margin: 0; font-size: 0.95rem; color: var(--text-primary); font-weight: 600;">👥 ${b.numberOfGuests || 1} guest(s)</p>
                                        </div>
                                        <div>
                                            <p style="margin: 0 0 0.25rem; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Vehicle Type</p>
                                            <p style="margin: 0; font-size: 0.95rem; color: var(--text-primary); font-weight: 600;">🚗 ${b.vehicleType || 'Transfer'}</p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Tourist Contact Info -->
                                <div style="background: var(--surface-color); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                                    <h4 style="margin: 0 0 0.75rem; color: var(--text-primary); font-size: 0.9rem; font-weight: 600;">👤 Tourist Details</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.875rem;">
                                        <div>
                                            <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.75rem;">Name</p>
                                            <p style="margin: 0; font-weight: 600; color: var(--text-primary);">${tourist?.fullName || 'Unknown'}</p>
                                        </div>
                                        <div>
                                            <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.75rem;">Phone</p>
                                            <p style="margin: 0; font-weight: 600; color: var(--text-primary);"><a href="tel:${tourist?.phoneNumber}" style="color: #3b82f6; text-decoration: none;">${tourist?.phoneNumber || 'N/A'}</a></p>
                                        </div>
                                        <div style="grid-column: 1 / -1;">
                                            <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.75rem;">Email</p>
                                            <p style="margin: 0; font-weight: 600; color: var(--text-primary);"><a href="mailto:${tourist?.email}" style="color: #3b82f6; text-decoration: none;">${tourist?.email || 'N/A'}</a></p>
                                        </div>
                                        ${b.specialRequests ? `
                                            <div style="grid-column: 1 / -1;">
                                                <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.75rem;">Special Requests</p>
                                                <p style="margin: 0; font-weight: 600; color: var(--text-primary);">💬 ${b.specialRequests}</p>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div style="display: flex; gap: 0.75rem;">
                                    <button class="btn-accept-trip" data-booking-id="${b.id}" style="
                                        flex: 1; 
                                        padding: 0.75rem; 
                                        background: #10b981; 
                                        color: white; 
                                        border: none; 
                                        border-radius: 6px; 
                                        font-weight: 600;
                                        cursor: pointer;
                                        transition: background 0.2s;
                                    ">
                                        ✓ Accept Trip
                                    </button>
                                    <button class="btn-decline-trip" data-booking-id="${b.id}" style="
                                        flex: 1; 
                                        padding: 0.75rem; 
                                        background: #ef4444; 
                                        color: white; 
                                        border: none; 
                                        border-radius: 6px; 
                                        font-weight: 600;
                                        cursor: pointer;
                                        transition: background 0.2s;
                                    ">
                                        ✗ Decline
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Close button
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 300);
            });
        }
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 300);
            }
        });

        // Accept trip handlers
        modal.querySelectorAll('.btn-accept-trip').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = btn.getAttribute('data-booking-id');
                btn.disabled = true;
                btn.textContent = '⟳ Processing...';
                
                try {
                    await api.updateBookingStatus(bookingId, 'IN_PROGRESS');
                    btn.textContent = '✓ Accepted';
                    btn.style.background = '#059669';
                    
                    setTimeout(() => {
                        modal.remove();
                        alert('Trip accepted! You may now begin the journey.');
                        // Refresh trips view
                        const content = document.querySelector('.main-content');
                        if (content) {
                            renderTripsView(content);
                        }
                    }, 500);
                } catch (error) {
                    console.error('Failed to accept trip:', error);
                    btn.disabled = false;
                    btn.textContent = '✓ Accept Trip';
                    alert('Failed to accept trip. Please try again.');
                }
            });
        });

        // Decline trip handlers
        modal.querySelectorAll('.btn-decline-trip').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = btn.getAttribute('data-booking-id');
                
                if (!confirm('Are you sure you want to decline this trip?')) {
                    return;
                }
                
                btn.disabled = true;
                btn.textContent = '⟳ Processing...';
                
                try {
                    // Set status back to APPROVED so admin can reassign
                    await api.updateBookingStatus(bookingId, 'APPROVED');
                    btn.textContent = '✗ Declined';
                    btn.style.background = '#991b1b';
                    
                    setTimeout(() => {
                        modal.remove();
                        alert('Trip declined. It will be available for other drivers.');
                        // Refresh trips view
                        const content = document.querySelector('.main-content');
                        if (content) {
                            renderTripsView(content);
                        }
                    }, 500);
                } catch (error) {
                    console.error('Failed to decline trip:', error);
                    btn.disabled = false;
                    btn.textContent = '✗ Decline';
                    alert('Failed to decline trip. Please try again.');
                }
            });
        });

        // Fade in modal
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);

    } catch (error) {
        console.error('Failed to load notifications:', error);
        alert('Failed to load notifications');
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
    setupMenuBarEvents();

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

        const activeTrip = myBookings.find(b => b.status === "ASSIGNED" || b.status === "IN_PROGRESS");

        let activeHtml = '';
        if (!activeTrip) {
            activeHtml = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: #f9f9f9; border-radius: 8px;">No active assignments. Grab a coffee!</div>`;
        } else {
            activeHtml = `
            <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Current Mission: ${activeTrip.destination || 'City Transfer'}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">Scheduled: ${new Date(activeTrip.startDate).toLocaleString()}</p>
                    <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;"><span class="badge badge-${activeTrip.status.toLowerCase()}">${activeTrip.status}</span></p>
                </div>
                <div>
                    ${activeTrip.status === 'ASSIGNED' ?
                    `<button class="btn btn-primary start-trip-btn" data-id="${activeTrip.id}">Start Trip</button>` :
                    `<button class="btn btn-primary finish-trip-btn" data-id="${activeTrip.id}" style="background: #10b981; border-color: #10b981;">Complete Trip</button>`
                }
                </div>
            </div>
            `;
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
                    await api.updateBookingStatus(id, "IN_PROGRESS");
                    renderTripsView(content);
                }
            });
        }

        const finishBtn = content.querySelector('.finish-trip-btn');
        if (finishBtn) {
            finishBtn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('Mark this trip as completed?')) {
                    await api.updateBookingStatus(id, "COMPLETED");
                    renderTripsView(content);
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

        // Filter for upcoming and in-progress trips
        const upcomingTrips = allBookings.filter(b =>
            (b.status === "ASSIGNED" || b.status === "IN_PROGRESS") && new Date(b.startDate) > new Date()
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
                    <div style="background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem;">
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
        const completedTrips = allBookings.filter(b => b.status === "COMPLETED").sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

        let historyHtml = '';
        if (completedTrips.length === 0) {
            historyHtml = `<tr><td colspan="5" style="text-align:center;">No completed trips yet.</td></tr>`;
        } else {
            historyHtml = completedTrips.map(b => `
                <tr>
                    <td>${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>${b.pickupLocation || '-'}</td>
                    <td>${b.destination || '-'}</td>
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
