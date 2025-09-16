  
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }
    getAuthHeaders(token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }
    async makeRequest(url, options = {}) {
    console.log('Making request to:', `${this.baseURL}${url}`);
    console.log('Headers:', options.headers);
    
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.log('Error response:', error);
          if (response.status === 403) {
          console.error('Authentication failed - token may be expired or invalid');
          }
        
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
    async login(credentials) {
    return this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async register(userData) {
    return this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }
    async fetchTransactions(token, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const url = `/transactions${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(url, {
      headers: this.getAuthHeaders(token)
    });
  }

  async fetchSchoolTransactions(token, schoolId, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const url = `/transactions/school/${schoolId}${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(url, {
      headers: this.getAuthHeaders(token)
    });
  }

  async checkTransactionStatus(token, customOrderId) {
    return this.makeRequest(`/transactions/status/${customOrderId}`, {
      headers: this.getAuthHeaders(token)
    });
  }
    async createPayment(token, paymentData) {
    return this.makeRequest('/payment/create-payment', {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(paymentData)
    });
  }

  async checkPaymentStatus(token, collectRequestId) {
    return this.makeRequest(`/payment/status/${collectRequestId}`, {
      headers: this.getAuthHeaders(token)
    });
  }

  async retryPayment(token, collectRequestId) {
    return this.makeRequest(`/payment/retry/${collectRequestId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(token)
    });
  }

  async cancelPayment(token, collectRequestId) {
    return this.makeRequest(`/payment/cancel/${collectRequestId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(token)
    });
  }

  async getPaymentTransaction(token, collectRequestId) {
    return this.makeRequest(`/payment/transaction/${collectRequestId}`, {
      headers: this.getAuthHeaders(token)
    });
  }

  async getPaymentTransactions(token, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const url = `/payment/transactions${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(url, {
      headers: this.getAuthHeaders(token)
    });
  }
    async getDashboardStats(token, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const url = `/dashboard/stats${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(url, {
      headers: this.getAuthHeaders(token)
    });
  }

  async getRecentTransactions(token, limit = 5) {
    return this.makeRequest(`/dashboard/recent-transactions?limit=${limit}`, {
      headers: this.getAuthHeaders(token)
    });
  }

  async getTransactionSummary(token, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const url = `/dashboard/transaction-summary${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(url, {
      headers: this.getAuthHeaders(token)
    });
  }

  async getTopSchools(token, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const url = `/dashboard/top-schools${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(url, {
      headers: this.getAuthHeaders(token)
    });
  }

  async getGatewayPerformance(token, params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const url = `/dashboard/gateway-performance${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(url, {
      headers: this.getAuthHeaders(token)
    });
  }
    async uploadFile(token, file, endpoint) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }
    async simulateWebhook(token, webhookData) {
    return this.makeRequest('/webhook', {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(webhookData)
    });
  }
}
  const apiService = new ApiService();
export default apiService;