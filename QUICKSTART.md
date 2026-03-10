# RideHub Quick Start Guide

## 🚀 Getting Started (5 Minutes)

### Prerequisites
- .NET 8.0 SDK installed
- Firebase project with credentials
- Modern web browser
- Terminal/Command Prompt

### Step 1: Setup Backend

```bash
# Navigate to backend directory
cd RideHub/backend/RideHub.Api

# Build backend
dotnet build

# Run backend
dotnet run --launch-profile http
```

**Expected Output:**
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5202
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to stop.
```

✅ Backend is now running on `http://localhost:5202`

### Step 2: Access Frontend

1. Open browser and navigate to: `http://localhost:5202`
2. You should see the **RideHub Login Page**
3. UI should be modern with gradients and animations

---

## 🧪 Testing Workflows

### Workflow 1: User Registration

**Steps:**
1. Click "Create Account" on login page
2. Fill in:
   - Full Name: "John Doe"
   - Email: "john@example.com"
   - Password: "SecurePass123!"
3. Accept terms
4. Click "Create Account"

**Expected Result:**
- Account created successfully
- Redirect to login page
- Success message displayed

**API Test (curl):**
```bash
curl -X POST http://localhost:5202/api/User/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "phoneNumber": "+254712345678"
  }'
```

---

### Workflow 2: Create & Manage Booking

**Prerequisites:** Logged in as Tourist

**Steps:**
1. Go to Dashboard
2. Click "New Booking"
3. Fill booking form:
   - Pick-up Location: "Nairobi CBD"
   - Destination: "Maasai Mara"
   - Date: Tomorrow
   - Guests: 4
   - Special Requests: "Window seats preferred"
4. Submit booking

**Expected Result:**
- Booking created with ID
- Status: PENDING
- Email confirmation sent
- Booking appears in your bookings list

---

### Workflow 3: Approve Booking (Secretary)

**Prerequisites:** Logged in as Secretary, booking created

**Steps:**
1. Go to Bookings Management
2. Find pending booking
3. Click "Approve"
4. Confirm action

**Expected Result:**
- Booking status changed to APPROVED
- Tourist receives email notification
- Ready for driver assignment

---

### Workflow 4: Assign Driver & Vehicle

**Prerequisites:** Logged in as Admin, booking approved

**Steps:**
1. Go to Bookings Management
2. Click booking to open details
3. Click "Assign"
4. Select Driver and Vehicle
5. Confirm assignment

**Expected Result:**
- Booking status: ASSIGNED
- Driver receives notification
- Vehicle marked unavailable
- Booking locked (no more changes)

---

### Workflow 5: View Analytics

**Prerequisites:** Logged in as Admin

**Steps:**
1. Go to Analytics Dashboard
2. View charts showing:
   - Bookings per month
   - Revenue trends
   - Fleet utilization %
   - Driver workload
   - Popular destinations

**Expected Result:**
- Charts display data
- Predictive forecast shown for next month
- All metrics calculated correctly

---

### Workflow 6: Send Message

**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to Messaging
2. Select recipient
3. Type message
4. Send

**Expected Result:**
- Message appears in conversation
- Recipient can see it in inbox
- Unread count updates

---

### Workflow 7: Leave Feedback

**Prerequisites:** Logged in as Tourist, trip completed

**Steps:**
1. Go to Completed Trips
2. Click "Leave Review"
3. Select rating (1-5 stars)
4. Write comment
5. Submit

**Expected Result:**
- Feedback saved
- Rating counted in driver's average
- Visible in driver's profile

---

## 📊 Data for Testing

### Test Users (Auto-Created)

You can create users during testing:

```javascript
// Test Tourist
Email: tourist@test.com
Password: TestPass123!
Role: Tourist

// Test Driver  
Email: driver@test.com
Password: TestPass123!
Role: Driver (assign via Admin)

// Test Admin
Email: admin@test.com
Password: TestPass123!
Role: Admin (assign via Firebase Console)
```

### Sample Test Data

**Vehicles to Add:**
```json
[
  {
    "registrationNumber": "KBW 100A",
    "make": "Toyota",
    "model": "Hiace",
    "year": 2023,
    "type": "Van",
    "capacity": 14,
    "status": "active"
  },
  {
    "registrationNumber": "KES 999Z",
    "make": "Mercedes",
    "model": "Sprinter",
    "year": 2022,
    "type": "Coach",
    "capacity": 30,
    "status": "active"
  }
]
```

**Sample Bookings:**
```json
{
  "bookingType": "Tour",
  "serviceType": "Transport",
  "pickupLocation": "Jomo Kenyatta Airport",
  "destination": "Nairobi Hotel",
  "numberOfGuests": 6,
  "price": 5000,
  "specialRequests": "Need WiFi during trip"
}
```

---

## 🐛 Troubleshooting

### Issue: Backend won't start

**Solution:**
```bash
# Check if port 5202 is in use
netstat -ano | findstr :5202

# Kill process if needed
taskkill /PID {pid} /F

# Try again
dotnet run --launch-profile http
```

