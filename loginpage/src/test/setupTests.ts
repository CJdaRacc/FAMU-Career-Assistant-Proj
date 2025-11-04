import '@testing-library/jest-dom';
import 'whatwg-fetch';
import { setupServer } from 'msw/node';
import { handlers as defaultHandlers } from './msw/handlers';

// Set up a shared MSW server for all tests. Individual tests can override with server.use(...)
export const server = setupServer(...defaultHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
