import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the i18next library to provide controlled translations for the test environment.
// This prevents tests from failing due to translation loading issues and makes them more stable.
jest.mock('react-i18next', () => ({
  useTranslation: () => {
    return {
      t: (key) => {
        // Provide mock translations for keys used in the initial render.
        const translations = {
          'startup.title': 'Interactive Network Map Creator',
          'startup.placeholderIp': 'Enter starting device IP'
        };
        return translations[key] || key;
      },
      i18n: {
        changeLanguage: () => new Promise(() => {}),
        language: 'en', // Set a default language for testing
      },
    };
  },
}));

// Mock the apiService to prevent actual network calls during tests.
jest.mock('./services/apiService', () => ({
    getAllCactiInstallations: jest.fn().mockResolvedValue({ data: { status: 'success', data: [] } }),
    getInitialDevice: jest.fn(),
    getDeviceNeighbors: jest.fn(),
    getDeviceInfo: jest.fn(),
    uploadMap: jest.fn(),
}));


test('renders the startup screen on initial load', () => {
  render(<App />);
  
  // Verify the main title of the startup screen is displayed.
  const headingElement = screen.getByText(/Interactive Network Map Creator/i);
  expect(headingElement).toBeInTheDocument();

  // Verify that the IP address input field is rendered.
  const inputElement = screen.getByPlaceholderText(/Enter starting device IP/i);
  expect(inputElement).toBeInTheDocument();
});