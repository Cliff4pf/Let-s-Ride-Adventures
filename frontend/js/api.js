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

    reinstateUser: async function (userId) {
        return this.fetchWithAuth(`/User/${userId}/reinstate`, {
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
        // backend expects PATCH for approval
        return this.fetchWithAuth(`/Booking/${bookingId}/approve`, {
            method: 'PATCH'
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

    updateVehicle: async function(vehicleId, updateData) {
        // Include the ID in the request body (backend requires it to match URL param)
        const body = { ...updateData, id: vehicleId };
        return this.fetchWithAuth(`/Vehicle/${vehicleId}`, {
            method: 'PUT',
            body: JSON.stringify(body)
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
    assignDriverToVehicle: async function (driverId, vehicleId) {
        return this.fetchWithAuth(`/Vehicle/${vehicleId}/assign-driver`, {
            method: 'PATCH',
            body: JSON.stringify({ driverId })
        });
    },

    unassignDriverFromVehicle: async function (vehicleId) {
        return this.fetchWithAuth(`/Vehicle/${vehicleId}/unassign-driver`, {
            method: 'PATCH'
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
    },

    getMyFeedback: async function () {
        return this.fetchWithAuth('/Feedback/my');
    },

    getFeedbackForUser: async function (userId) {
        return this.fetchWithAuth(`/Feedback/for/${userId}`);
    },

    getFeedbackStats: async function (userId) {
        return this.fetchWithAuth(`/Feedback/stats/${userId}`);
    },

    updateFeedback: async function (feedbackId, feedbackData) {
        return this.fetchWithAuth(`/Feedback/${feedbackId}`, {
            method: 'PUT',
            body: JSON.stringify(feedbackData)
        });
    },

    deleteFeedback: async function (feedbackId) {
        return this.fetchWithAuth(`/Feedback/${feedbackId}`, {
            method: 'DELETE'
        });
    },

    // --- Messaging API ---
    sendMessage: async function (messageData) {
        return this.fetchWithAuth('/Message/send', {
            method: 'POST',
            body: JSON.stringify(messageData)
        });
    },

    getInbox: async function () {
        return this.fetchWithAuth('/Message/inbox');
    },

    getConversation: async function (userId) {
        return this.fetchWithAuth(`/Message/conversation/${userId}`);
    },

    getUnreadMessages: async function () {
        return this.fetchWithAuth('/Message/unread');
    },

    markMessageAsRead: async function (messageId) {
        return this.fetchWithAuth(`/Message/${messageId}/read`, {
            method: 'PUT'
        });
    },

    deleteMessage: async function (messageId) {
        return this.fetchWithAuth(`/Message/${messageId}`, {
            method: 'DELETE'
        });
    },

    getMessage: async function (messageId) {
        return this.fetchWithAuth(`/Message/${messageId}`);
    },

    // --- Profile API ---
    updateProfile: async function (profileData) {
        return this.fetchWithAuth('/User/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    },

    changePassword: async function (currentPassword, newPassword) {
        return this.fetchWithAuth('/User/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    },

    // --- Audit Logs API ---
    getAuditLogs: async function (limit = 100) {
        return this.fetchWithAuth(`/AuditLog?limit=${limit}`);
    },

    getAuditLogsByUser: async function (userId) {
        return this.fetchWithAuth(`/AuditLog/user/${userId}`);
    },

    getAuditLogsByAction: async function (actionType) {
        return this.fetchWithAuth(`/AuditLog/action/${actionType}`);
    }
};

export default api;
