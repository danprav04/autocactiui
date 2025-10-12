// frontend/src/services/apiService.js
import axios from 'axios';

// Create an Axios instance configured to use the backend URL from environment variables.
const apiClient = axios.create({
    baseURL: process.env.REACT_APP_API_URL
});

// Use a request interceptor to automatically add the auth token to every request.
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Use a response interceptor to handle 401 Unauthorized errors globally.
apiClient.interceptors.response.use(
    (response) => {
        // If the request is successful, just return the response.
        return response;
    },
    (error) => {
        // Check if the error is a 401 Unauthorized response.
        if (error.response && error.response.status === 401) {
            // Clear the invalid/expired token from storage.
            localStorage.removeItem('token');
            // Redirect the user to the login page by reloading the application.
            // The App component will detect the absence of a token and show the LoginScreen.
            window.location.href = '/';
        }
        // For all other errors, reject the promise to allow for local error handling.
        return Promise.reject(error);
    }
);


/**
 * Authenticates a user against the backend.
 * @param {string} username - The user's username.
 * @param {string} password - The user's password.
 * @returns {Promise<object>} A promise resolving to the authentication response, containing the token.
 */
export const login = (username, password) => {
    return apiClient.post('/login', { username, password });
};

/**
 * Fetches detailed information for a single device by its IP address.
 * @param {string} ip - The IP address of the device.
 * @returns {Promise<object>} A promise that resolves to the device's information.
 */
export const getDeviceInfo = (ip) => {
    return apiClient.get(`/get-device-info/${ip}`);
};

/**
 * Fetches the list of CDP neighbors for a given device.
 * @param {string} ip - The IP address of the device.
 * @returns {Promise<object>} A promise that resolves to the list of neighbors.
 */
export const getDeviceNeighbors = (ip) => {
    return apiClient.get(`/get-device-neighbors/${ip}`);
};

/**
 * Fetches all registered Cacti groups from the backend.
 * @returns {Promise<object>} A promise that resolves to the list of Cacti groups.
 */
export const getCactiGroups = () => {
    return apiClient.get('/groups');
};

/**
 * Fetches information for the initial device to start a map.
 * This is a POST request to align with the original backend endpoint.
 * @param {string} ip - The IP address of the starting device.
 * @returns {Promise<object>} A promise that resolves to the initial device's data.
 */
export const getInitialDevice = (ip) => {
    return apiClient.post('/api/devices', { ip });
};

/**
 * Uploads the generated map image and configuration file to the backend to start a task.
 * @param {FormData} formData - The form data containing the image, config, map name, and Cacti group ID.
 * @returns {Promise<object>} A promise that resolves with the task creation response.
 */
export const createMap = (formData) => {
    return apiClient.post('/create-map', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * Retrieves the status of a background map creation task.
 * @param {string} taskId - The ID of the task to check.
 * @returns {Promise<object>} A promise that resolves with the current task status.
 */
export const getTaskStatus = (taskId) => {
    return apiClient.get(`/task-status/${taskId}`);
};