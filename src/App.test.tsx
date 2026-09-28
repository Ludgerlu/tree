import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

test('opens the export modal from the bottom navigation', () => {
  render(<App />);
  const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });

  fireEvent.click(within(navigation).getByRole('button', { name: 'Exporter' }));

  expect(screen.getByRole('heading', { name: 'Exporter' })).toBeInTheDocument();
});

test('searches for a person and highlights their tree card', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({
        ok: true,
        members: [{
          id: 'member-ada',
          firstname: 'Ada',
          lastname: 'Lovelace',
          gender: 'F',
          birth: null,
          birthplace: null,
          death: null,
          deathplace: null,
          parentId: null,
          spouseId: null,
          notes: null,
          photo: null,
        }],
        settings: {},
      }),
    })
  ) as jest.Mock;

  const { container } = render(<App />);
  await waitFor(() => {
    expect(container.querySelector('[data-id="member-ada"]')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Rechercher une personne' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une personne' }), {
    target: { value: 'Ada Lovelace' },
  });
  fireEvent.submit(screen.getByRole('searchbox', { name: 'Rechercher une personne' }).closest('form')!);

  expect(container.querySelector('.zoom-search-status')).toHaveTextContent('Recherche en cours');
  expect(container.querySelector('.zoom-search-status .search-spinner')).toBeInTheDocument();

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  });
  expect(container.querySelector('.zoom-search-status')).toHaveTextContent('Ada Lovelace trouvé');
  await waitFor(() => {
    expect(container.querySelector('[data-id="member-ada"]')).toHaveClass('search-highlight');
  });
});

test('asks the user to choose when multiple people share a name', async () => {
  const person = (id: string, birth: string) => ({
    id,
    firstname: 'Alex',
    lastname: 'Martin',
    gender: 'N',
    birth,
    birthplace: null,
    death: null,
    deathplace: null,
    parentId: null,
    spouseId: null,
    notes: null,
    photo: null,
  });
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({
        ok: true,
        members: [person('alex-1', '1980-01-01'), person('alex-2', '2001-01-01')],
        settings: {},
      }),
    })
  ) as jest.Mock;

  const { container } = render(<App />);
  await waitFor(() => {
    expect(container.querySelectorAll('.node-group')).toHaveLength(2);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Rechercher une personne' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une personne' }), {
    target: { value: 'Alex Martin' },
  });
  fireEvent.submit(screen.getByRole('searchbox', { name: 'Rechercher une personne' }).closest('form')!);

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  });

  expect(screen.getByText('2 personnes trouvées. Choisissez la bonne personne.')).toBeInTheDocument();
  expect(screen.getByText('Né(e) 1980')).toBeInTheDocument();
  expect(screen.getByText('Né(e) 2001')).toBeInTheDocument();
  expect(container.querySelectorAll('.node-group.search-highlight')).toHaveLength(0);

  fireEvent.click(screen.getByRole('button', { name: /Né\(e\) 2001/ }));

  expect(container.querySelector('[data-id="alex-2"]')).toHaveClass('search-highlight');
  expect(container.querySelector('[data-id="alex-1"]')).not.toHaveClass('search-highlight');
});
