import api from "../api.js";
import { icons, createNavItem, showToast } from "./shared.js";
import { attachLogoutListener, handleLogout } from "./logout-helper.js";
import { initializeProfileModal, openProfileModal } from "./profile-modal.js";
import { showPaymentAndRatingModal } from "./payment-confirmation-modal.js";
import { showTripDetailsModal, ensureGetUserAPI } from "./trip-details-modal.js";
import { showBillingModal } from "./billing-modal.js";

// Ensure API has getUser method
ensureGetUserAPI();

// Helper functions
function getVehicleIcon(vehicleType) {
    const vehicleIcons = {
        'sedan': icons.sedan,
        'suv': icons.suv,
        'van': icons.van,
        'bike': icons.bike
    };
    return vehicleIcons[vehicleType] || icons.car;
}

function getStatusIcon(status) {
    // Using emoji icons (guaranteed to work) with Font Awesome fallback
    const statusIcons = {
        'PENDING': '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;">⏳</span>',
        'APPROVED': '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: #10b981;">✅</span>',
        'ASSIGNED': '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;">🚗</span>',
        'COMPLETED': '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: #10b981;">✓</span>',
        'CANCELLED': '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: #ef4444;">✕</span>'
    };
    return statusIcons[status] || '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;">?</span>';
}

// Calculate user rating based on cancellation history
function calculateUserRating(bookings) {
    if (!bookings || bookings.length === 0) return 5.0;
    const totalBookings = bookings.length;
    const cancelledCount = bookings.filter(b => b.status === 'CANCELLED').length;
    const cancellationRate = cancelledCount / totalBookings;
    
    // Rating formula: Start at 5.0, deduct 0.5 for each cancellation
    // Minimum rating: 1.0
    const rating = Math.max(1.0, 5.0 - (cancelledCount * 0.5));
    return Math.round(rating * 10) / 10; // Round to 1 decimal place
}

// polling helper used by dashboard to alert tourists when payment is due
let dashboardPollInterval = null;

function startDashboardPolling(sidebar, content) {
    if (dashboardPollInterval) clearInterval(dashboardPollInterval);
    // poll every 2 seconds for near-instant detection when driver completes trip
    dashboardPollInterval = setInterval(async () => {
        try {
            const res = await api.getBookings();
            if (!res.ok) return;
            const bookings = await res.json();
            const unpaid = bookings.find(b => b.status === 'COMPLETED' && b.paymentStatus !== 'PAID');
            if (unpaid) {
                showBillingModal(unpaid, async () => {
                    renderTouristUI(sidebar, content, 'dashboard');
                });
            }
        } catch (err) {
            console.warn('Dashboard polling failed', err);
        }
    }, 2000); // every 2 seconds for speedy detection
}

