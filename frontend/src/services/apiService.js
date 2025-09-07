// frontend/src/services/apiService.js
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
});

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