### Issue: "Connection refused" error

**Check:**
- Backend is running (should show "listening on localhost:5202")
- Frontend URL is `http://localhost:5202` (not https)
- No firewall blocking port 5202

### Issue: Firebase authentication fails

**Check:**
- `firebase-key.json` exists in backend folder
- Firebase project ID matches in Program.cs (ridehub-4ab73)
- Firebase Auth is enabled in project
- Firestore database is created

### Issue: "User already exists" on registration

**Solution:**
- Use a different email address (registration uses email as unique ID)
- Each test needs a new email: `test{random}@example.com`

### Issue: No data showing in analytics

**Check:**
- Create at least 3 bookings to see trends
- Mark some as COMPLETED and PAID
- Wait a moment for aggregation

---

## 🔌 API Testing with Postman

### Setup
1. Download [Postman](https://www.postman.com/downloads/)
2. Create new collection "RideHub"
3. Add base URL: `http://localhost:5202/api`

### Test Request Examples

**Register User:**
```
POST /User/register
Content-Type: application/json

{
  "fullName": "Test User",
  "email": "test@example.com",
  "password": "Pass123!",
  "phoneNumber": "+254712345678"
}
```

**Get All Bookings:**
```
GET /Booking
Authorization: Bearer {token}
```

**Create Booking:**
```
POST /Booking
Authorization: Bearer {token}
Content-Type: application/json

{
  "bookingType": "Transfer",
  "pickupLocation": "Airport",
  "destination": "City Center",
  "startDate": "2026-03-15T10:00:00Z",
  "numberOfGuests": 2,
  "price": 2500
}
```

**Get Analytics:**
```
GET /Analytics/dashboard
Authorization: Bearer {token}
```

**Send Message:**
```
POST /Message/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipientId": "driver-uid",
  "content": "When will you arrive?",
  "bookingId": "booking-123"
}
```

---

## 📱 Frontend Features to Test

### Login Page
- [ ] Enter valid credentials
- [ ] Try wrong password
- [ ] See remember me checkbox
- [ ] Click "Create Account" link

### Registration Page
- [ ] Fill all required fields
- [ ] See password strength indicator
- [ ] Accept terms checkbox required
- [ ] Email validation
- [ ] Submit successful

### Tourist Dashboard
- [ ] View personal bookings
- [ ] See booking statuses
- [ ] Create new booking
- [ ] View pending approvals
- [ ] See assigned driver info

### Admin Dashboard
- [ ] View all bookings
- [ ] See analytics charts
- [ ] Manage users
- [ ] Manage vehicles
- [ ] Approve/assign bookings

### Driver Dashboard
- [ ] See assigned trips
- [ ] Check customer details
- [ ] Accept/confirm trip
- [ ] Update trip status
- [ ] View earnings

### Messages
- [ ] Send message to contact
- [ ] See message history
- [ ] Mark as read
- [ ] Show unread count

### Feedback
- [ ] Leave star rating
- [ ] Write review
- [ ] Edit feedback
- [ ] See average ratings on profiles

---

## 🎯 Success Criteria

✅ **Backend Test**
- Compile without errors
- Run without crashing
- Respond to requests

✅ **Frontend Test**
- Load without errors
- Navigation works
- Forms submit correctly

✅ **Integration Test**
- Register user → Success
- Create booking → Success
- View booking → Success
- Approve booking → Success
- Assign booking → Success

✅ **Analytics Test**
- Dashboard loads
- Charts show data
- Calculations correct

✅ **Messaging Test**
- Send message → Delivered
- Receive message → Visible
- Mark read → Status updates

---

## 📋 Quick Checklist for Demo

```
Pre-Demo:
☐ Backend running on localhost:5202
☐ Browser accessible to frontend
☐ Test users created
☐ Sample data/bookings created

During Demo:
☐ Show login & registration
☐ Create booking as tourist
☐ Approve as secretary
☐ Assign as admin
☐ Show analytics dashboard
☐ Demo messaging feature
☐ Show feedback system
☐ View driver profile with ratings

Post-Demo:
☐ Backup test databases
☐ Document any issues
☐ Note user feedback
```

---

## 🆘 Getting Help

**Check these files:**
- `API_DOCUMENTATION.md` - All endpoints
- `TECHNICAL_DOCUMENTATION.md` - Architecture
- `PROJECT_STATUS_REPORT.md` - Features overview

**Common Issues:**
- Port in use → `netstat` command above
- Firebase errors → Check credentials
- CORS errors → Check browser console
- API not responding → Check backend logs

---

## Next Steps

1. ✅ Follow this guide to get system running
2. ✅ Test all workflows above
3. ✅ Verify data flows correctly
4. ✅ Check UI responsiveness
5. ✅ Document any issues
6. ✅ Plan deployment
7. ✅ Configure production Firebase
8. ✅ Set up backups
9. ✅ Deploy to production

Good luck! 🚀
