import { useSyncExternalStore } from 'react';

export type Listener = () => void;

/**
 * Minimal observable store — the "ViewModel" half of MVVM.
 *
 * Controllers extend this class, hold the whole screen state, expose action methods
 * and notify subscribers. Because they are plain TypeScript classes, they can be unit
 * tested without rendering React (see `__tests__/tasks-controller.test.ts`).
 */
export class ObservableStore<S extends object> {
  private listeners = new Set<Listener>();

  constructor(protected current: S) {}

  getState = (): S => this.current;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected setState(patch: Partial<S>): void {
    this.current = { ...this.current, ...patch };
    this.emit();
  }

  protected emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** React binding: re-renders the screen whenever the controller publishes new state. */
export function useStore<S extends object>(store: ObservableStore<S>): S {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
