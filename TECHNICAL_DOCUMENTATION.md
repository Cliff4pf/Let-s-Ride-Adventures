# RideHub - Technical Documentation

## Project Structure

```
RideHub/
├── backend/RideHub.Api/              # ASP.NET Core backend
│   ├── Controllers/                   # API endpoints
│   │   ├── UserController.cs         # User auth & management
│   │   ├── BookingController.cs      # Booking CRUD & workflow
│   │   ├── DriverController.cs       # Driver management (admin only)
│   │   ├── VehicleController.cs      # Fleet management
│   │   ├── AnalyticsController.cs    # Data analytics endpoints
│   │   ├── FeedbackController.cs     # Review & rating system
│   │   └── MessageController.cs      # Messaging system
│   ├── Models/                        # Data models (Firestore)
│   │   ├── User.cs
│   │   ├── Booking.cs
│   │   ├── Vehicle.cs
│   │   ├── Feedback.cs               # NEW
│   │   ├── Message.cs                # NEW
│   │   ├── Notification.cs
│   │   ├── AuditLog.cs
│   │   └── ApiResponse.cs
│   ├── DTOs/                          # Data transfer objects
│   │   ├── RegisterUserDTO.cs
│   │   ├── CreateBookingDTO.cs
│   │   └── [other DTOs]
│   ├── Services/                      # Business logic
│   │   ├── FirestoreService.cs       # Database operations
│   │   └── EmailService.cs           # Email notifications
│   ├── Attributes/                    # Custom attributes
│   │   └── RoleAuthorizeAttribute.cs # Role-based authorization
│   ├── Program.cs                     # Configuration
│   └── appsettings.json              # Settings

└── frontend/                           # Web interface
    ├── index.html                     # Login page
    ├── register.html                  # Registration page
    ├── dashboard.html                 # Main dashboard
    ├── js/
    │   ├── api.js                    # API client
    │   ├── auth.js                   # Authentication logic
    │   ├── login.js                  # Login handler
    │   ├── register.js               # Registration handler
    │   ├── firebase.js               # Firebase client config
    │   └── dashboard/
    │       ├── shared.js             # Shared utilities
    │       ├── tourist.js            # Tourist view
    │       ├── driver.js             # Driver view
    │       ├── admin.js              # Admin view
    │       └── secretary.js          # Secretary view
    └── css/
        └── styles.css                # Main stylesheet
```

## Architecture

### Backend (ASP.NET Core 8.0)
- **Pattern:** MVC with service layer
- **Database:** Google Firestore (NoSQL)
- **Authentication:** Firebase Auth (JWT)
- **API Style:** RESTful

### Frontend (Vanilla JavaScript)
- **Architecture:** Module-based (ES6)
- **State Management:** localStorage for user session
- **HTTP Client:** Fetch API with custom wrapper
- **UI Framework:** Custom CSS (no dependencies except Chart.js, Leaflet)

## Key Technologies

```json
{
  "backend": {
    "framework": "ASP.NET Core 8.0",
    "database": "Google Cloud Firestore",
    "auth": "Firebase Authentication",
    "sdk": "Google.Cloud.Firestore",
    "email": "Simple SMTP"
  },
  "frontend": {
    "markup": "HTML5",
    "styling": "CSS3 (custom, no framework)",
    "scripting": "JavaScript ES6 (modules)",
    "charts": "Chart.js 4.x",
    "maps": "Leaflet.js",
    "icons": "Font Awesome 6.x"
  },
  "infrastructure": {
    "auth_provider": "Firebase",
    "database": "Google Cloud",
    "hosting": "Static files + API server"
  }
}
```

## Data Models

### User Model
```csharp
{
  uid: string (Firestore Document ID),
  fullName: string,
  email: string,
  phoneNumber: string,
  role: "Tourist" | "Driver" | "Admin" | "Secretary",
  status: "Active" | "Inactive" | "Suspended",
  emailVerified: boolean,
  licenseNumber: string? (drivers only),
  assignedVehicleId: string?,
  commissionBalance: double,
  createdAt: Timestamp,
  updatedAt?: Timestamp,
  lastLogin?: Timestamp
}
```

### Booking Model
```csharp
{
  id: string,
  userId: string (tourist),
  bookingType: "Transfer" | "Tour" | "Pickup",
  serviceType: "Transport" | "Accommodation",
  startDate: DateTime,
  pickupLocation: string,
  destination: string,
  numberOfGuests: int,
  vehiclePreference: string?,
  specialRequests: string?,
  price: double,
  status: "PENDING" | "APPROVED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED",
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED",
  assignedDriverId: string?,
  vehicleId: string?,
  approvedByAdminId: string?,
  approvedBySecretaryId: string?,
  createdAt: Timestamp,
  updatedAt?: Timestamp
}
```

### Feedback Model
```csharp
{
  id: string,
  userId: string (author),
  bookingId: string?,
  targetUserId: string? (who is being reviewed),
  rating: int (1-5),
  comment: string,
  type: "SERVICE" | "DRIVER" | "GENERAL",
  createdAt: Timestamp,
  updatedAt?: Timestamp
}
```

### Message Model
```csharp
{
  id: string,
  senderId: string,
  recipientId: string,
  bookingId: string? (related booking),
  content: string,
  type: "TEXT" | "SYSTEM" | "LOCATION_UPDATE",
  isRead: boolean,
  createdAt: Timestamp,
  readAt?: Timestamp
}
```

## API Response Format

All API endpoints return:
```json
{
  "success": boolean,
  "message": string,
  "data": object | null
}
```