// Show feedback prompt modal for completed trips
async function showFeedbackPrompt(booking) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid var(--border-color);">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 0.75rem;">
                    ✅ Booking Confirmed
                </h3>
                <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">×</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <p style="margin-top: 0; color: var(--text-secondary);">Your trip to <strong>${booking.destination}</strong> has been successfully booked!</p>
                
                <div style="display: flex; gap: 0.75rem; margin-top: 2rem;">
                    <button type="button" id="submitFeedbackBtn" class="btn btn-primary" style="flex: 1;">Done</button>
                </div>
            </div>
        </div>
    `;    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.modal-close-btn');
    const submitBtn = modal.querySelector('#submitFeedbackBtn');
    
    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    };
    
    closeBtn.addEventListener('click', closeModal);
    submitBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
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

    // Logout button in settings is wired automatically via logout-helper

    // Notifications button - show booking status updates
    if (notificationBtn) {
        notificationBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showNotificationsModal();
        });
    }

    // Message button - show same as notifications
    if (messageBtn) {
        messageBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showNotificationsModal();
        });
    }
}

// Show notifications modal with booking status updates
async function showNotificationsModal() {
    try {
        // fetch any system notifications stored in backend
        let customNotifs = [];
        try {
            const nres = await api.getNotifications();
            if (nres && nres.ok) {
                const ndata = await nres.json();
                customNotifs = ndata.data || [];
            }
        } catch (e) {
            console.warn('Unable to load custom notifications', e);
            // don't fail silently - just skip custom notifications
        }

        const res = await api.getBookings();
        if (!res.ok) {
            console.error('Failed to fetch bookings');
            return;
        }
        const bookings = await res.json();
        
        // Filter notifications - primarily completed or upcoming bookings with important updates
        const bookingNotifs = bookings
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
            .map(b => {
                let notifIcon = '';
                let notifMessage = '';
                let notifColor = '';

                if (b.status === 'COMPLETED') {
                    if (b.paymentStatus !== 'PAID') {
                        notifIcon = '💳';
                        notifMessage = `Trip to ${b.destination} completed. Please clear payment of KSH ${b.price || 0}.`;
                        notifColor = '#10b981';
                    } else {
                        notifIcon = '✅';
                        notifMessage = `Trip to ${b.destination} completed successfully!`;
                        notifColor = '#10b981';
                    }
                } else if (b.status === 'ASSIGNED') { 
                    notifIcon = '🚗';
                    notifMessage = `Driver assigned for ${b.destination}. Check vehicle details.`;
                    notifColor = '#3b82f6';
                } else if (b.status === 'APPROVED') {
                    notifIcon = '✓';
                    notifMessage = `Booking approved for ${b.destination} on ${new Date(b.startDate).toLocaleDateString()}`;
                    notifColor = '#10b981';
                } else if (b.status === 'PENDING') {
                    notifIcon = '⏳';
                    notifMessage = `Booking pending for ${b.destination}. Awaiting approval.`;
                    notifColor = '#f59e0b';
                }

                return { icon: notifIcon, message: notifMessage, color: notifColor, booking: b };
            });

        // convert backend notifications to same shape
        const extraNotifs = customNotifs.map(n => ({
            icon: '🔔',
            message: n.Message || n.message || '',
            color: '#3b82f6',
            booking: null,
            timestamp: n.CreatedAt
        }));

        const notifications = [...extraNotifs, ...bookingNotifs];

        const notificationHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 5000;">
                <div style="background: white; border-radius: 12px; max-width: 500px; width: 90%; max-height: 70vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
                    <!-- Header -->
                    <div style="padding: 2rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">🔔</span>
                            <h2 style="margin: 0; color: var(--text-primary);">Booking Notifications</h2>
                        </div>
                        <button class="close-notif-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
                    </div>

                    <!-- Notifications List -->
                    <div style="padding: 1.5rem;">
                        ${notifications.length === 0 ? `
                            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                                <div style="font-size: 2.5rem; opacity: 0.5; display: block; margin-bottom: 1rem;">📭</div>
                                <p style="margin: 0;">No notifications yet.</p>
                            </div>
                        ` : `
                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                ${notifications.map(notif => `
                                    <div class="notif-item" data-booking-id="${notif.booking ? notif.booking.id : ''}" style="cursor: pointer; display: flex; gap: 1rem; padding: 1rem; background: var(--surface-hover); border-radius: 8px; border-left: 4px solid ${notif.color};">
                                        <div style="flex-shrink: 0;">${notif.icon}</div>
                                        <div style="flex: 1;">
                                            <p style="margin: 0; color: var(--text-primary); font-weight: 500;">${notif.message}</p>
                                            ${notif.booking ? `
                                            <p style="margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                                                ${new Date(notif.booking.startDate).toLocaleDateString()} at ${new Date(notif.booking.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                            ${notif.booking.status === 'ASSIGNED' && notif.booking.driverId ? `
                                                <div style="margin-top: 0.75rem; padding: 0.75rem; background: white; border-radius: 6px; border: 1px solid var(--border-color);">
                                                    <p style="margin: 0 0 0.5rem; font-size: 0.875rem; color: var(--text-secondary); font-weight: 500;">Driver Contact Details</p>
                                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.875rem;">
                                                        <div>
                                                            <span style="color: var(--text-secondary);">Name:</span>
                                                            <span style="font-weight: 600; color: var(--text-primary);">${notif.booking.driverName || 'Loading...'}</span>
                                                        </div>
                                                        <div>
                                                            <span style="color: var(--text-secondary);">Phone:</span>
                                                            <span style="font-weight: 600; color: var(--text-primary);">${notif.booking.driverPhone || 'Loading...'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : ''}
                                            ${notif.booking.status === 'COMPLETED' && notif.booking.paymentStatus !== 'PAID' ? `
                                                <button class="btn btn-primary pay-now-btn" data-id="${notif.booking.id}" style="margin-top:0.75rem;">
                                                    💰 Clear Payment
                                                </button>
                                            ` : ''}
                                            ` : `
                                            <p style="margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 0.75rem;">
                                                ${notif.timestamp ? new Date(notif.timestamp).toLocaleString() : ''}
                                            </p>
                                            `}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        const notifContainer = document.createElement('div');
        notifContainer.innerHTML = notificationHTML;
        document.body.appendChild(notifContainer);

        const closeBtn = notifContainer.querySelector('.close-notif-modal');
        const modal = notifContainer.querySelector('[style*="position: fixed"]');

        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => notifContainer.remove(), 300);
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Payment buttons inside notifications
        notifContainer.querySelectorAll('.pay-now-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = btn.getAttribute('data-id');
                try {
                    await api.updatePaymentStatus(bookingId, 'PAID');
                    showToast('Payment cleared. Thank you!', '#10b981');
                    closeModal();
                    const sidebar = document.getElementById('sidebarMenu');
                    const content = document.getElementById('dashboardContent');
                    if (sidebar && content) renderTouristUI(sidebar, content);
                } catch (err) {
                    console.error('Payment update failed', err);
                    showToast('Failed to clear payment', '#ef4444');
                }
            });
        });

        // Make notifications clickable
        notifContainer.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', () => {
                const bookingId = item.getAttribute('data-booking-id');
                if (bookingId) {
                    const notif = notifications.find(n => n.booking && n.booking.id === bookingId);
                    if (notif && notif.booking) {
                        showTripDetailsModal(notif.booking, 'tourist');
                        closeModal();
                    }
                }
            });
        });

        // Update notification badge count
        const notificationBadge = document.getElementById('notificationBadge');
        if (notificationBadge) {
            const importantCount = notifications.filter(n => n.booking.status !== 'COMPLETED' || n.booking.paymentStatus !== 'PAID').length;
            notificationBadge.textContent = importantCount;
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('Failed to load notifications', '#ef4444');
    }
}

export async function renderTouristUI(sidebar, content, section = 'dashboard') {
    // clear any existing polling when navigating between sections
    if (dashboardPollInterval) {
        clearInterval(dashboardPollInterval);
        dashboardPollInterval = null;
    }

    sidebar.innerHTML = `
        ${createNavItem('Dashboard', icons.dashboard, 'dashboard', section === 'dashboard')}
        ${createNavItem('Book a Ride', icons.book, 'bookings', section === 'bookings')}
        ${createNavItem('Explore Kenya', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', 'discover', section === 'discover')}
        ${createNavItem('Ratings & Reviews', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 10.26 23.77 11.46 17.88 17.01 19.54 25.63 12 21.35 4.46 25.63 6.12 17.01 0.23 11.46 8.91 10.26 12 2"/></svg>', 'feedback', section === 'feedback')}
        ${createNavItem('Logout', icons.logout, null, false, true)}
    `;

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

            if (targetSection === 'discover') {
                renderTouristUI(sidebar, content, 'discover');
            }

            if (targetSection === 'feedback') {
                renderTouristUI(sidebar, content, 'feedback');
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

    if (section === 'dashboard') {
        await renderTouristDashboardView(sidebar, content);
    } else if (section === 'bookings') {
        await renderTouristBookingsView(sidebar, content);
    } else if (section === 'discover') {
        await renderTouristDiscoverView(sidebar, content);
    } else if (section === 'feedback') {
        await renderTouristFeedbackView(sidebar, content);
    }
}

async function renderTouristDashboardView(sidebar, content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Tourist Dashboard...</div>`;

    try {
        // Fetch profile data
        const token = localStorage.getItem('ridehub_token');
        const profileRes = await fetch('http://localhost:5202/api/User/me', {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        const profileData = await profileRes.json();
        const profile = profileData.data || {};

        const res = await api.getBookings();
        const bookings = await res.json();
        showToast('Bookings loaded', '#4f46e5');

        // if there is a completed trip that hasn't been paid yet, prompt immediately
        const unpaidCompleted = bookings.find(b => b.status === 'COMPLETED' && b.paymentStatus !== 'PAID');
        if (unpaidCompleted) {
            // show the billing modal for payment
            showBillingModal(unpaidCompleted, async () => {
                // after payment we re-render dashboard
                renderTouristUI(sidebar, content, 'dashboard');
            });
        }

        // start polling for new unpaid completed trips while dashboard is open
        startDashboardPolling(sidebar, content);

        const pendingCount = bookings.filter(b => b.status === "PENDING" || b.status === "APPROVED").length;
        // Only count trips that are both completed and paid (or cancelled entries for history)
        const historyCount = bookings.filter(b => (b.status === "COMPLETED" && b.paymentStatus === "PAID") || b.status === "CANCELLED").length;
        const completed = bookings.filter(b => b.status === "COMPLETED" && b.paymentStatus === "PAID").length;
        const totalTrips = bookings.length;
        const uniquePlaces = new Set(bookings.filter(b => b.status === "COMPLETED").map(b => b.destination).filter(d => d)).size;
        const userRating = calculateUserRating(bookings);

        // promotional content shown below bookings table; uses static images for now
        const promoSectionHtml = `
            <div class="promo-section animate-fade-in-up">
                <h3 style="text-align:center; font-size:1.5rem; margin-bottom:1rem;">Explore Popular Tours</h3>
                <div class="promo-grid">
                    <div class="promo-card" data-action="bookings">
                        <img src="https://letsadventureafrica.com/wp-content/uploads/elementor/thumbs/4-Days-Serengeti-Ngorongoro-crater-safari--qish1y3zmmvmknh6kqd95rndjs6u2r9mmd4veedvp4.jpg" alt="Serengeti Safari">
                        <div class="promo-content">
                            <div class="promo-title">Serengeti Safari</div>
                            <div class="promo-link">Book a Ride</div>
                        </div>
                    </div>
                    <div class="promo-card" data-action="bookings">
                        <img src="https://letsadventureafrica.com/wp-content/uploads/elementor/thumbs/Giraffe-Center-Gallery-pnlt1gb647p4tqvovg8c6ksn5njyvsi6jwhs9spov8.jpg" alt="Giraffe Center">
                        <div class="promo-content">
                            <div class="promo-title">Giraffe Center Tour</div>
                            <div class="promo-link">Book a Ride</div>
                        </div>
                    </div>
                    <div class="promo-card" data-action="bookings">
                        <img src="https://letsadventureafrica.com/wp-content/uploads/elementor/thumbs/Hells-Gate-Lake-Naivasha-pnvzb24nxzq9zh9s0mbrskeyn5lbgmj4xw1il7kw5w.jpg" alt="Hells Gate & Lake Naivasha">
                        <div class="promo-content">
                            <div class="promo-title">Hells Gate & Lake Naivasha</div>
                            <div class="promo-link">Book a Ride</div>
                        </div>
                    </div>
                    <div class="promo-card" data-action="bookings">
                        <img src="https://letsadventureafrica.com/wp-content/uploads/elementor/thumbs/Nairobi-City-Tour-pnrya7kkb2czd8e4c6zfzcdklq0jy29nzp6pdqou58.jpg" alt="Nairobi City Tour">
                        <div class="promo-content">
                            <div class="promo-title">Nairobi City Tour</div>
                            <div class="promo-link">Book a Ride</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        let tableHtml = '';
        if (bookings.length === 0) {
            tableHtml = `<tr><td colspan="5" style="text-align:center;">No bookings found.</td></tr>`;
        } else {
            tableHtml = bookings.map(b => `
                <tr class="booking-row" data-booking-id="${b.id}" style="cursor: pointer; transition: background-color 0.2s ease;">
                    <td>${new Date(b.startDate).toLocaleDateString()}</td>
                    <td>${b.destination || '-'}</td>
                    <td>${b.bookingType}</td>
                    <td><span class="badge badge-${b.status.toLowerCase()}">${b.status}</span></td>
                    <td>
                        ${(b.status === 'PENDING' || b.status === 'APPROVED')
                    ? `<button class="btn btn-secondary cancel-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Cancel</button>`
                    : `<span style="font-size: 0.75rem; color: #aaa;">Locked</span>`}
                    </td>
                </tr>
            `).join('');
        }

        content.innerHTML = `
            <!-- Welcome Hero Section -->
            <div class="card-modern animate-fade-in-up" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; margin-bottom: 2rem; border: none;">
                <div style="padding: 2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem;">Welcome back, ${(profile.fullName || 'Traveler').split(' ')[0]}! 👋</h1>
                            <p style="opacity: 0.9; font-size: 1.125rem; margin: 0;">Ready for your next adventure? Let's find the perfect ride for you.</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 2.5rem; font-weight: 700; color: white;">${totalTrips}</div>
                            <div style="font-size: 0.875rem; opacity: 0.8;">Total Trips</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Stats Grid -->
            <div class="metrics-grid animate-fade-in-up">
                <div class="metric-card" style="background: linear-gradient(135deg, var(--success), #10b981); color: white; border: none;">
                    <div class="metric-icon" style="background: rgba(255,255,255,0.2);">
                        ${icons.check}
                    </div>
                    <div class="metric-info">
                        <h3 style="color: rgba(255,255,255,0.9);">Completed Trips</h3>
                        <div class="value" style="color: white;">${completed}</div>
                    </div>
                </div>
                <div class="metric-card" style="background: linear-gradient(135deg, var(--warning), #f59e0b); color: white; border: none;">
                    <div class="metric-icon" style="background: rgba(255,255,255,0.2);">
                        ${icons.clock}
                    </div>
                    <div class="metric-info">
                        <h3 style="color: rgba(255,255,255,0.9);">Upcoming</h3>
                        <div class="value" style="color: white;">${pendingCount}</div>
                    </div>
                </div>
                <div class="metric-card" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border: none;">
                    <div class="metric-icon" style="background: rgba(255,255,255,0.2);">
                        ${icons.star}
                    </div>
                    <div class="metric-info">
                        <h3 style="color: rgba(255,255,255,0.9);">Your Rating</h3>
                        <div class="value" style="color: white;">${userRating} ⭐</div>
                    </div>
                </div>
                <div class="metric-card" style="background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white; border: none;">
                    <div class="metric-icon" style="background: rgba(255,255,255,0.2);">
                        ${icons.location}
                    </div>
                    <div class="metric-info">
                        <h3 style="color: rgba(255,255,255,0.9);">Places Visited</h3>
                        <div class="value" style="color: white;">${uniquePlaces}</div>
                    </div>
                </div>
            </div>

            <!-- Recent Bookings -->
            <div class="card-modern animate-fade-in-up" style="margin-top: 3rem;">
                <div class="table-header" style="border-bottom: 1px solid var(--border-color); padding: 1.5rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 2rem; flex-wrap: wrap;">
                        <div>
                            <h3 style="font-size: 1.25rem; font-weight: 600; margin: 0; color: var(--text-primary);">${icons.book} Recent Bookings</h3>
                            <p style="margin: 0.25rem 0 0; color: var(--text-secondary); font-size: 0.875rem;">Your latest ride reservations</p>
                        </div>
                        <button class="btn-modern btn-primary-modern" id="newBookingBtn" style="font-size: 0.875rem; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; letter-spacing: 0.3px; white-space: nowrap;">
                            ${icons.plus} New Booking
                        </button>
                    </div>
                </div>
                <div style="padding: 0;">
                    ${bookings.length === 0 ? `
                        <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-secondary);">
                            <h4 style="margin-bottom: 0.5rem; color: var(--text-primary);">No bookings yet</h4>
                            <p style="margin-bottom: 1.5rem;">Start your journey by booking your first ride</p>
                            <button class="btn-modern btn-primary-modern" id="newBookingBtnEmpty">
                                ${icons.plus} Book Your First Ride
                            </button>
                        </div>
                    ` : `
                        <div class="table-container" style="border: none; box-shadow: none; margin: 0;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th style="padding-left: 1.5rem;">${icons.calendar} Date</th>
                                        <th>${icons.location} Destination</th>
                                        <th>${icons.car} Vehicle</th>
                                        <th style="text-align: center;">Status</th>
                                        <th style="padding-right: 1.5rem; text-align: center;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${bookings.slice(0, 5).map(b => `
                                        <tr>
                                            <td style="padding-left: 1.5rem;">
                                                <div style="font-weight: 600; color: var(--text-primary);">${new Date(b.startDate).toLocaleDateString()}</div>
                                                <div style="font-size: 0.75rem; color: var(--text-secondary);">${new Date(b.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 500; color: var(--text-primary);">${b.destination || 'Custom Location'}</div>
                                            </td>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">${getVehicleIcon(b.bookingType)}</span>
                                                    <span style="text-transform: capitalize; font-weight: 500;">${b.bookingType}</span>
                                                </div>
                                            </td>
                                            <td style="text-align: center;">
                                                <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                                                    ${getStatusIcon(b.status)}
                                                    <span class="badge badge-${b.status.toLowerCase()}" style="font-size: 0.75rem; padding: 0.25rem 0.625rem; white-space: nowrap;">
                                                        ${b.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style="padding-right: 1.5rem; text-align: center;">
                                                ${(b.status === 'PENDING' || b.status === 'APPROVED')
                                                ? `<button class="btn-modern btn-secondary-modern cancel-btn" data-id="${b.id}" style="font-size: 0.75rem; padding: 0.4rem 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;" title="Cancel Booking">
                                                    🗑️ Cancel
                                                  </button>`
                                                : b.status === 'COMPLETED' ?
                                                `<button class="btn-modern btn-primary-modern" data-id="${b.id}" style="font-size: 0.75rem; padding: 0.4rem 0.75rem; cursor: pointer; background: #10b981; border: none; display: flex; align-items: center; gap: 0.4rem;" title="Leave Feedback">
                                                    ⭐ Feedback
                                                 </button>`
                                                : `<span style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; justify-content: center;">🔒 Locked</span>`}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        // insert promotional section below dashboard regardless of booking count
        const promoContainer = document.createElement('div');
        promoContainer.innerHTML = promoSectionHtml;
        content.appendChild(promoContainer);

        content.querySelectorAll('.booking-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('cancel-btn')) return; // Don't trigger modal on cancel button
                const bookingId = row.getAttribute('data-booking-id');
                const booking = bookings.find(b => b.id === bookingId);
                if (booking) {
                    showTripDetailsModal(booking, 'tourist');
                }
            });

            // Hover effects for better UX
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = 'var(--surface-hover)';
            });
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = 'transparent';
            });
        });

        content.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.target.getAttribute('data-id');
                if (confirm("Are you sure you want to cancel this booking?")) {
                    try {
                        const response = await api.cancelBooking(id);
                        if (response.ok || response.status === 200) {
                            showToast('Booking cancelled successfully.', '#10b981');
                            renderTouristUI(sidebar, content, 'dashboard');
                        } else {
                            showToast('Failed to cancel booking', '#ef4444');
                        }
                    } catch (err) {
                        console.error('Error cancelling booking:', err);
                        showToast('Failed to cancel booking', '#ef4444');
                    }
                }
            });
        });

        // payment buttons for clearing amount
        content.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const bookingId = btn.getAttribute('data-id');
                if (!bookingId) return;
                try {
                    await api.updatePaymentStatus(bookingId, 'PAID');
                    showToast('Payment cleared. Thank you!', '#10b981');
                    const booking = bookings.find(b => b.id === bookingId);
                    if (booking) {
                        showFeedbackPrompt(booking);
                    }
                    renderTouristUI(sidebar, content, 'dashboard');
                } catch (err) {
                    console.error('Error updating payment status:', err);
                    showToast('Failed to clear payment', '#ef4444');
                }
            });
        });

        // helper to cleanup any existing polling when leaving dashboard
        if (window.dashboardPollInterval) {
            clearInterval(window.dashboardPollInterval);
            window.dashboardPollInterval = null;
        }

        // feedback buttons on paid completed bookings
        content.querySelectorAll('.feedback-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const bookingId = btn.getAttribute('data-id');
                const booking = bookings.find(b => b.id === bookingId);
                if (booking) {
                    showFeedbackPrompt(booking);
                }
            });
        });

        const newBookingBtn = document.getElementById('newBookingBtn');
        const newBookingBtnEmpty = document.getElementById('newBookingBtnEmpty');
        [newBookingBtn, newBookingBtnEmpty].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    renderTouristUI(sidebar, content, 'bookings');
                });
            }
        });

        // promo cards should also redirect to booking section when clicked
        content.querySelectorAll('.promo-card').forEach(card => {
            card.addEventListener('click', () => {
                renderTouristUI(sidebar, content, 'bookings');
            });
        });
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading dashboard data.</div>`;
    }
}

async function renderTouristBookingsView(sidebar, content) {
    try {
        // Get booking stats
        const res = await api.getBookings();
        const bookings = await res.json();
        const totalTrips = bookings.length;
        const upcoming = bookings.filter(b => b.status === "PENDING" || b.status === "APPROVED").length;
        const completed = bookings.filter(b => b.status === "COMPLETED").length;

        // fetch available vehicles to show categories
        let vehicleSummary = { sedan: 0, suv: 0, van: 0, bike: 0 };
        try {
            const vres = await api.getVehicles();
            if (vres.ok) {
                const vehicles = await vres.json();
                vehicles.forEach(v => {
                    if (v.vehicleType && vehicleSummary.hasOwnProperty(v.vehicleType.toLowerCase())) {
                        if (v.isAvailable) vehicleSummary[v.vehicleType.toLowerCase()]++;
                    }
                });
            }
        } catch { };

        content.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div>
                <h2 style="margin: 0; color: var(--text-primary);">${icons.book} Book Your Ride</h2>
                <p style="margin: 0.5rem 0 0; color: var(--text-secondary);">Choose your destination and vehicle type</p>
            </div>
        </div>

        <!-- Stats Bar -->
        <div class="stats-bar animate-fade-in-up" style="margin-bottom: 2rem;">
            <div class="stat-item">
                <div class="stat-value" style="color: var(--success);">${totalTrips}</div>
                <div class="stat-label">Total Trips</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: var(--primary-color);">${upcoming}</div>
                <div class="stat-label">Upcoming</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: var(--warning);">${completed}</div>
                <div class="stat-label">Completed</div>
            </div>
        </div>

        <!-- Vehicle Availability -->
        <div class="stats-bar animate-fade-in-up" style="margin-bottom: 2rem; background: var(--surface-color); border: 1px solid var(--border-color);">
            <div class="stat-item">
                <div class="stat-value" style="color: ${vehicleSummary.sedan > 0 ? 'var(--success)' : 'var(--danger)'};">${vehicleSummary.sedan}</div>
                <div class="stat-label">${icons.sedan} Sedans</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: ${vehicleSummary.suv > 0 ? 'var(--success)' : 'var(--danger)'};">${vehicleSummary.suv}</div>
                <div class="stat-label">${icons.suv} SUVs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: ${vehicleSummary.van > 0 ? 'var(--success)' : 'var(--danger)'};">${vehicleSummary.van}</div>
                <div class="stat-label">${icons.van} Vans</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: ${vehicleSummary.bike > 0 ? 'var(--success)' : 'var(--danger)'};">${vehicleSummary.bike}</div>
                <div class="stat-label">${icons.bike} Bikes</div>
            </div>
        </div>

        <!-- Popular Destinations Section -->
        <div class="destinations-section animate-fade-in-up">
            <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; color: var(--text-primary);">🌍 Popular Destinations</h3>
            <div class="destinations-grid">
                <div class="destination-card" data-destination="nairobi-national-park">
                    <img src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=300&fit=crop" alt="Nairobi National Park" class="destination-card-image">
                    <div class="destination-card-content">
                        <div>
                            <div class="destination-card-title">🦁 Nairobi National Park</div>
                            <div class="destination-card-desc">See lions, giraffes & zebras with the skyline backdrop</div>
                        </div>
                        <button class="destination-card-select">Select</button>
                    </div>
                </div>

                <div class="destination-card" data-destination="lake-naivasha">
                    <img src="https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=300&fit=crop" alt="Lake Naivasha" class="destination-card-image">
                    <div class="destination-card-content">
                        <div>
                            <div class="destination-card-title">🌊 Lake Naivasha</div>
                            <div class="destination-card-desc">Scenic lake ideal for water sports & relaxation</div>
                        </div>
                        <button class="destination-card-select">Select</button>
                    </div>
                </div>

                <div class="destination-card" data-destination="maasai-mara">
                    <img src="https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&h=300&fit=crop" alt="Masai Mara" class="destination-card-image">
                    <div class="destination-card-content">
                        <div>
                            <div class="destination-card-title">🦁 Masai Mara</div>
                            <div class="destination-card-desc">World-renowned safari destination with Big Five</div>
                        </div>
                        <button class="destination-card-select">Select</button>
                    </div>
                </div>

                <div class="destination-card" data-destination="mount-kenya">
                    <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop" alt="Mount Kenya" class="destination-card-image">
                    <div class="destination-card-content">
                        <div>
                            <div class="destination-card-title">⛰️ Mount Kenya</div>
                            <div class="destination-card-desc">Africa's second highest peak ideal for trekking</div>
                        </div>
                        <button class="destination-card-select">Select</button>
                    </div>
                </div>

                <div class="destination-card" data-destination="mombasa-beach">
                    <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop" alt="Mombasa Beach" class="destination-card-image">
                    <div class="destination-card-content">
                        <div>
                            <div class="destination-card-title">🏖️ Mombasa Beach</div>
                            <div class="destination-card-desc">Sun, sand & sea with historical Swahili culture</div>
                        </div>
                        <button class="destination-card-select">Select</button>
                    </div>
                </div>

                <div class="destination-card" data-destination="hells-gate">
                    <img src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop" alt="Hell's Gate" class="destination-card-image">
                    <div class="destination-card-content">
                        <div>
                            <div class="destination-card-title">🔥 Hell's Gate N.P.</div>
                            <div class="destination-card-desc">Dramatic gorge with geothermal springs & hiking</div>
                        </div>
                        <button class="destination-card-select">Select</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Booking Container -->
        <div class="booking-container animate-fade-in-up">
            <!-- Form Section -->
            <div class="booking-form-section">
                <div class="card-modern">
                    <div style="padding: 2rem;">
                        <h3 style="text-align: center; margin-bottom: 2rem; color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">
                            ${icons.map} Create New Booking
                        </h3>

                        <form id="bookingForm">
                            <div class="form-grid">
                                <div class="form-group-modern">
                                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${icons.location} Pickup Location
                                    </label>
                                    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
                                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; cursor: pointer;">
                                            <input type="radio" name="pickupType" value="airport" checked style="margin: 0;">
                                            ✈️ JKIA Airport
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; cursor: pointer;">
                                            <input type="radio" name="pickupType" value="other" style="margin: 0;">
                                            🏠 Other Location
                                        </label>
                                    </div>
                                    <input type="text" id="pickupLocation" placeholder="Enter pickup address" class="input-modern"
                                           style="margin-top: 0.5rem; display: none;" />
                                </div>

                                <div class="form-group-modern">
                                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${icons.location} Destination
                                    </label>
                                    <select id="destination" class="input-modern">
                                        <option value="">Select destination</option>
                                        <option value="hilton">🏨 Hilton Hotel Nairobi</option>
                                        <option value="maasai-mara">🦁 Maasai Mara Safari</option>
                                        <option value="kempinski">🏨 Kempinski Hotel</option>
                                        <option value="oloisereni">🏨 Oloisereni Hotel</option>
                                        <option value="nairobi-national-park">🦁 Nairobi National Park</option>
                                        <option value="lake-naivasha">🌊 Lake Naivasha</option>
                                        <option value="mount-kenya">⛰️ Mount Kenya</option>
                                        <option value="mombasa-beach">🏖️ Mombasa Beach</option>
                                        <option value="hells-gate">🔥 Hell's Gate National Park</option>
                                        <option value="serena-hotel">🏨 Serena Hotel</option>
                                        <option value="safari-park-hotel">🏨 Safari Park Hotel</option>
                                        <option value="karen-blixen-museum">🏛️ Karen Blixen Museum</option>
                                        <option value="giraffe-centre">🦒 Giraffe Centre</option>
                                        <option value="david-sheldrick-sanctuary">🐘 David Sheldrick Wildlife Trust</option>
                                    </select>
                                </div>

                                <div class="form-group-modern">
                                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${icons.calendar} Travel Date & Time
                                    </label>
                                    <input type="datetime-local" id="scheduledDate" required class="input-modern" />
                                    <small style="color: var(--text-secondary); margin-top: 0.25rem; display: block;">Must be at least 30 minutes from now</small>
                                </div>

                                <div class="form-group-modern">
                                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${icons.users} Passengers
                                    </label>
                                    <input type="number" id="passengerCount" min="1" max="10" value="1" class="input-modern" />
                                </div>

                                <div class="form-group-modern">
                                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${icons.car} Vehicle Type
                                    </label>
                                    <select id="vehicleType" class="input-modern">
                                        <option value="sedan">${icons.sedan} Sedan - Comfortable for 1-4 passengers</option>
                                        <option value="suv">${icons.suv} SUV - Spacious for 1-6 passengers</option>
                                        <option value="van">${icons.van} Van - Perfect for groups up to 10</option>
                                        <option value="bike">${icons.bike} Bike - Quick rides for 1-2 passengers</option>
                                    </select>
                                </div>

                                <div class="form-group-modern">
                                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${icons.map} Distance
                                    </label>
                                    <input type="text" id="distanceDisplay" disabled placeholder="Auto calculated" class="input-modern" />
                                </div>
                            </div>

                            <div class="form-group-modern">
                                <label style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${icons.settings} Notes (Optional)
                                </label>
                                <textarea id="notes" rows="3" placeholder="Special instructions, accessibility needs, or preferences..." class="input-modern"></textarea>
                            </div>

                            <!-- Price and Time Display -->
                            <div style="text-align: center; margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, var(--primary-light), rgba(79, 70, 229, 0.1)); border-radius: var(--radius-lg); border: 1px solid var(--border-light);">
                                <div id="timeEstimate" style="margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                                    ${icons.clock} Estimated Time: -- min
                                </div>
                                <div id="priceDisplay" class="price-display" style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">
                                    ${icons.money} Estimated Price: KSH --
                                </div>
                                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                                    * Final price may vary based on traffic and demand
                                </div>
                            </div>

                            <button type="submit" class="btn-modern btn-primary-modern" id="bookingSubmitBtn" style="font-size: 0.9rem; padding: 0.75rem 2rem; width: auto;">
                                ${icons.check} Create Booking
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Map Section -->
            <div class="map-section">
                <div id="map" style="border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);"></div>
            </div>
        </div>
    `;

    // Initialize map
    const map = L.map('map').setView([-1.2864, 36.8172], 12); // Nairobi CBD coordinates

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let pickupMarker = null;
    let destinationMarker = null;
    let routeLine = null;

    // Define location coordinates
    const locations = {
        airport: { lat: -1.3192, lng: 36.9273, name: "JKIA Airport" },
        hilton: { lat: -1.2864, lng: 36.8172, name: "Hilton Hotel Nairobi" },
        "maasai-mara": { lat: -1.4061, lng: 35.0081, name: "Maasai Mara Safari" },
        kempinski: { lat: -1.2864, lng: 36.8172, name: "Kempinski Hotel" },
        oloisereni: { lat: -1.2864, lng: 36.8172, name: "Oloisereni Hotel" },
        "nairobi-national-park": { lat: -1.3521, lng: 36.7949, name: "Nairobi National Park" },
        "lake-naivasha": { lat: -0.7693, lng: 36.4262, name: "Lake Naivasha" },
        "mount-kenya": { lat: 0.1616, lng: 37.2986, name: "Mount Kenya" },
        "mombasa-beach": { lat: -4.0435, lng: 39.6682, name: "Mombasa Beach" },
        "hells-gate": { lat: -0.8188, lng: 36.3688, name: "Hell's Gate National Park" },
        "serena-hotel": { lat: -1.3689, lng: 36.8034, name: "Serena Hotel" },
        "safari-park-hotel": { lat: -1.3866, lng: 36.7747, name: "Safari Park Hotel" },
        "karen-blixen-museum": { lat: -1.4165, lng: 36.7288, name: "Karen Blixen Museum" },
        "giraffe-centre": { lat: -1.3159, lng: 36.8097, name: "Giraffe Centre" },
        "david-sheldrick-sanctuary": { lat: -1.3521, lng: 36.7949, name: "David Sheldrick Wildlife Trust" }
    };

    // Set minimum datetime to 30 minutes from now
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const minDateTime = now.toISOString().slice(0, 16);
    document.getElementById('scheduledDate').min = minDateTime;

    // Handle pickup type change
    document.querySelectorAll('input[name="pickupType"]').forEach(radio => {
        radio.addEventListener('change', function () {
            const customPickup = document.getElementById('pickupLocation');
            if (this.value === 'other') {
                customPickup.style.display = 'block';
                customPickup.required = true;
            } else {
                customPickup.style.display = 'none';
                customPickup.required = false;
                customPickup.value = '';
            }
            estimatePriceAndDistance();
            updateMap();
        });
    });

    // Function to calculate distance between two coordinates (Haversine formula)
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Function to estimate price and distance
    function estimatePriceAndDistance() {
        const pickupType = document.querySelector('input[name="pickupType"]:checked').value;
        const destination = document.getElementById("destination").value;
        const vehicle = document.getElementById("vehicleType").value;
        const passengers = parseInt(document.getElementById("passengerCount").value) || 1;

        if (!destination) {
            document.getElementById("priceDisplay").textContent = "Estimated Price: KSH --";
            document.getElementById("distanceDisplay").value = "";
            document.getElementById("timeEstimate").textContent = "Estimated Time: -- min";
            return;
        }

        let pickupCoords;
        if (pickupType === 'airport') {
            pickupCoords = locations.airport;
        } else {
            // For custom pickup, use a default location for now (could be enhanced with geocoding)
            pickupCoords = { lat: -1.2864, lng: 36.8172, name: "Custom Location" };
        }

        const destCoords = locations[destination];
        const distance = calculateDistance(pickupCoords.lat, pickupCoords.lng, destCoords.lat, destCoords.lng);

        // Estimate time (average 40 km/h in city, 80 km/h highway)
        const avgSpeed = distance > 50 ? 80 : 40;
        const timeInHours = distance / avgSpeed;
        const timeInMinutes = Math.round(timeInHours * 60);

        document.getElementById("distanceDisplay").value = `${distance.toFixed(1)} km`;
        document.getElementById("timeEstimate").textContent = `Estimated Time: ${timeInMinutes} min`;

        // new pricing: sedan base 1200, suv 1500, van 2000, bike 800
        let basePrice = 1200;
        if (vehicle === "suv") basePrice = 1500;
        if (vehicle === "van") basePrice = 2000;
        if (vehicle === "bike") basePrice = 800;

        // Price based on distance + passengers
        const price = Math.round((basePrice + distance * 15) + passengers * 5);
        document.getElementById("priceDisplay").textContent = `Estimated Price: KSH ${price}`;
    }

    // Handle destination card clicks to populate form
    const destinationCards = document.querySelectorAll('.destination-card');
    destinationCards.forEach(card => {
        card.addEventListener('click', () => {
            const destination = card.dataset.destination;
            document.getElementById("destination").value = destination;
            estimatePriceAndDistance();
            updateMap();
            // Scroll to booking form smoothly
            document.querySelector('.booking-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Add event listeners for real-time updates
    document.getElementById("destination").addEventListener("change", () => {
        estimatePriceAndDistance();
        updateMap();
    });
    document.getElementById("vehicleType").addEventListener("change", estimatePriceAndDistance);
    document.getElementById("passengerCount").addEventListener("input", estimatePriceAndDistance);
    document.getElementById("pickupLocation").addEventListener("input", () => {
        estimatePriceAndDistance();
        updateMap();
    });

    // Update map with markers and route
    function updateMap() {
        const pickupType = document.querySelector('input[name="pickupType"]:checked').value;
        const destination = document.getElementById("destination").value;

        // Clear existing markers and route
        if (pickupMarker) map.removeLayer(pickupMarker);
        if (destinationMarker) map.removeLayer(destinationMarker);
        if (routeLine) map.removeLayer(routeLine);

        let pickupCoords;
        if (pickupType === 'airport') {
            pickupCoords = locations.airport;
        } else {
            const customPickup = document.getElementById("pickupLocation").value;
            if (customPickup) {
                // For demo, use CBD coordinates for custom pickup
                pickupCoords = { lat: -1.2864, lng: 36.8172, name: customPickup };
            }
        }

        if (pickupCoords) {
            pickupMarker = L.marker([pickupCoords.lat, pickupCoords.lng]).addTo(map)
                .bindPopup(`Pickup: ${pickupCoords.name}`);
        }

        if (destination && locations[destination]) {
            const destCoords = locations[destination];
            destinationMarker = L.marker([destCoords.lat, destCoords.lng]).addTo(map)
                .bindPopup(`Destination: ${destCoords.name}`);
        }

        if (pickupCoords && destination && locations[destination]) {
            const destCoords = locations[destination];
            // Draw route line
            routeLine = L.polyline([[pickupCoords.lat, pickupCoords.lng], [destCoords.lat, destCoords.lng]],
                { color: 'blue', weight: 3 }).addTo(map);

            // Fit map to show both points
            map.fitBounds([[pickupCoords.lat, pickupCoords.lng], [destCoords.lat, destCoords.lng]],
                { padding: [20, 20] });
        }
    }

    // Form submission
    document.getElementById("bookingForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const pickupType = document.querySelector('input[name="pickupType"]:checked').value;
        let pickupLocation;

        if (pickupType === 'airport') {
            pickupLocation = 'JKIA Airport';
        } else {
            pickupLocation = document.getElementById("pickupLocation").value;
        }

        const vehicleType = document.getElementById("vehicleType").value;
        const scheduledDate = new Date(document.getElementById("scheduledDate").value);
        const now = new Date();

        // Validate that scheduled date is at least 30 minutes in the future
        const minBookingTime = new Date(now.getTime() + 30 * 60000);
        if (scheduledDate <= minBookingTime) {
            showToast("Travel date must be at least 30 minutes in the future", "#ef4444");
            return;
        }

        const formData = {
            pickupLocation: pickupLocation,
            destination: locations[document.getElementById("destination").value]?.name || document.getElementById("destination").value,
            scheduledDate: new Date(document.getElementById("scheduledDate").value).toISOString(),
            passengerCount: parseInt(document.getElementById("passengerCount").value),
            vehicleType: vehicleType,
            notes: document.getElementById("notes").value,
            bookingType: "Standard"
        };

        try {
            const bookingRes = await api.createBooking(formData);
            
            if (!bookingRes.ok) {
                const errorData = await bookingRes.json();
                throw new Error(errorData.message || `API Error ${bookingRes.status}: Failed to create booking`);
            }

            const booking = await bookingRes.json();
            
            if (!booking.id && !booking.data?.id) {
                throw new Error('Invalid booking response - no booking ID received');
            }

            const bookingId = booking.id || booking.data?.id;
            
            // Fetch full booking details with assigned driver and vehicle
            const bookingDetailsRes = await api.getBookings();
            if (!bookingDetailsRes.ok) {
                throw new Error('Failed to fetch booking details');
            }

            const allBookings = await bookingDetailsRes.json();
            const fullBooking = allBookings.find(b => b.id === bookingId);

            // Show payment confirmation + rating modal instead of just booking confirmation
            showPaymentAndRatingModal(fullBooking || booking, sidebar, content, () => {
                renderTouristUI(sidebar, content, 'dashboard');
            });
        } catch (error) {
            console.error("Booking creation error:", error);
            showToast(error.message || "Failed to create booking. Please try again.", "#ef4444");
        }
    });
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading bookings data.</div>`;
    }
}

// Booking Confirmation Modal
function showBookingConfirmation(booking, sidebar, content) {
    // Use API data if available, otherwise show placeholder
    const driver = booking.assignedDriver || {
        name: "Driver Assignment Pending",
        rating: 0,
        phone: "N/A",
        profileImage: ""
    };

    const vehicle = booking.assignedVehicle || {
        make: "Vehicle",
        model: "Assignment Pending",
        color: "N/A",
        numberPlate: "N/A",
        image: "https://images.unsplash.com/photo-1567818735868-e71b99932e29?w=400&h=250&fit=crop"
    };

    const pickupTime = new Date(booking.scheduledDate || new Date());
    const timeStr = pickupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = pickupTime.toLocaleDateString();
    const vehicleName = `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.name || 'Vehicle';

    const confirmationHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 1rem;">
            <div style="background: white; border-radius: 16px; max-width: 500px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3); animation: slideUp 0.4s ease-out;">
                <!-- Success Header -->
                <div style="padding: 2rem 2rem 1.5rem; flex-shrink: 0; border-bottom: 1px solid var(--border-color);">
                    <div style="text-align: center;">
                        <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--success), #10b981); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                            <i class="fas fa-check" style="color: white; font-size: 28px;"></i>
                        </div>
                        <h2 style="margin: 0 0 0.5rem; color: var(--text-primary); font-size: 1.5rem; font-weight: 700;">Booking Confirmed!</h2>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.95rem;">Your ride has been successfully scheduled</p>
                    </div>
                </div>

                <!-- Scrollable Content -->
                <div style="flex: 1; overflow-y: auto; padding: 0 2rem; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) transparent;">
                    <div style="padding: 1.5rem 0;">
                        <!-- Pickup Details -->
                        <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border-left: 4px solid var(--primary-color);">
                            <div style="margin-bottom: 1rem;">
                                <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em;">Pickup Time</p>
                                <p style="margin: 0; color: var(--text-primary); font-size: 1.125rem; font-weight: 600;">${timeStr} - ${dateStr}</p>
                            </div>
                            <div style="margin-bottom: 0;">
                                <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em;">Location</p>
                                <p style="margin: 0; color: var(--text-primary); font-weight: 500;">📍 ${booking.pickupLocation || 'TBD'} → ${booking.destination || 'TBD'}</p>
                            </div>
                        </div>

                        <!-- Vehicle Details -->
                        <div style="margin-bottom: 1.5rem;">
                            <p style="margin: 0 0 1rem; color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Your Vehicle</p>
                            <div style="background: white; border: 2px solid var(--border-color); border-radius: 12px; overflow: hidden;">
                                <img src="${vehicle.image || 'https://images.unsplash.com/photo-1567818735868-e71b99932e29?w=400&h=250&fit=crop'}" alt="${vehicleName}" style="width: 100%; height: 150px; object-fit: cover;">
                                <div style="padding: 1rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                                        <div>
                                            <h4 style="margin: 0 0 0.25rem; color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${vehicleName}</h4>
                                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">Color: ${vehicle.color || 'N/A'}</p>
                                        </div>
                                        <div style="background: var(--primary-light); color: var(--primary-color); padding: 0.5rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.875rem;">
                                            ${vehicle.numberPlate || 'TBD'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Driver Details -->
                        <div style="margin-bottom: 1.5rem;">
                            <p style="margin: 0 0 1rem; color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Your Driver</p>
                            <div style="display: flex; align-items: center; gap: 1rem; background: var(--surface-color); border: 2px solid var(--border-color); border-radius: 12px; padding: 1rem;">
                                <div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.25rem; flex-shrink: 0;">
                                    ${driver.profileImage ? `<img src="${driver.profileImage}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : driver.name.charAt(0)}
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <h4 style="margin: 0 0 0.25rem; color: var(--text-primary); font-weight: 600;">${driver.name || 'Assigning Driver...'}</h4>
                                    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                                        ${driver.rating ? `<span style="color: var(--warning); font-size: 0.875rem;">⭐ ${driver.rating}</span>` : ''}
                                        ${driver.phone && driver.phone !== 'N/A' ? `<a href="tel:${driver.phone}" style="color: var(--primary-color); font-weight: 500; text-decoration: none; font-size: 0.875rem;">📞 Call Driver</a>` : '<span style="color: var(--text-secondary); font-size: 0.875rem;">Phone pending</span>'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Passengers Info -->
                        <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; margin-bottom: 0;">
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;"><strong>${booking.passengerCount || 1}</strong> passenger(s) booked</p>
                        </div>
                    </div>
                </div>

                <!-- Fixed Footer -->
                <div style="padding: 1.5rem 2rem 2rem; flex-shrink: 0; border-top: 1px solid var(--border-color);">
                    <!-- Action Buttons -->
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <button class="btn-modern btn-primary-modern" style="flex: 1; padding: 0.75rem;" id="confirmOkBtn">
                            Got It!
                        </button>
                        <button class="btn-modern btn-secondary-modern" style="flex: 1; padding: 0.75rem;" id="shareBtn">
                            <i class="fas fa-share-alt"></i> Share
                        </button>
                    </div>

                    <p style="margin: 0; text-align: center; color: var(--text-secondary); font-size: 0.8rem;">
                        Redirecting to dashboard in <span id="countdown">4</span>s
                    </p>
                </div>
            </div>
        </div>

        <style>
            /* Custom scrollbar styling */
            div[style*="overflow-y: auto"]::-webkit-scrollbar {
                width: 6px;
            }
            div[style*="overflow-y: auto"]::-webkit-scrollbar-track {
                background: transparent;
            }
            div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
            }
            div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.3);
            }
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        </style>
    `;

    // Add confirmation to DOM
    const container = document.createElement('div');
    container.innerHTML = confirmationHTML;
    document.body.appendChild(container);

    // Countdown timer
    let count = 4;
    const countdownSpan = document.getElementById('countdown');
    const interval = setInterval(() => {
        count--;
        if (countdownSpan) countdownSpan.textContent = count;
        if (count === 0) clearInterval(interval);
    }, 1000);

    // Button handlers
    document.getElementById('confirmOkBtn').addEventListener('click', () => {
        container.remove();
        clearInterval(interval);
        renderTouristUI(sidebar, content, 'dashboard');
    });

    document.getElementById('shareBtn').addEventListener('click', () => {
        const shareText = `I just booked a ride on RideHub! 🚗\n\n🕐 Pickup: ${timeStr}\n📍 ${booking.pickupLocation} → ${booking.destination}\n🚙 Vehicle: ${vehicleName}\n\nDownload RideHub now!`;
        
        if (navigator.share) {
            navigator.share({
                title: 'My RideHub Booking',
                text: shareText
            });
        } else {
            // Fallback - copy to clipboard
            navigator.clipboard.writeText(shareText);
            showToast('Details copied to clipboard!', '#10b981');
        }
    });
}

async function renderTouristFeedbackView(sidebar, content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Feedback Section...</div>`;

    try {
        const res = await api.getBookings();
        const bookings = await res.json();
        const completedBookings = bookings.filter(b => b.status === "COMPLETED");

        let feedbackHtml = '';
        if (completedBookings.length === 0) {
            feedbackHtml = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: #f9f9f9; border-radius: 8px;">No completed trips to rate.</div>`;
        } else {
            feedbackHtml = completedBookings.map(booking => {
                return `
                    <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <div>
                                <h3 style="margin: 0; color: var(--text-primary); font-size: 1rem; font-weight: 600;">
                                    Trip to ${booking.destination || 'Destination'}
                                </h3>
                                <p style="margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                                    📅 ${new Date(booking.startDate).toLocaleDateString()} | 💰 KSH ${booking.price}
                                </p>
                            </div>
                        </div>

                        <div style="background: #f9fafb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Rate Your Overall Experience</label>
                                <div style="display: flex; gap: 0.5rem; font-size: 1.5rem;">
                                    ${[1, 2, 3, 4, 5].map(star => `
                                        <button class="rating-star experience-rating" data-booking="${booking.id}" data-rating="${star}" style="background: none; border: none; cursor: pointer; font-size: 2rem; color: #d1d5db; transition: color 0.2s;">★</button>
                                    `).join('')}
                                </div>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Rate Your Driver (Optional)</label>
                                <div style="display: flex; gap: 0.5rem; font-size: 1.5rem;">
                                    ${[1, 2, 3, 4, 5].map(star => `
                                        <button class="rating-star driver-rating" data-booking="${booking.id}" data-rating="${star}" style="background: none; border: none; cursor: pointer; font-size: 2rem; color: #d1d5db; transition: color 0.2s;">★</button>
                                    `).join('')}
                                </div>
                                <small style="color: var(--text-secondary); display: block; margin-top: 0.25rem;">Help us improve driver service quality</small>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Your Feedback</label>
                                <textarea class="feedback-text" data-booking="${booking.id}" placeholder="Share your experience..." style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; resize: vertical; min-height: 100px;"></textarea>
                            </div>

                            <button class="btn btn-primary submit-feedback-btn" data-booking="${booking.id}" style="width: 100%;">Submit Feedback</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        content.innerHTML = `
            <div class="page-header">
                <h2>Ratings & Reviews</h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Share your experience and help us improve our service</p>
            </div>

            <div style="background: white; border-radius: 12px; padding: 1.5rem;">
                ${feedbackHtml}
            </div>
        `;

        // Add event listeners for rating stars
        content.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', (e) => {
                const bookingId = e.target.getAttribute('data-booking');
                const rating = parseInt(e.target.getAttribute('data-rating'));
                const isDriverRating = e.target.classList.contains('driver-rating');

                // Update UI
                const starsForBooking = content.querySelectorAll(`[data-booking="${bookingId}"].rating-star${isDriverRating ? '.driver-rating' : '.experience-rating'}`);
                starsForBooking.forEach((s, idx) => {
                    if (idx < rating) {
                        s.style.color = '#fbbf24';
                    } else {
                        s.style.color = '#d1d5db';
                    }
                });

                // Store rating
                starsForBooking[0].setAttribute('data-selected-rating', rating);
            });

            star.addEventListener('mouseover', (e) => {
                const rating = parseInt(e.target.getAttribute('data-rating'));
                const isDriverRating = e.target.classList.contains('driver-rating');
                const starsForBooking = content.querySelectorAll(`[data-booking="${e.target.getAttribute('data-booking')}"].rating-star${isDriverRating ? '.driver-rating' : '.experience-rating'}`);
                starsForBooking.forEach((s, idx) => {
                    if (idx < rating) {
                        s.style.color = '#fcd34d';
                    } else {
                        s.style.color = '#d1d5db';
                    }
                });
            });

            star.addEventListener('mouseout', (e) => {
                const bookingId = e.target.getAttribute('data-booking');
                const isDriverRating = e.target.classList.contains('driver-rating');
                const starsForBooking = content.querySelectorAll(`[data-booking="${bookingId}"].rating-star${isDriverRating ? '.driver-rating' : '.experience-rating'}`);
                const selectedRating = starsForBooking[0]?.getAttribute('data-selected-rating') || 0;
                starsForBooking.forEach((s, idx) => {
                    if (idx < selectedRating) {
                        s.style.color = '#fbbf24';
                    } else {
                        s.style.color = '#d1d5db';
                    }
                });
            });
        });

        // Add event listeners for submit buttons
        content.querySelectorAll('.submit-feedback-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bookingId = e.target.getAttribute('data-booking');
                const experienceStars = content.querySelectorAll(`[data-booking="${bookingId}"].experience-rating`);
                const driverStars = content.querySelectorAll(`[data-booking="${bookingId}"].driver-rating`);
                const experienceRating = experienceStars[0]?.getAttribute('data-selected-rating') || 0;
                const driverRating = driverStars[0]?.getAttribute('data-selected-rating') || 0;
                const feedback = content.querySelector(`.feedback-text[data-booking="${bookingId}"]`).value;

                if (!experienceRating || experienceRating === '0') {
                    showToast('Please rate your overall experience', '#ef4444');
                    return;
                }

                try {
                    // Submit experience feedback
                    await api.createFeedback({
                        bookingId: bookingId,
                        rating: parseInt(experienceRating),
                        comment: feedback,
                        type: 'SERVICE',
                        createdAt: new Date().toISOString()
                    });

                    // Submit driver feedback if provided
                    if (driverRating && driverRating !== '0') {
                        // Get driver ID from booking
                        const booking = completedBookings.find(b => b.id === bookingId);
                        if (booking && booking.assignedDriverId) {
                            await api.createFeedback({
                                bookingId: bookingId,
                                targetUserId: booking.assignedDriverId,
                                rating: parseInt(driverRating),
                                comment: feedback ? `Driver feedback: ${feedback}` : 'Driver rating submitted',
                                type: 'DRIVER',
                                createdAt: new Date().toISOString()
                            });
                        }
                    }

                    showToast('Thank you for your feedback!', '#10b981');
                    setTimeout(() => renderTouristFeedbackView(sidebar, content), 1000);
                } catch (err) {
                    console.error(err);
                    showToast('Failed to submit feedback', '#ef4444');
                }
            });
        });

    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading feedback section.</div>`;
    }
}

async function renderTouristDiscoverView(sidebar, content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Explore Page...</div>`;

    try {
        const discoverHTML = `
            <!-- Our Fleet Section -->
            <div class="page-header" style="margin-bottom: 2rem;">
                <h2>Explore Kenya with RideHub</h2>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">Discover amazing destinations and travel in style with our premium fleet</p>
            </div>

            <!-- Fleet Showcase -->
            <div style="margin-bottom: 3rem;">
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; color: var(--text-primary);">Our Premium Fleet</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem;">
                    <!-- Sedan -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'; this.style.boxShadow='0 20px 25px -5px rgb(0 0 0 / 0.2)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=500&h=300&fit=crop" alt="Sedan" style="width: 100%; height: 200px; object-fit: cover;">
                        <div style="padding: 1.5rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600;">Sedan - Toyota Camry</h4>
                            <p style="margin: 0 0 1rem; color: var(--text-secondary); font-size: 0.875rem;">Perfect for comfort & style. Ideal for airport transfers and business meetings.</p>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--primary-color); font-weight: 600; font-size: 1.1rem;">From KSH 1,200</span>
                                <span style="background: var(--primary-light); color: var(--primary-color); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 500;">4 Passengers</span>
                            </div>
                        </div>
                    </div>

                    <!-- SUV -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'; this.style.boxShadow='0 20px 25px -5px rgb(0 0 0 / 0.2)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=500&h=300&fit=crop" alt="SUV" style="width: 100%; height: 200px; object-fit: cover;">
                        <div style="padding: 1.5rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600;">SUV - Toyota Noah</h4>
                            <p style="margin: 0 0 1rem; color: var(--text-secondary); font-size: 0.875rem;">Spacious & rugged. Great for family trips and safari adventures.</p>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--primary-color); font-weight: 600; font-size: 1.1rem;">From KSH 1,500</span>
                                <span style="background: var(--primary-light); color: var(--primary-color); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 500;">6 Passengers</span>
                            </div>
                        </div>
                    </div>

                    <!-- Van -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'; this.style.boxShadow='0 20px 25px -5px rgb(0 0 0 / 0.2)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1464207687429-7505649dae38?w=500&h=300&fit=crop" alt="Van" style="width: 100%; height: 200px; object-fit: cover;">
                        <div style="padding: 1.5rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600;">Van - Nissan Caravan</h4>
                            <p style="margin: 0 0 1rem; color: var(--text-secondary); font-size: 0.875rem;">Spacious & comfortable. Perfect for groups and tour operators.</p>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--primary-color); font-weight: 600; font-size: 1.1rem;">From KSH 2,000</span>
                                <span style="background: var(--primary-light); color: var(--primary-color); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 500;">12 Passengers</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Destinations -->
            <div style="margin-bottom: 3rem;">
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; color: var(--text-primary);">Popular Destinations</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
                    <!-- Nairobi National Park -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='translateY(0)'">
                        <img src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=500&h=250&fit=crop" alt="Nairobi National Park" style="width: 100%; height: 180px; object-fit: cover;">
                        <div style="padding: 1rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600; font-size: 1rem;">Nairobi National Park</h4>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.75rem;">See lions, giraffes & zebras with the skyline backdrop</p>
                        </div>
                    </div>

                    <!-- Lake Naivasha -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='translateY(0)'">
                        <img src="https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=500&h=250&fit=crop" alt="Lake Naivasha" style="width: 100%; height: 180px; object-fit: cover;">
                        <div style="padding: 1rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600; font-size: 1rem;">Lake Naivasha</h4>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.75rem;">Scenic lake ideal for water sports & relaxation</p>
                        </div>
                    </div>

                    <!-- Masai Mara -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='translateY(0)'">
                        <img src="https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=500&h=250&fit=crop" alt="Masai Mara" style="width: 100%; height: 180px; object-fit: cover;">
                        <div style="padding: 1rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600; font-size: 1rem;">Masai Mara</h4>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.75rem;">World-renowned safari destination with Big Five</p>
                        </div>
                    </div>

                    <!-- Mount Kenya -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='translateY(0)'">
                        <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=250&fit=crop" alt="Mount Kenya" style="width: 100%; height: 180px; object-fit: cover;">
                        <div style="padding: 1rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600; font-size: 1rem;">Mount Kenya</h4>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.75rem;">Africa's second highest peak ideal for trekking</p>
                        </div>
                    </div>

                    <!-- Mombasa Beach -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='translateY(0)'">
                        <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&h=250&fit=crop" alt="Mombasa Beach" style="width: 100%; height: 180px; object-fit: cover;">
                        <div style="padding: 1rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600; font-size: 1rem;">Mombasa Beach</h4>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.75rem;">Sun, sand & sea with historical Swahili culture</p>
                        </div>
                    </div>

                    <!-- Hell's Gate National Park -->
                    <div class="card-modern" style="overflow: hidden; transition: transform 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='translateY(0)'">
                        <img src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=250&fit=crop" alt="Hell's Gate" style="width: 100%; height: 180px; object-fit: cover;">
                        <div style="padding: 1rem;">
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-weight: 600; font-size: 1rem;">Hell's Gate N.P.</h4>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.75rem;">Dramatic gorge with geothermal springs & hiking</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Popular Tours Section -->
            <div style="margin-bottom: 3rem;">
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; color: var(--text-primary);">🎫 Popular Tours & Experiences</h3>
                <div class="destinations-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem;">
                    <div class="promo-card" style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); cursor: pointer; transition: transform 0.2s ease; background: var(--surface-color); height: 280px; display: flex; flex-direction: column;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 25px 50px -12px rgb(0 0 0 / 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=300&fit=crop" alt="Nairobi National Park" style="width: 100%; height: 160px; object-fit: cover;">
                        <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.95rem;">🦁 Nairobi Safari Tour</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">See Big Five in the city</div>
                            </div>
                            <button style="font-size: 0.75rem; padding: 0.35rem 0.5rem; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; align-self: flex-start;">Book Tour</button>
                        </div>
                    </div>

                    <div class="promo-card" style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); cursor: pointer; transition: transform 0.2s ease; background: var(--surface-color); height: 280px; display: flex; flex-direction: column;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 25px 50px -12px rgb(0 0 0 / 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=300&fit=crop" alt="Lake Naivasha" style="width: 100%; height: 160px; object-fit: cover;">
                        <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.95rem;">🌊 Lake Naivasha Escape</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Boat rides & water sports</div>
                            </div>
                            <button style="font-size: 0.75rem; padding: 0.35rem 0.5rem; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; align-self: flex-start;">Book Tour</button>
                        </div>
                    </div>

                    <div class="promo-card" style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); cursor: pointer; transition: transform 0.2s ease; background: var(--surface-color); height: 280px; display: flex; flex-direction: column;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 25px 50px -12px rgb(0 0 0 / 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&h=300&fit=crop" alt="Masai Mara" style="width: 100%; height: 160px; object-fit: cover;">
                        <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.95rem;">🦁 Masai Mara Safari</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Big Five safari adventure</div>
                            </div>
                            <button style="font-size: 0.75rem; padding: 0.35rem 0.5rem; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; align-self: flex-start;">Book Tour</button>
                        </div>
                    </div>

                    <div class="promo-card" style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); cursor: pointer; transition: transform 0.2s ease; background: var(--surface-color); height: 280px; display: flex; flex-direction: column;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 25px 50px -12px rgb(0 0 0 / 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop" alt="Mount Kenya" style="width: 100%; height: 160px; object-fit: cover;">
                        <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.95rem;">⛰️ Mount Kenya Trek</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Peak trekking experience</div>
                            </div>
                            <button style="font-size: 0.75rem; padding: 0.35rem 0.5rem; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; align-self: flex-start;">Book Tour</button>
                        </div>
                    </div>

                    <div class="promo-card" style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); cursor: pointer; transition: transform 0.2s ease; background: var(--surface-color); height: 280px; display: flex; flex-direction: column;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 25px 50px -12px rgb(0 0 0 / 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop" alt="Mombasa Beach" style="width: 100%; height: 160px; object-fit: cover;">
                        <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.95rem;">🏖️ Mombasa Beach Getaway</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Coastal paradise & culture</div>
                            </div>
                            <button style="font-size: 0.75rem; padding: 0.35rem 0.5rem; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; align-self: flex-start;">Book Tour</button>
                        </div>
                    </div>

                    <div class="promo-card" style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); cursor: pointer; transition: transform 0.2s ease; background: var(--surface-color); height: 280px; display: flex; flex-direction: column;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 25px 50px -12px rgb(0 0 0 / 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgb(0 0 0 / 0.1)'">
                        <img src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop" alt="Hell's Gate" style="width: 100%; height: 160px; object-fit: cover;">
                        <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.95rem;">🔥 Hell's Gate Adventure</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Hiking & geothermal springs</div>
                            </div>
                            <button style="font-size: 0.75rem; padding: 0.35rem 0.5rem; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; align-self: flex-start;">Book Tour</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Why Choose RideHub -->
            <div style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; padding: 2.5rem; border-radius: var(--radius-lg); margin-top: 2rem;">
                <h3 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Why Choose RideHub?</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; margin-top: 1.5rem;">
                    <div>
                        <h4 style="margin: 0 0 0.5rem; font-size: 1.1rem;">🛡️ Safe & Reliable</h4>
                        <p style="margin: 0; opacity: 0.9; font-size: 0.875rem;">Professional drivers, verified vehicles, and 24/7 support</p>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 0.5rem; font-size: 1.1rem;">💰 Transparent Pricing</h4>
                        <p style="margin: 0; opacity: 0.9; font-size: 0.875rem;">No hidden charges. What you see is what you pay</p>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 0.5rem; font-size: 1.1rem;">📱 Easy Booking</h4>
                        <p style="margin: 0; opacity: 0.9; font-size: 0.875rem;">Book in seconds and track your ride in real-time</p>
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = discoverHTML;
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading discover section.</div>`;
    }
}
