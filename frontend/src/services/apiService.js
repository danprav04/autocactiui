// frontend/src/services/apiService.js
import axios from 'axios';

// Create an Axios instance configured to use the backend URL from environment variables.
const apiClient = axios.create({
    baseURL: process.env.REACT_APP_API_URL
});

// Use an interceptor to automatically add the auth token to every request.
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
 * Fetches all registered Cacti installations from the backend.
 * @returns {Promise<object>} A promise that resolves to the list of Cacti installations.
 */
export const getAllCactiInstallations = () => {
    return apiClient.get('/get-all-cacti-installations');
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
 * Uploads the generated map image and configuration file to the backend.
 * @param {FormData} formData - The form data containing the image, config, map name, and Cacti ID.
 * @returns {Promise<object>} A promise that resolves with the result of the upload.
 */
export const uploadMap = (formData) => {
    return apiClient.post('/upload-map', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};