Example success response:
```json
{
  "success": true,
  "message": "Booking created successfully.",
  "data": {
    "id": "booking-123",
    "status": "PENDING"
  }
}
```

Example error response:
```json
{
  "success": false,
  "message": "Vehicle is not available.",
  "data": null
}
```

## Authentication Flow

1. **User Registration**
   - Submit email, password, name via `/User/register`
   - Backend creates Firebase Auth user
   - Backend creates Firestore user profile
   - User role automatically set to "Tourist"

2. **User Login**
   - User logs in via Firebase client SDK
   - Firebase returns JWT token
   - Frontend stores token in localStorage
   - Frontend includes token in all API requests via Authorization header

3. **Authorization**
   - `[Authorize]` attribute requires valid JWT
   - `[RoleAuthorize("Admin", "Secretary")]` requires specific roles
   - Custom claims in JWT token carry user role

## Firestore Collections & Indexes

### Collections
- **users** - Indexed on: role, status
- **bookings** - Indexed on: userId, status, assignedDriverId
- **vehicles** - Indexed on: status, isAvailable
- **feedback** - Indexed on: userId, targetUserId, type
- **messages** - Indexed on: senderId, recipientId, isRead
- **notifications** - Indexed on: userId, isRead
- **auditLogs** - Indexed on: userId, action, timestamp

## Email Notifications

Triggered events:
- User registration confirmation
- Booking creation confirmation
- Booking approval
- Driver assignment
- Booking rejection
- Assignment completion

Email template pattern:
```
Subject: [RideHub] Action notification
To: user.email
Content: HTML formatted with action details and links
```

## Error Handling

### HTTP Status Codes Used
- `200 OK` - Success
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Invalid/missing token
- `403 Forbidden` - Permission denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Frontend Error Handling
```javascript
try {
  const response = await api.getBookings();
  if (!response.ok) {
    const error = await response.json();
    console.error(error.message);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## Performance Considerations

1. **Query Optimization**
   - Use indexes for frequently filtered fields
   - Batch reads where possible
   - Avoid N+1 queries

2. **Caching Strategy**
   - User session stored in localStorage
   - Booking data refreshed on demand
   - Analytics data cached for dashboard view

3. **Frontend Optimization**
   - Lazy loading of dashboard modules
   - Minimize API calls (batching)
   - Local form validation before submit

## Development Workflow

### Backend Development
```bash
# Build
cd backend/RideHub.Api
dotnet build

# Run
dotnet run --launch-profile http

# Test with Postman/curl
curl -X POST http://localhost:5202/api/User/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test","email":"test@example.com","password":"pass123"}'
```

### Frontend Development
```bash
# No build step needed (vanilla JS)
# Serve frontend files from backend static file middleware

# Access at: http://localhost:5202/index.html
```

### Database Management
- Use Firebase Console to view/edit data
- Run migrations if needed via FirestoreService methods
- Backup using Firebase backup functionality

## Deployment Checklist

### Before Production
- [ ] Update firebase-key.json with production credentials
- [ ] Change firestore project ID in Program.cs
- [ ] Set ASPNETCORE_ENVIRONMENT to Production
- [ ] Enable HTTPS
- [ ] Configure CORS for production domain
- [ ] Set up email service credentials
- [ ] Enable Firestore backup
- [ ] Configure Firebase rules (see firestore.rules)
- [ ] Test all API endpoints
- [ ] Test all user workflows
- [ ] Set up error logging
- [ ] Configure analytics

### Firebase Security Rules
See `firestore.rules` for Firestore security policy:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid || 
                           isAdmin(request.auth.uid);
    }
    // ... more rules
  }
}
```

## Testing Strategy

### Unit Tests (Recommended)
```csharp
[TestClass]
public class BookingServiceTests
{
    [TestMethod]
    public async Task CreateBooking_ValidData_ReturnsBookingId()
    {
        // Arrange
        var booking = new Booking { ... };
        
        // Act
        var result = await service.AddBookingAsync(booking);
        
        // Assert
        Assert.IsNotNull(result);
    }
}
```

### Integration Tests (Recommended)
```csharp
[TestClass]
public class BookingControllerTests
{
    [TestMethod]
    public async Task CreateBooking_WithAuth_Returns200()
    {
        // Use TestServer to run API
        // Make HTTP request
        // Assert response
    }
}
```

### Frontend Testing (Recommended)
```javascript
// Jest/Vitest for unit tests
// Cypress for E2E tests

describe('Booking Creation', () => {
  it('should create booking with valid data', () => {
    // Test flow
  });
});
```

## Troubleshooting

### Backend Port Already in Use
```bash
# Find process using port 5202
netstat -ano | findstr :5202

# Kill process
taskkill /PID {pid} /F
```

### Firebase Authentication Failed
- Check firebase-key.json exists and is valid
- Verify Firebase project ID matches
- Check Firebase project has Firestore enabled
- Verify Firebase Auth is enabled

### CORS Errors
- Check backend CORS configuration in Program.cs
- Verify frontend makes requests to correct base URL
- Check browser console for specific CORS errors

### Database Errors
- Check Firestore indexes exist
- Verify user permissions in Firebase security rules
- Check network connectivity to Google Cloud

## Contributing Guidelines

1. Follow C# naming conventions (PascalCase for classes, camelCase for properties)
2. Use async/await for all I/O operations
3. Add null checks and validation
4. Document complex logic with comments
5. Test changes before committing
6. Use meaningful commit messages

## Version History

- **v1.0** (Current) - Initial release
  - User authentication
  - Booking management
  - Fleet management
  - Analytics (descriptive + predictive)
  - Feedback system
  - Messaging system
  - Modern responsive UI
