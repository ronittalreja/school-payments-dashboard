# School Payment Backend API

A robust backend API for managing school payments and transactions built with Express.js and MongoDB.

## Features

- 🔐 JWT Authentication
- 💳 Payment Gateway Integration
- 🔄 Webhook Processing
- 📊 Transaction Management
- 🔍 Advanced Filtering & Pagination
- 📝 Comprehensive Logging
- 🛡️ Security Best Practices

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas account
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd school-payment-backend
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your actual values
```

4. Start the development server
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - User login

### Payments
- `POST /api/payment/create-payment` - Create a new payment

### Webhooks
- `POST /api/webhook` - Process payment webhooks

### Transactions
- `GET /api/transactions` - Get all transactions (with pagination)
- `GET /api/transactions/school/:schoolId` - Get transactions by school
- `GET /api/transactions/status/:customOrderId` - Check transaction status

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| MONGODB_URI | MongoDB connection string | Yes |
| JWT_SECRET | JWT signing secret | Yes |
| PAYMENT_JWT_SECRET | Payment JWT secret | Yes |
| FRONTEND_URL | Frontend application URL | No |
| SCHOOL_ID | Default school ID | Yes |
| TRUSTEE_ID | Default trustee ID | Yes |
| PG_KEY | Payment gateway key | Yes |
| API_KEY | Payment API key | Yes |

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### Create Payment
```bash
curl -X POST http://localhost:3001/api/payment/create-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "amount": 1000,
    "student_info": {
      "name": "John Doe",
      "id": "STU123",
      "email": "john@example.com"
    },
    "gateway_name": "PhonePe"
  }'
```

### Get Transactions
```bash
curl -X GET "http://localhost:3001/api/transactions?page=1&limit=10&status=success" \
  -H "Authorization: Bearer <your-token>"
```

### Process Webhook (for testing)
```bash
curl -X POST http://localhost:3001/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "status": 200,
    "order_info": {
      "order_id": "collected_id_here",
      "order_amount": 1000,
      "transaction_amount": 1020,
      "gateway": "PhonePe",
      "bank_reference": "YESBNK222",
      "status": "success",
      "payment_mode": "upi",
      "payemnt_details": "success@ybl",
      "Payment_message": "payment success",
      "payment_time": "2025-01-15T08:14:21.945+00:00",
      "error_message": "NA"
    }
  }'
```

## Database Schema

### User Collection
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (hashed),
  role: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Order Collection
```javascript
{
  _id: ObjectId,
  school_id: ObjectId,
  trustee_id: ObjectId,
  student_info: {
    name: String,
    id: String,
    email: String
  },
  gateway_name: String,
  custom_order_id: String,
  createdAt: Date,
  updatedAt: Date
}
```

### OrderStatus Collection
```javascript
{
  _id: ObjectId,
  collect_id: ObjectId (ref: Order),
  order_amount: Number,
  transaction_amount: Number,
  payment_mode: String,
  payment_details: String,
  bank_reference: String,
  payment_message: String,
  status: String,
  error_message: String,
  payment_time: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Deployment

### Using Heroku
1. Install Heroku CLI
2. Create a new Heroku app
```bash
heroku create school-payment-api
```
3. Set environment variables
```bash
heroku config:set MONGODB_URI=<your-mongodb-uri>
heroku config:set JWT_SECRET=<your-jwt-secret>
# ... other environment variables
```
4. Deploy
```bash
git push heroku main
```

### Using Railway
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

## Security Features

- JWT Authentication on all protected routes
- Password hashing with bcrypt
- Request rate limiting
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet
- Error handling without information leakage

## Performance Optimizations

- Database indexing on frequently queried fields
- Aggregation pipelines for complex queries
- Pagination for large datasets
- Response compression
- Connection pooling

## Testing

Use the provided Postman collection for comprehensive API testing.

## License

MIT License

## Support

For issues and questions, please create an issue in the GitHub repository.