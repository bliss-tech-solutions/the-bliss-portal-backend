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
     - Handles `joinTask`, `joinFestiveDate`, `joinUser`.

2. **Controllers emit events**
   - Example: `ChatController.createMessage` saves chat then `io.to(taskId).emit('chat:new', payload)`
   - Task extension approvals, user updates, etc., can broadcast similarly by calling `getIO()`.

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

---
This document summarizes how the backend is structured, where each major feature lives, and how Socket.IO integrates with the REST controllers to deliver realtime updates.


