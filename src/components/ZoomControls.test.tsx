import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ZoomControls from './ZoomControls';

test('keeps reset zoom and fit-to-tree actions available', () => {
  const onReset = jest.fn();
  const onFit = jest.fn();
  render(
    <ZoomControls
      scale={0.75}
      onZoomIn={jest.fn()}
      onZoomOut={jest.fn()}
      onReset={onReset}
      onFit={onFit}
    />
  );

  expect(screen.getByText('75%')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser le zoom' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tout afficher' }));

  expect(onReset).toHaveBeenCalledTimes(1);
  expect(onFit).toHaveBeenCalledTimes(1);
});