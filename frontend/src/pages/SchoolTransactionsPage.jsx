import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TransactionTable from '../components/TransactionTable';
import apiService from '../services/apiService';

const SchoolTransactionsPage = () => {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState('65b0e6293e9f76a9694d84b4');
  const [sortField, setSortField] = useState('payment_time');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const schools = [
    { id: '65b0e6293e9f76a9694d84b4', name: 'ABC High School' },
    { id: '65b0e6293e9f76a9694d84b5', name: 'XYZ Elementary' },
    { id: '65b0e6293e9f76a9694d84b6', name: 'DEF Academy' }
  ];

  useEffect(() => {
    if (selectedSchool && token) {
      fetchSchoolTransactions();
    }
  }, [selectedSchool, sortField, sortOrder, token]);

  const fetchSchoolTransactions = async () => {
    if (!selectedSchool) return;
    
    setLoading(true);
    try {
      const response = await apiService.fetchSchoolTransactions(token, selectedSchool, {
        sort: sortField,
        order: sortOrder
      });
      
      if (response.success) {
        setTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch school transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            School Transactions
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View transactions for a specific school
          </p>
        </div>
        <button
          onClick={fetchSchoolTransactions}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select School
        </label>
        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
      </div>

      <TransactionTable
        transactions={transactions}
        loading={loading}
        onSort={handleSort}
        sortField={sortField}
        sortOrder={sortOrder}
      />
    </div>
  );
};

export default SchoolTransactionsPage;