import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsModal from './SettingsModal';
import { Settings } from '../types';

const settings: Settings = {
  treeName: 'My family',
  theme: 0,
  orientation: 'top',
  visibleGenerations: 2,
};

function renderSettings(overrides: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  const props: React.ComponentProps<typeof SettingsModal> = {
    open: true,
    settings,
    onClose: jest.fn(),
    onSave: jest.fn(),
    onImportFile: jest.fn(() => Promise.resolve()),
    onExportJSON: jest.fn(),
    onClearAll: jest.fn(() => Promise.resolve()),
    isAuth: true,
    ...overrides,
  };
  render(<SettingsModal {...props} />);
  return props;
}

test('saves the chosen number of visible generations', () => {
  const props = renderSettings();
  fireEvent.change(screen.getByLabelText('Générations visibles au départ'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

  expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ visibleGenerations: 4 }));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('requires typing EFFACER before clearing all family data', async () => {
  const props = renderSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Tout effacer…' }));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirmer la suppression' })).toBeDisabled();
  expect(props.onClearAll).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Saisissez EFFACER pour confirmer'), { target: { value: 'EFFACER' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));

  await waitFor(() => expect(props.onClearAll).toHaveBeenCalledTimes(1));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('labels JSON export as a restorable data backup', () => {
  const props = renderSettings();
  fireEvent.click(screen.getByRole('button', { name: '📦 Sauvegarder les données (JSON)' }));
  expect(props.onExportJSON).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/peut être réimporté pour restaurer l’arbre/)).toBeInTheDocument();
});