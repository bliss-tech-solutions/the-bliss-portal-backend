## The Bliss Portal Backend – Architecture Overview

### 1. Entry Point
- **`app.js`**
  - Loads environment variables, connects to MongoDB (`src/config/database.js`).
  - Sets global middleware: `helmet`, custom IP whitelist, CORS, logging, body parsers, static assets, health check.
  - Mounts REST routes under `/api` via `src/routes/index.js`.
  - Registers error handlers (`src/middleware/notFound.js`, `src/middleware/errorHandler.js`).
  - Creates HTTP server + Socket.IO instance; stores it with `setIO` from `src/utils/socket.js`.

### 2. Routing Layer (`src/routes`)
- Central router imports each component’s router (UserDetails, AddTaskAssign, Chat, etc.) and mounts them on `/api`.
- Each component folder contains its own `index.js` defining feature-specific endpoints.

### 3. Feature Modules

| Feature | Key Files | Purpose |
|---------|-----------|---------|
| **User Details** | `components/UserDetails` | CRUD for employee profiles, credential generation, sign-in, password updates. |
| **Task Assignment** | `components/AddTaskAssign` | Create/update tasks, slots, time-tracking, extensions, schedule sync, archived views. |
| **Chat** | `components/Chat` | Task-scoped chat threads with REST + Socket.IO realtime emissions. |
| **Client Management** | `components/ClientManagement` | Client onboarding, assignment to users, status tracking. Includes attachment management system for content writers to upload documents/links by month, visible to assigners in real-time. |
| **User Verification Documents** | `components/UserVerificationDocuments` | Store employee verification documents (Aadhar card, passport photo, offer letter), salary history (before/after Bliss), bank details, address, experience, and job information. |
| **Create Account Sign-In** | `components/CreateAccountSignInApi` | Admin authentication API with hardcoded credentials (CodeNo, Email, Password) for HR panel access control. |
| **Check-in/Check-out, Leaves, Festive Calendar, Salary Calculations** | respective folders | Business vertical APIs (attendance, leave management, calendar, payroll). |
| **User Schedule** | `components/UserSchedule/UserScheduleSchema.js` | Mirrors task slots to prevent double-booking and power availability lookups. |


### 4. Data Layer
- Mongoose models per feature (schemas under each component).
- Shared helpers (e.g., `UserSchedule`, chat threads, salary schemas).
- Connection configured via `MONGODB_URI` (Atlas).

### 5. Middleware & Utilities
- **`src/middleware/**`**: authentication, validation, IP whitelist (configurable via env), error handling.
- **`src/utils/socket.js`**: stores the Socket.IO instance (`setIO`, `getIO`) for controllers to emit events.
- **`src/utils/response.js`, `logger.js`**: common helpers for consistent responses/logging.

### 6. Socket.IO Architecture

1. **Setup (`app.js`)**
   - `const io = new Server(server, { cors: {...} })`
   - `setIO(io)`
   - `io.on('connection', socket => { … })`
     - Handles `joinTask`, `joinFestiveDate`, `joinUser`, `joinClient`, `joinClientUser`.

2. **Controllers emit events**
   - Example: `ChatController.createMessage` saves chat then `io.to(taskId).emit('chat:new', payload)`
   - Task extension approvals, user updates, client management (create/update/delete), attachment operations can broadcast similarly by calling `getIO()`.

3. **Client pattern (expected)**
   - Fetch history once via REST.
   - `socket.emit('joinTask', taskId)` to subscribe.
   - `socket.on('chat:new', handler)` to update UI without extra GET calls.

### 7. Deployment Considerations
- **Render**: app listens on `process.env.PORT`, IP whitelist can be toggled via env vars (`ALLOW_IP_WHITELIST`, `ALLOWED_IPS`).
- **MongoDB Atlas**: ensure Render IPs are whitelisted or Atlas set to `0.0.0.0/0`.
- **CORS Origins**: allow local dev + deployed frontend via env (`FRONTEND_URL`, `RENDER_EXTERNAL_URL`).

### 8. Request Lifecycle Example (Chat)
1. Client opens task chat → `GET /api/chat/messages?taskId=...`.
2. Client sends message → `POST /api/chat/messages`.
3. Controller saves message, updates task metadata, emits `chat:new`.
4. Any socket joined to that task room receives the event and updates instantly.
5. No repeated GETs needed after initial load.

