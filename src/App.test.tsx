import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  // L'application charge ses données depuis api.php au montage
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ ok: true, members: [], settings: {} }),
    })
  ) as jest.Mock;
});

test("affiche le titre de l'application", () => {
  render(<App />);
  expect(screen.getByText('Arbre Généalogique')).toBeInTheDocument();
});
