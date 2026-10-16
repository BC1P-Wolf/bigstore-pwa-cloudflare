import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Vendário PWA application', () => {
  render(<App />);
  const titleElement = screen.getByText(/Vendário/i);
  expect(titleElement).toBeInTheDocument();
});
