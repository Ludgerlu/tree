import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePanZoom } from './usePanZoom';

function PanZoomProbe() {
  const { containerRef, scale } = usePanZoom();
  return (
    <div ref={containerRef} data-testid="canvas">
      <output>{scale}</output>
    </div>
  );
}

function touchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches });
  return event;
}

test('pinch gestures zoom the canvas in and out', () => {
  const { getByTestId } = render(<PanZoomProbe />);
  const canvas = getByTestId('canvas');

  fireEvent(canvas, touchEvent('touchstart', [
    { clientX: 20, clientY: 40 },
    { clientX: 80, clientY: 40 },
  ]));
  fireEvent(canvas, touchEvent('touchmove', [
    { clientX: 0, clientY: 40 },
    { clientX: 100, clientY: 40 },
  ]));
  expect(screen.getByText('1.6666666666666667')).toBeInTheDocument();

  fireEvent(canvas, touchEvent('touchmove', [
    { clientX: 35, clientY: 40 },
    { clientX: 65, clientY: 40 },
  ]));
  expect(screen.getByText('0.5')).toBeInTheDocument();
});

test('rebases one-finger panning when a pinch ends', () => {
  const { getByTestId } = render(<PanZoomProbe />);
  const canvas = getByTestId('canvas');
  canvas.scrollLeft = 300;

  fireEvent(canvas, touchEvent('touchstart', [
    { clientX: 20, clientY: 40 },
    { clientX: 80, clientY: 40 },
  ]));
  fireEvent(canvas, touchEvent('touchmove', [
    { clientX: 0, clientY: 40 },
    { clientX: 100, clientY: 40 },
  ]));
  fireEvent(canvas, touchEvent('touchend', [{ clientX: 100, clientY: 40 }]));
  fireEvent(canvas, touchEvent('touchmove', [{ clientX: 110, clientY: 40 }]));

  expect(canvas.scrollLeft).toBe(290);
});