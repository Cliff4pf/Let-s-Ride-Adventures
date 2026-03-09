/**
 * api.js
 * Handles all authenticated API requests to the ASP.NET Core backend.
 */

const API_BASE_URL = 'http://localhost:5202/api';

const api = {
    getToken: function () {
        return localStorage.getItem('ridehub_token');
    },

    fetchWithAuth: async function (endpoint, options = {}) {
        const token = this.getToken();

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (response.status === 401) {
                localStorage.removeItem('ridehub_token');
                window.location.href = 'index.html';
                throw new Error('Unauthorized. Please log in again.');
            }

            return response;
        } catch (error) {
            console.error('API Request Failed:', error);
            throw error;
        }
    },

    // --- User API ---
    getCurrentUser: async function () {
        return this.fetchWithAuth('/User/me');
    },

    getAllUsers: async function () {
        return this.fetchWithAuth('/User');
    },

    promoteUser: async function (userId, role) {
        return this.fetchWithAuth(`/User/${userId}/promote`, {
            method: 'PATCH',
            body: JSON.stringify(role)
        });
    },

    suspendUser: async function (userId) {
        return this.fetchWithAuth(`/User/${userId}/suspend`, {
            method: 'PATCH'
        });
    },

    // --- Bookings API ---
    getBookings: async function () {
        return this.fetchWithAuth('/Booking');
    },

    createBooking: async function (bookingData) {
        return this.fetchWithAuth('/Booking', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
    },

    approveBooking: async function (bookingId) {
        return this.fetchWithAuth(`/Booking/${bookingId}/approve`, {
            method: 'PUT'
        });
    },

    rejectBooking: async function (bookingId) {
        return this.fetchWithAuth(`/Booking/${bookingId}/reject`, {
            method: 'PUT'
        });
    },

    assignBooking: async function (assignmentData) {
        // { bookingId, vehicleId, driverId }
        return this.fetchWithAuth(`/Booking/assign`, {
            method: 'PUT',
            body: JSON.stringify(assignmentData)
        });
    },

    cancelBooking: async function (bookingId) {
        return this.fetchWithAuth(`/Booking/${bookingId}/cancel`, {
            method: 'PUT'
        });
    },

    updateBooking: async function (bookingId, updateData) {
        return this.fetchWithAuth(`/Booking/${bookingId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    },

    updateBookingStatus: async function (bookingId, status) {
        return this.fetchWithAuth(`/Booking/${bookingId}/update-status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    },

    updatePaymentStatus: async function (bookingId, paymentStatus) {
        return this.fetchWithAuth(`/Booking/${bookingId}/payment`, {
            method: 'PATCH',
            body: JSON.stringify({ paymentStatus })
        });
    },

    // --- Vehicles API ---
    getVehicles: async function () {
        return this.fetchWithAuth('/Vehicle');
    },

    addVehicle: async function(vehicleData) {
        return this.fetchWithAuth('/Vehicle', {
            method: 'POST',
            body: JSON.stringify(vehicleData)
        });
    },

    deleteVehicle: async function(vehicleId) {
        return this.fetchWithAuth(`/Vehicle/${vehicleId}`, {
            method: 'DELETE'
        });
    },

    activateVehicle: async function (vehicleId) {
        return this.fetchWithAuth(`/Vehicle/${vehicleId}/activate`, {
            method: 'PUT'
        });
    },

    deactivateVehicle: async function (vehicleId) {
        return this.fetchWithAuth(`/Vehicle/${vehicleId}/deactivate`, {
            method: 'PUT'
        });
    },

    // --- Analytics API ---
    getAnalytics: async function () {
        return this.fetchWithAuth('/Analytics/dashboard');
    },

    getSummary: async function () {
        return this.fetchWithAuth('/Analytics/summary');
    },

    getTrends: async function () {
        return this.fetchWithAuth('/Analytics/trends');
    },

    getDriverEarnings: async function (driverId) {
        return this.fetchWithAuth(`/Analytics/driver/${driverId}`);
    },

    // --- Feedback API ---
    createFeedback: async function (feedbackData) {
        return this.fetchWithAuth('/Feedback', {
            method: 'POST',
            body: JSON.stringify(feedbackData)
        });
    },

    getFeedback: async function () {
        return this.fetchWithAuth('/Feedback');
    },

    getFeedbackByBooking: async function (bookingId) {
        return this.fetchWithAuth(`/Feedback/booking/${bookingId}`);
    }
};

export default api;
