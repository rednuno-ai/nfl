// =============================================================================
// A minimal Zustand-equivalent store factory.
// -----------------------------------------------------------------------------
// Per the brief ("Zustand ou solução equivalente simples"): this sandbox has
// no npm registry access, so `zustand` itself can't be installed here. Its
// entire public surface for this app's needs — get/set/subscribe plus a
// `useStore` hook built on React's built-in `useSyncExternalStore` — is about
// 30 lines, so it's reproduced directly rather than blocked on the package.
// The real deployment can install `zustand` and swap this file's internals
// 1:1 if preferred; every screen only ever calls `useGameStore(selector)`,
// so the migration is a single-file change.
// =============================================================================

import { useSyncExternalStore } from "react";

export interface StoreApi<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T extends object>(initializer: (set: StoreApi<T>["setState"], get: StoreApi<T>["getState"]) => T): StoreApi<T> {
  let state: T;
  const listeners = new Set<() => void>();

  const setState: StoreApi<T>["setState"] = (partial) => {
    const partialState = typeof partial === "function" ? (partial as (s: T) => Partial<T>)(state) : partial;
    state = { ...state, ...partialState };
    listeners.forEach((listener) => listener());
  };

  const getState = () => state;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  state = initializer(setState, getState);

  return { getState, setState, subscribe };
}

export function createUseStore<T extends object>(api: StoreApi<T>) {
  return function useStore<U>(selector: (state: T) => U): U {
    return useSyncExternalStore(
      api.subscribe,
      () => selector(api.getState()),
      () => selector(api.getState())
    );
  };
}
