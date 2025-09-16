import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import apiService from '../services/apiService';


const TransactionStatusPage = () => {
  const { token } = useAuth();
  const [customOrderId, setCustomOrderId] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!customOrderId.trim()) return;

    setLoading(true);
    setError('');
    setTransaction(null);

    try {
      const response = await apiService.checkTransactionStatus(token, customOrderId);
      if (response.success) {
        setTransaction(response.data);
      } else {
        setError(response.message || 'Transaction not found');
      }
    } catch  {
      setError('Failed to fetch transaction status');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Transaction Status Check
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enter a custom order ID to check transaction status
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="customOrderId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Order ID
            </label>
            <div className="flex space-x-4">
              <input
                type="text"
                id="customOrderId"
                value={customOrderId}
                onChange={(e) => setCustomOrderId(e.target.value)}
                placeholder="Enter custom order ID (e.g., ORD_1234567890)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading || !customOrderId.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {transaction && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Transaction Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Order Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Custom Order ID:</span>
                    <span className="font-mono text-gray-900 dark:text-white">{transaction.custom_order_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Collect ID:</span>
                    <span className="font-mono text-gray-900 dark:text-white">{transaction.collect_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">School ID:</span>
                    <span className="font-mono text-gray-900 dark:text-white">{transaction.school_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Gateway:</span>
                    <span className="text-gray-900 dark:text-white">{transaction.gateway}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Payment Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <StatusBadge status={transaction.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Order Amount:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(transaction.order_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Transaction Amount:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(transaction.transaction_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Payment Mode:</span>
                    <span className="text-gray-900 dark:text-white">{transaction.payment_mode || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {transaction.student_info && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Student Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Name:</span>
                      <span className="text-gray-900 dark:text-white">{transaction.student_info.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Student ID:</span>
                      <span className="text-gray-900 dark:text-white">{transaction.student_info.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Email:</span>
                      <span className="text-gray-900 dark:text-white">{transaction.student_info.email}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Additional Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Payment Time:</span>
                    <span className="text-gray-900 dark:text-white">
                      {transaction.payment_time ? new Date(transaction.payment_time).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Bank Reference:</span>
                    <span className="text-gray-900 dark:text-white">{transaction.bank_reference || 'N/A'}</span>
                  </div>
                  {transaction.payment_message && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Payment Message:</span>
                      <span className="text-gray-900 dark:text-white">{transaction.payment_message}</span>
                    </div>
                  )}
                  {transaction.error_message && transaction.error_message !== 'NA' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Error Message:</span>
                      <span className="text-red-600 dark:text-red-400">{transaction.error_message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionStatusPage;

