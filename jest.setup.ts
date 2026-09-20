import '@testing-library/jest-dom'

if (typeof globalThis.structuredClone !== 'function') {
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    value: <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T,
    writable: true,
  })
}