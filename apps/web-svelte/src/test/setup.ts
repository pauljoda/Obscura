import "@testing-library/jest-dom/vitest";

Object.defineProperty(globalThis.HTMLMediaElement.prototype, "load", {
  configurable: true,
  writable: true,
  value() {},
});

Object.defineProperty(globalThis.HTMLMediaElement.prototype, "play", {
  configurable: true,
  writable: true,
  value() {
    return Promise.resolve();
  },
});

Object.defineProperty(globalThis.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  writable: true,
  value() {},
});

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// JSDOM doesn't implement matchMedia. Svelte 5's reactivity layer uses
// it via tweened/spring stores and the prefers-reduced-motion hook.
if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
