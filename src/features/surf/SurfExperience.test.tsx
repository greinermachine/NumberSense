import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalmGlide } from './CalmGlide';
import { getSurfCourse } from './courses';
import SurfExperience from './SurfExperience';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="surf-canvas" />,
  useFrame: vi.fn(),
}));

const originalMatchMedia = window.matchMedia;
const originalPointerLockElement = Object.getOwnPropertyDescriptor(
  document,
  'pointerLockElement',
);
const originalExitPointerLock = Object.getOwnPropertyDescriptor(document, 'exitPointerLock');
const originalRequestPointerLock = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'requestPointerLock',
);

function restoreProperty(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}

function useFinePointer() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  });
  restoreProperty(document, 'pointerLockElement', originalPointerLockElement);
  restoreProperty(document, 'exitPointerLock', originalExitPointerLock);
  restoreProperty(
    HTMLElement.prototype,
    'requestPointerLock',
    originalRequestPointerLock,
  );
});

describe('CalmGlide', () => {
  it('uses a calm, immediately completable path for reduced motion', async () => {
    const onComplete = vi.fn();

    render(<CalmGlide course={getSurfCourse(0)} onComplete={onComplete} />);
    expect(screen.getByText('The near line')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Glide onward' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

describe('interactive surf pointer lock', () => {
  it('pauses on pointer-lock release and resumes after recapture', async () => {
    useFinePointer();
    let lockedElement: Element | null = null;
    const requestPointerLock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => lockedElement,
    });
    Object.defineProperty(document, 'exitPointerLock', {
      configurable: true,
      value: vi.fn(() => {
        lockedElement = null;
      }),
    });
    Object.defineProperty(HTMLElement.prototype, 'requestPointerLock', {
      configurable: true,
      value: requestPointerLock,
    });

    const { container } = render(
      <SurfExperience courseIndex={0} onComplete={vi.fn()} />,
    );
    const shell = container.querySelector('main');
    expect(shell).not.toBeNull();
    expect(shell).toHaveAttribute('data-running', 'false');

    await userEvent.click(screen.getByRole('button', { name: /Enter the line/ }));
    expect(requestPointerLock).toHaveBeenCalledOnce();
    expect(shell).toHaveAttribute('data-running', 'true');
    expect(screen.getByRole('button', { name: 'Capture mouse' })).toBeInTheDocument();

    lockedElement = shell;
    act(() => document.dispatchEvent(new Event('pointerlockchange')));
    expect(shell).toHaveAttribute('data-running', 'true');
    expect(screen.queryByRole('button', { name: 'Capture mouse' })).not.toBeInTheDocument();

    lockedElement = null;
    act(() => document.dispatchEvent(new Event('pointerlockchange')));
    expect(shell).toHaveAttribute('data-running', 'false');
    expect(
      screen.getByRole('button', { name: /Return to the line/ }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Return to the line/ }));
    expect(requestPointerLock).toHaveBeenCalledTimes(2);
    expect(shell).toHaveAttribute('data-running', 'true');

    lockedElement = shell;
    act(() => document.dispatchEvent(new Event('pointerlockchange')));
    expect(shell).toHaveAttribute('data-running', 'true');
    expect(screen.queryByRole('button', { name: 'Capture mouse' })).not.toBeInTheDocument();
  });
});
