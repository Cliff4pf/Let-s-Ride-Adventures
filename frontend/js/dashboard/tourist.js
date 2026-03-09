import api from "../api.js";
import { icons, createNavItem, showToast } from "./shared.js";

export async function renderTouristUI(sidebar, content, section = 'dashboard') {
    sidebar.innerHTML = `
        ${createNavItem('Dashboard', icons.dashboard, 'dashboard', section === 'dashboard')}
        ${createNavItem('Bookings', icons.book, 'bookings', section === 'bookings')}
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

            if (targetSection === 'feedback') {
                renderTouristUI(sidebar, content, 'feedback');
            }
        });
    });

    if (section === 'dashboard') {
        await renderTouristDashboardView(sidebar, content);
    } else if (section === 'bookings') {
        await renderTouristBookingsView(sidebar, content);
    } else if (section === 'feedback') {
        await renderTouristFeedbackView(sidebar, content);
    }
}

async function renderTouristDashboardView(sidebar, content) {
    content.innerHTML = `<div style="padding:2rem;text-align:center;">Loading Tourist Dashboard...</div>`;

    try {
        const res = await api.getBookings();
        const bookings = await res.json();
        showToast('Bookings loaded', '#4f46e5');

        const pendingCount = bookings.filter(b => b.status === "PENDING" || b.status === "APPROVED").length;
        const historyCount = bookings.filter(b => b.status === "COMPLETED" || b.status === "CANCELLED").length;

        let tableHtml = '';
        if (bookings.length === 0) {
            tableHtml = `<tr><td colspan="5" style="text-align:center;">No bookings found.</td></tr>`;
        } else {
            tableHtml = bookings.map(b => `
                <tr>
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
            <div class="page-header">
                <h2>Welcome to RideHub</h2>
                <button class="btn btn-primary" id="newBookingBtn">+ New Booking</button>
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">${icons.book}</div>
                    <div class="metric-info">
                        <h3>Upcoming Trips</h3>
                        <div class="value">${pendingCount}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">${icons.dashboard}</div>
                    <div class="metric-info">
                        <h3>History Logs</h3>
                        <div class="value">${historyCount}</div>
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
                        ${tableHtml}
                    </tbody>
                </table>
            </div>
        `;

        content.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm("Are you sure you want to cancel this booking?")) {
                    await api.cancelBooking(id);
                    alert("Booking cancelled.");
                    renderTouristUI(sidebar, content, 'dashboard');
                }
            });
        });

        const newBookingBtn = document.getElementById('newBookingBtn');
        if (newBookingBtn) {
            newBookingBtn.addEventListener('click', () => {
                renderTouristUI(sidebar, content, 'bookings');
            });
        }
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div style="padding:2rem;color:red;">Error loading dashboard data.</div>`;
    }
}

async function renderTouristBookingsView(sidebar, content) {
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
        <div class="page-header">
            <h2>RideHub Dashboard</h2>
        </div>

        <!-- Stats Bar -->
        <div class="stats-bar">
            <div class="stat-item">
                <div class="stat-value">${totalTrips}</div>
                <div class="stat-label">Total Trips</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${upcoming}</div>
                <div class="stat-label">Upcoming</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${completed}</div>
                <div class="stat-label">Completed</div>
            </div>
        </div>

        <!-- Vehicle Summary -->
        <div class="stats-bar" style="margin-top:1rem;">
            <div class="stat-item">
                <div class="stat-value">${vehicleSummary.sedan}</div>
                <div class="stat-label">Sedans Avl</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${vehicleSummary.suv}</div>
                <div class="stat-label">SUVs Avl</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${vehicleSummary.van}</div>
                <div class="stat-label">Vans Avl</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${vehicleSummary.bike}</div>
                <div class="stat-label">Bikes Avl</div>
            </div>
        </div>

        <!-- Booking Container -->
        <div class="booking-container">
            <!-- Form Section -->
            <div class="booking-form-section">
                <div class="form-card">
                    <h3 style="text-align: center; margin-bottom: 2rem; color: var(--text-primary);">Create New Booking</h3>

                    <form id="bookingForm">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>📍 Pickup Location</label>
                                <div style="display: flex; gap: 1rem; align-items: center;">
                                    <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                                        <input type="radio" name="pickupType" value="airport" checked style="margin: 0;">
                                        JKIA Airport
                                    </label>
                                    <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                                        <input type="radio" name="pickupType" value="other" style="margin: 0;">
                                        Other Location
                                    </label>
                                </div>
                                <input type="text" id="pickupLocation" placeholder="Enter pickup address" class="form-control" 
                                       style="margin-top: 0.5rem; display: none;" />
                            </div>

                            <div class="form-group">
                                <label>🏁 Destination</label>
                                <select id="destination" class="form-control">
                                    <option value="">Select destination</option>
                                    <option value="hilton">🏨 Hilton Hotel Nairobi</option>
                                    <option value="maasai-mara">🦁 Maasai Mara Safari</option>
                                    <option value="kempinski">🏨 Kempinski Hotel</option>
                                    <option value="oloisereni">🏨 Oloisereni Hotel</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>📅 Travel Date</label>
                                <input type="datetime-local" id="scheduledDate" required class="form-control" />
                            </div>

                            <div class="form-group">
                                <label>👤 Passengers</label>
                                <input type="number" id="passengerCount" min="1" max="10" value="1" class="form-control" />
                            </div>

                            <div class="form-group">
                                <label>🚗 Vehicle Type</label>
                                <select id="vehicleType" class="form-control">
                                    <option value="sedan">🚗 Sedan</option>
                                    <option value="suv">🚙 SUV</option>
                                    <option value="van">🚐 Van</option>
                                    <option value="bike">🏍 Bike</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>📏 Distance</label>
                                <input type="text" id="distanceDisplay" disabled placeholder="Auto calculated" class="form-control" />
                            </div>
                        </div>

                        <div class="form-group">
                            <label>📝 Notes (Optional)</label>
                            <textarea id="notes" rows="3" placeholder="Special instructions..." class="form-control"></textarea>
                        </div>

                        <!-- Price and Time Display -->
                        <div style="text-align: center; margin: 1.5rem 0;">
                            <div id="timeEstimate" style="margin-bottom: 0.5rem; color: var(--text-secondary);">
                                Estimated Time: -- min
                            </div>
                            <div id="priceDisplay" class="price-display">
                                Estimated Price: KSH --
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary">Create Booking</button>
                    </form>
                </div>
            </div>

            <!-- Map Section -->
            <div class="map-section">
                <div id="map"></div>
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
        oloisereni: { lat: -1.2864, lng: 36.8172, name: "Oloisereni Hotel" }
    };

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

        const formData = {
            pickupLocation: pickupLocation,
            destination: locations[document.getElementById("destination").value]?.name || document.getElementById("destination").value,
            scheduledDate: document.getElementById("scheduledDate").value,
            passengerCount: parseInt(document.getElementById("passengerCount").value),
            vehicleType: document.getElementById("vehicleType").value,
            notes: document.getElementById("notes").value,
            bookingType: "Standard"
        };

        try {
            await api.createBooking(formData);
            showToast("Booking created successfully!", "success");
            renderTouristUI(sidebar, content, 'dashboard');
        } catch (error) {
            console.error("Booking creation error:", error);
            showToast("Failed to create booking. Please try again.", "error");
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
                                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Rate Your Experience</label>
                                <div style="display: flex; gap: 0.5rem; font-size: 1.5rem;">
                                    ${[1, 2, 3, 4, 5].map(star => `
                                        <button class="rating-star" data-booking="${booking.id}" data-rating="${star}" style="background: none; border: none; cursor: pointer; font-size: 2rem; color: #d1d5db; transition: color 0.2s;">★</button>
                                    `).join('')}
                                </div>
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

                // Update UI
                const starsForBooking = content.querySelectorAll(`[data-booking="${bookingId}"].rating-star`);
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
                const starsForBooking = content.querySelectorAll(`[data-booking="${e.target.getAttribute('data-booking')}"].rating-star`);
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
                const starsForBooking = content.querySelectorAll(`[data-booking="${bookingId}"].rating-star`);
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
                const starsForBooking = content.querySelectorAll(`[data-booking="${bookingId}"].rating-star`);
                const rating = starsForBooking[0]?.getAttribute('data-selected-rating') || 0;
                const feedback = content.querySelector(`.feedback-text[data-booking="${bookingId}"]`).value;

                if (!rating || rating === '0') {
                    showToast('Please rate your experience', '#ef4444');
                    return;
                }

                try {
                    await api.createFeedback({
                        bookingId: bookingId,
                        rating: parseInt(rating),
                        comment: feedback,
                        createdAt: new Date().toISOString()
                    });
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
