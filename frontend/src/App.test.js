import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the main application without crashing', () => {
  render(<App />);
  const headingElement = screen.getByText(/Interactive Network Map Creator/i);
  expect(headingElement).toBeInTheDocument();
});