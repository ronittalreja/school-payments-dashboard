# School Payment and Dashboard Application

A full-stack web application for managing school payments and transactions with a React frontend and Node.js backend.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Frontend Usage](#frontend-usage)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## 🎯 Project Overview

This application provides a comprehensive solution for school payment management, including:
- Secure payment processing through Edviron API
- JWT-based authentication
- Transaction tracking and status monitoring
- Dashboard with analytics and reporting
- Webhook handling for payment updates

## ✨ Features

### Backend Features
- **Payment Integration**: Integration with Edviron payment gateway
- **JWT Authentication**: Secure user authentication and authorization
- **RESTful API**: Well-structured API endpoints
- **Database Management**: MongoDB with Mongoose ODM
- **Webhook Support**: Real-time payment status updates
- **Error Handling**: Comprehensive error handling and logging
- **Rate Limiting**: API rate limiting for security
- **Data Validation**: Input validation using express-validator

### Frontend Features
- **Responsive Design**: Mobile-first responsive UI
- **Dark Mode**: Toggle between light and dark themes
- **Real-time Updates**: Live transaction status updates
- **Dashboard Analytics**: Visual charts and statistics
- **Payment Creation**: Easy payment request creation
- **Transaction Management**: View and filter transactions
- **Status Tracking**: Real-time payment status checking

## 🛠 Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **Axios** - HTTP client
- **Express-validator** - Input validation
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

### Frontend
- **React** - Frontend framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling framework
- **Lucide React** - Icons
- **React Router** - Client-side routing

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local or Atlas)
- **Git**

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ronittalreja/school-payments-dashboard
cd school-payment-app
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration (see Environment Variables section)

# Start the backend server
npm start
# or for development with nodemon
npm run dev
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration

# Start the frontend server
npm run dev
```

## 🔐 Environment Variables

### Backend Environment Variables (.env)

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/school
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/school

# Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Payment Gateway Configuration
PG_KEY=edvtest01
API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0cnVzdGVlSWQiOiI2NWIwZTU1MmRkMzE5NTBhOWI0MWM1YmEiLCJJbmRleE9mQXBpS2V5Ijo2fQ.IJWTYCOurGCFdRM2xyKtw6TEcuwXxGnmINrXFfsAdt0
SCHOOL_ID=65b0e6293e9f76a9694d84b4

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### Frontend Environment Variables (.env)

```env
# API Configuration
VITE_API_URL=http://localhost:3001/api

# Application Configuration
VITE_APP_NAME="School Payment Dashboard"
VITE_APP_VERSION=1.0.0
```

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |

### Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/create-payment` | Create payment request |
| GET | `/api/payment/check-payment-status/:collect_request_id` | Check payment status |

### Transaction Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | Get all transactions |
| GET | `/api/transactions/school/:schoolId` | Get transactions by school |
| GET | `/api/transactions/status/:customOrderId` | Check transaction status |

### Webhook Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhook` | Handle payment webhooks |

### Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/api/dashboard/recent-transactions` | Get recent transactions |

## 💻 Frontend Usage

### Authentication
1. Register a new account or login with existing credentials
2. JWT token is automatically stored and used for API calls

### Creating Payments
1. Navigate to "Create Payment" page
2. Fill in student details and amount
3. Select payment gateway
4. Submit to generate payment link

### Viewing Transactions
1. Go to "Transactions" page
2. Filter by status, school, or date
3. Click on any transaction for details

### Dashboard
1. View analytics and statistics
2. Monitor recent transactions
3. Check gateway performance

## 🗄 Database Schema

### Order Schema
```javascript
{
  school_id: String,
  trustee_id: String,
  student_info: {
    name: String,
    id: String,
    email: String
  },
  gateway_name: String,
  custom_order_id: String,
  collect_request_id: String,
  amount: Number,
  callback_url: String,
  status: String,
  timestamps: true
}
```

### OrderStatus Schema
```javascript
{
  collect_id: ObjectId,
  order_amount: Number,
  transaction_amount: Number,
  payment_mode: String,
  payment_details: String,
  bank_reference: String,
  payment_message: String,
  status: String,
  error_message: String,
  payment_time: Date
}
```

## 🚀 Deployment

### Backend Deployment (Heroku)

1. Create Heroku app:
```bash
heroku create your-app-name-backend
```

2. Set environment variables:
```bash
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your_mongodb_atlas_uri
heroku config:set JWT_SECRET=your_jwt_secret
# ... other env variables
```

3. Deploy:
```bash
git push heroku main
```

### Frontend Deployment (Netlify/Vercel)

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting platform

3. Set environment variables in your hosting platform's dashboard

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### API Testing with Postman
Import the provided Postman collection for API testing.

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Error
- Ensure MongoDB is running
- Check MONGODB_URI in .env file
- For MongoDB Atlas, ensure IP whitelist is configured

#### 2. Payment API Errors
- Verify PG_KEY and API_KEY in environment variables
- Check network connectivity to Edviron API
- Ensure callback_url is properly formatted

#### 3. CORS Issues
- Add your frontend URL to CORS configuration
- Check FRONTEND_URL environment variable

#### 4. JWT Authentication Errors
- Verify JWT_SECRET is set
- Check token expiration
- Ensure proper token format in requests

### Database Issues

#### Duplicate Key Error Fix
If you encounter duplicate key errors:

```bash
# Run the database fix script
cd backend
node fixDuplicateKeyError.js
```

#### Reset Database
To reset the database for development:

```bash
# Connect to MongoDB and run:
db.dropDatabase()
```

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section
- Review API documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📝 Development Notes

### Project Structure
```
school-payment-app/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── contexts/
│   └── public/
└── README.md
```

### Development Commands

Backend:
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

Frontend:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build