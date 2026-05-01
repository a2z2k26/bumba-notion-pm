'use strict';

const { HttpTransport, NoopTransport } = require('../src/mcp/transports');
const { AuthError, NotFoundError, RateLimitError, NotionError } = require('../src/utils/errors');

function makeFakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fetchImpl = jest.fn(async (url, init) => {
    calls.push({ url, init });
    if (queue.length === 0) throw new Error('no fake response queued');
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

describe('HttpTransport', () => {
  test('throws on missing baseUrl', () => {
    expect(() => new HttpTransport({ fetchImpl: jest.fn() })).toThrow();
  });

  test('throws when no fetchImpl is provided and no global fetch exists', () => {
    const originalFetch = global.fetch;
    delete global.fetch;
    try {
      expect(() => new HttpTransport({ baseUrl: 'http://x' })).toThrow();
    } finally {
      if (originalFetch) global.fetch = originalFetch;
    }
  });

  test('invokes server and returns result', async () => {
    const fetchImpl = makeFakeFetch([jsonResponse(200, { ok: true, result: { id: 'p1' } })]);
    const transport = new HttpTransport({ baseUrl: 'http://srv', fetchImpl });
    const result = await transport.invoke('pages.create', { x: 1 });
    expect(result).toEqual({ id: 'p1' });
    const call = fetchImpl.calls[0];
    expect(call.url).toBe('http://srv/invoke');
    expect(JSON.parse(call.init.body)).toEqual({ operation: 'pages.create', params: { x: 1 } });
  });

  test('strips trailing slash from baseUrl', async () => {
    const fetchImpl = makeFakeFetch([jsonResponse(200, { ok: true, result: 'x' })]);
    const transport = new HttpTransport({ baseUrl: 'http://srv/', fetchImpl });
    await transport.invoke('search', {});
    expect(fetchImpl.calls[0].url).toBe('http://srv/invoke');
  });

  test('401 → AuthError', async () => {
    const fetchImpl = makeFakeFetch([
      jsonResponse(401, { ok: false, error: { code: 'unauthorized', message: 'no auth' } })
    ]);
    const transport = new HttpTransport({ baseUrl: 'http://srv', fetchImpl });
    await expect(transport.invoke('pages.create', {})).rejects.toBeInstanceOf(AuthError);
  });

  test('404 → NotFoundError', async () => {
    const fetchImpl = makeFakeFetch([
      jsonResponse(404, { ok: false, error: { code: 'not_found', message: 'gone' } })
    ]);
    const transport = new HttpTransport({ baseUrl: 'http://srv', fetchImpl });
    await expect(transport.invoke('pages.retrieve', { page_id: 'x' })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  test('429 → RateLimitError', async () => {
    const fetchImpl = makeFakeFetch([
      jsonResponse(429, { ok: false, error: { code: 'rate_limited' } })
    ]);
    const transport = new HttpTransport({ baseUrl: 'http://srv', fetchImpl });
    await expect(transport.invoke('search', {})).rejects.toBeInstanceOf(RateLimitError);
  });

  test('body ok=false with 200 still throws', async () => {
    const fetchImpl = makeFakeFetch([
      jsonResponse(200, { ok: false, error: { message: 'business logic failure' } })
    ]);
    const transport = new HttpTransport({ baseUrl: 'http://srv', fetchImpl });
    await expect(transport.invoke('pages.create', {})).rejects.toBeInstanceOf(NotionError);
  });

  test('result lifted from { ok, result } envelope', async () => {
    const fetchImpl = makeFakeFetch([jsonResponse(200, { ok: true, result: { value: 42 } })]);
    const transport = new HttpTransport({ baseUrl: 'http://srv', fetchImpl });
    expect(await transport.invoke('test', {})).toEqual({ value: 42 });
  });
});

describe('NoopTransport', () => {
  test('always throws on invoke', async () => {
    const transport = new NoopTransport();
    await expect(transport.invoke('pages.create')).rejects.toThrow();
  });

  test('close is a no-op', async () => {
    const transport = new NoopTransport();
    await expect(transport.close()).resolves.toBeUndefined();
  });
});
