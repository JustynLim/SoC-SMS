import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  withCredentials: true
});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Add JWT and CSRF to requests
api.interceptors.request.use((config) => {
  // For cookie-based JWT, the access token is automatically sent by the browser.
  // We only need to handle CSRF for modifying requests.
  if (['post', 'put', 'delete', 'patch'].includes(config.method)) {
    let csrfToken = null;
    if (config.url.endsWith('/token/refresh')) {
      csrfToken = getCookie('csrf_refresh_token');
    } else {
      csrfToken = getCookie('csrf_access_token');
    }
    
    if (csrfToken) {
      config.headers['X-CSRF-TOKEN'] = csrfToken;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle 401 errors globally and attempt token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and not a refresh request itself
    // Also, ensure it's not a request to the refresh endpoint itself to avoid infinite loops
    if (error.response && error.response.status === 401 && !originalRequest._retry && !originalRequest.url.endsWith('/token/refresh')) {
      originalRequest._retry = true; // Mark request as retried

      if (isRefreshing) {
        // If a refresh is already in progress, queue the failed request
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      isRefreshing = true;

      return new Promise(async (resolve, reject) => {
        try {
          // Attempt to refresh the token
          await api.post('/token/refresh'); // This will automatically set new access token cookie

          isRefreshing = false;
          processQueue(null); // Process all queued requests with the new token
          resolve(api(originalRequest)); // Retry the original request
        } catch (refreshError) {
          // If refresh fails, log out the user
          console.error('Token refresh failed:', refreshError);
          localStorage.removeItem('token'); // Ensure any lingering local storage token is removed
          window.location.href = '/login';
          isRefreshing = false;
          processQueue(refreshError); // Reject all queued requests
          reject(refreshError); // Reject the original request
        }
      });
    }

    // If it's a 401 from the refresh endpoint itself, or any other error
    if (error.response && error.response.status === 401 && originalRequest.url.endsWith('/token/refresh')) {
        console.error('Refresh token is invalid or expired. Logging out.');
        localStorage.removeItem('token');
        window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;