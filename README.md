# The Bliss Portal Backend

A well-structured Node.js backend API built with Express.js, following best practices for scalability and maintainability.

## 🚀 Features

- **Modular Architecture**: Clean separation of concerns with organized folder structure
- **API Route Management**: Easy-to-manage API routes with individual components
- **Input Validation**: Joi schema validation for all endpoints
- **Error Handling**: Comprehensive error handling middleware
- **Security**: Helmet.js for security headers, CORS configuration
- **Logging**: Built-in logging system with file output
- **Database Ready**: MongoDB integration setup
- **Authentication**: JWT-based authentication middleware

## 📁 Project Structure

```
the-bliss-portal-backend/
├── public/                     # Static files
│   └── uploads/               # File uploads directory
├── src/                       # Source code
│   ├── components/           # API components (each API has its own folder)
│   │   └── testapi/         # Example API component
│   │       ├── index.js     # Route definitions
│   │       ├── testapiController.js  # Controller logic
│   │       ├── testApiService.js     # Business logic
│   │       └── testApiSchema.js      # Validation schemas
│   ├── routes/              # Main routes configuration
│   │   └── index.js         # Primary routes file (like app.jsx in frontend)
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js          # Authentication middleware
│   │   ├── errorHandler.js  # Error handling
│   │   ├── notFound.js      # 404 handler
│   │   └── validateRequest.js # Request validation
│   ├── config/              # Configuration files
│   │   └── database.js      # Database connection
│   └── utils/               # Utility functions
│       ├── logger.js        # Logging utilities
│       └── response.js      # Response helpers
├── app.js                   # Main application file
├── package.json             # Dependencies and scripts
└── env.example              # Environment variables template
```

## 🔧 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp env.example .env
   ```
   Update the `.env` file with your configuration.

3. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📝 Creating a New API

To create a new API (e.g., `userapi`):

1. **Create the component folder:**
   ```bash
   mkdir src/components/userapi
   ```

2. **Create the required files:**
   - `index.js` - Route definitions
   - `userapiController.js` - Controller logic
   - `userApiService.js` - Business logic
   - `userApiSchema.js` - Validation schemas

3. **Import in main routes:**
   Add to `src/routes/index.js`:
   ```javascript
   const userApiRoutes = require('../components/userapi');
   router.use('/userapi', userApiRoutes);
   ```

## 🛠️ API Endpoints

### Test API (Example)
- `GET /api/testapi` - Get all test data
- `GET /api/testapi/:id` - Get test data by ID
- `POST /api/testapi` - Create new test data
- `PUT /api/testapi/:id` - Update test data
- `DELETE /api/testapi/:id` - Delete test data

### Health Check
- `GET /health` - Server health status

## 🔐 Environment Variables

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/bliss-portal
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

## 📊 Development

The project follows a clear pattern where:
- **Components** contain individual API logic
- **Routes** manage all API imports (like app.jsx in frontend)
- **Middleware** handles common functionality
- **Utils** provide helper functions
- **Config** manages application configuration

This structure makes it easy to scale and maintain the backend as your application grows.