### 9. Environment Configuration
- `.env` (local) and Render dashboard store secrets:
  - `MONGODB_URI`, `NODE_ENV`, `FRONTEND_URL`, `ALLOW_IP_WHITELIST`, etc.
  - CORS/IP whitelist logic reads from these to enable/disable restrictions.

### 10. API Endpoints Summary

#### Client Management
- `GET /api/clientmanagement/getAllClientsData` - Get all clients (optional filters: `status`, `city`)
- `GET /api/clientmanagement/getById/:clientId` - Get client by ID
- `GET /api/clientmanagement/getClientsByUserId/:userId` - Get clients assigned to a specific user
- `GET /api/clientmanagement/getClientsSortedByUserId` - Get all clients sorted/grouped by assigned userId
- `POST /api/clientmanagement/create` - Create new client
- `PUT /api/clientmanagement/update/:clientId` - Update client
- `DELETE /api/clientmanagement/delete/:clientId` - Delete client

**Client Schema Fields**: clientName, city, onboardDate, status (active/inactive), itsDataReceived (boolean), assignedUsers (array of {userId, name}), attachments (array)

**Socket Events**:
- `client:created` - Emitted when a client is created
- `client:assigned` - Emitted to assigned users when a client is created/updated with assignments
- `client:updated` - Emitted when a client is updated
- `client:deleted` - Emitted when a client is deleted

**Socket Rooms**: 
- `client:{clientId}` - Join with `socket.emit('joinClient', clientId)`
- `user:{userId}` - Join with `socket.emit('joinUser', userId)`

#### Client Attachments
- `POST /api/clientmanagement/:clientId/attachments` - Add attachment to client
- `GET /api/clientmanagement/:clientId/attachments` - Get all attachments for a client (optional filter: `month`)
- `GET /api/clientmanagement/:clientId/attachments/sortedByUserId` - Get attachments sorted/grouped by userId
- `GET /api/clientmanagement/:clientId/attachments/byUserId/:userId` - Get attachments filtered by clientId + userId
- `PUT /api/clientmanagement/:clientId/attachments/:attachmentId` - Update attachment
- `DELETE /api/clientmanagement/:clientId/attachments/:attachmentId` - Delete attachment

**Attachment Schema Fields**: link (required), notes (optional), month (Jan-Dec, required), uploadedBy ({userId, name})

**Socket Events**:
- `client:attachment:added` - Emitted when an attachment is added
- `client:attachment:updated` - Emitted when an attachment is updated
- `client:attachment:deleted` - Emitted when an attachment is deleted

**Socket Rooms for Attachments**:
- `client:{clientId}` - All attachments for a client
- `user:{userId}` - Attachments uploaded by a specific user
- `client:{clientId}:user:{userId}` - Join with `socket.emit('joinClientUser', {clientId, userId})` for filtered views

**Attachment Payload**:
```json
{
  "link": "https://docs.google.com/document/...",
  "notes": "Content writing work for January",
  "month": "Jan",
  "uploadedBy": {
    "userId": "user123",
    "name": "Content Writer Name"
  }
}
```

#### User Verification Documents
- `POST /api/userverificationdocuments/create` - Create new verification document
- `GET /api/userverificationdocuments/getAll` - Get all verification documents
- `GET /api/userverificationdocuments/getByUserId/:userId` - Get documents by userId

**Fields**: name, department, position, jobType, beforeBlissSalary, blissSalary, joiningDate, currentAddress, permanentAddress, experience, bankDetails (object), aadharCardImage, passportPhoto, offerLetter

#### Create Account Sign-In (Admin)
- `POST /api/createaccountsignin/signin` - Admin sign-in validation
- `GET /api/createaccountsignin/check` - Check API availability

**Credentials** (hardcoded):
- CodeNo: `BMMPK`
- Email: `HR@bliss.com`
- Password: `HR@Bliss0123`

**Response**: Returns success with `authenticated: true` if all credentials match, otherwise returns 401 with error details.

---
This document summarizes how the backend is structured, where each major feature lives, and how Socket.IO integrates with the REST controllers to deliver realtime updates.


