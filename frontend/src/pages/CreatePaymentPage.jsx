import React, { useState } from 'react';
import { Plus, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/apiService';

const CreatePaymentPage = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    amount: '',
    gateway_name: 'PhonePe',
    student_name: '',
    student_id: '',
    student_email: '',
    callback_url: 'http://localhost:3000/payment-success' // Default callback URL
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const gateways = [
    { value: 'PhonePe', label: 'PhonePe' },
    { value: 'Paytm', label: 'Paytm' },
    { value: 'Razorpay', label: 'Razorpay' }
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Structure the payment data according to the backend schema
      const paymentData = {
        // Backend will use these for Order schema
        school_id: "65b0e6293e9f76a9694d84b4", // From assessment document
        trustee_id: "65b0e552dd31950a9b41c5ba", // From assessment document
        gateway_name: formData.gateway_name,
        student_info: {
          name: formData.student_name,
          id: formData.student_id,
          email: formData.student_email
        },
        // For Edviron API
        amount: formData.amount,
        callback_url: formData.callback_url
      };

      console.log('Sending payment data:', paymentData);

      const response = await apiService.createPayment(token, paymentData);
      console.log('Payment response:', response);

      if (response.success) {
        setResult(response.data);
        setFormData({
          amount: '',
          gateway_name: 'PhonePe',
          student_name: '',
          student_id: '',
          student_email: '',
          callback_url: 'http://localhost:3000/payment-success'
        });
      } else {
        setError(response.message || 'Failed to create payment');
      }
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(err.message || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create Payment
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create a new payment request for a student
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount (₹)
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                min="1"
                step="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label htmlFor="gateway_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment Gateway
              </label>
              <select
                id="gateway_name"
                name="gateway_name"
                value={formData.gateway_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {gateways.map((gateway) => (
                  <option key={gateway.value} value={gateway.value}>
                    {gateway.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="student_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student Name
              </label>
              <input
                type="text"
                id="student_name"
                name="student_name"
                value={formData.student_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter student name"
              />
            </div>

            <div>
              <label htmlFor="student_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student ID
              </label>
              <input
                type="text"
                id="student_id"
                name="student_id"
                value={formData.student_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter student ID"
              />
            </div>

            <div>
              <label htmlFor="student_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student Email
              </label>
              <input
                type="email"
                id="student_email"
                name="student_email"
                value={formData.student_email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter student email"
              />
            </div>

              {/* <div>
                <label htmlFor="callback_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Callback URL
                </label>
                <input
                  type="url"
                  id="callback_url"
                  name="callback_url"
                  value={formData.callback_url}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter callback URL"
                />
              </div> */}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  <span>Create Payment</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-md p-4">
            <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-2">
              Payment Created Successfully!
            </h3>
            <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
              {result.collect_request_id && (
                <div className="flex justify-between">
                  <span>Collect Request ID:</span>
                  <span className="font-mono">{result.collect_request_id}</span>
                </div>
              )}
              {result.custom_order_id && (
                <div className="flex justify-between">
                  <span>Custom Order ID:</span>
                  <span className="font-mono">{result.custom_order_id}</span>
                </div>
              )}
            </div>
            
            {result.payment_url && (
              <div className="mt-4">
                <a
                  href={result.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Go to Payment</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatePaymentPage;