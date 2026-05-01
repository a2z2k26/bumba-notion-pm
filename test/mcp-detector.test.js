'use strict';

const { MCPDetector } = require('../src/mcp/detector');

describe('MCPDetector', () => {
  beforeEach(() => {
    delete process.env.NOTION_MCP_ENABLED;
    delete process.env.NOTION_MCP_COMMAND;
    delete process.env.NOTION_MCP_SERVER_URL;
    delete process.env.NOTION_MCP_SOCKET;
  });

  test('returns not-available when no MCP signals are present', async () => {
    const detector = new MCPDetector({ httpTimeoutMs: 50, ipcTimeoutMs: 50 });
    const result = await detector.detect();
    expect(result.available).toBe(false);
    expect(result.method).toBe('none');
  });

  test('caches results within the TTL', async () => {
    const detector = new MCPDetector({ cacheTtlMs: 5000, httpTimeoutMs: 50, ipcTimeoutMs: 50 });
    const a = await detector.detect();
    const b = await detector.detect();
    expect(a).toBe(b);
  });

  test('clearCache forces re-detection', async () => {
    const detector = new MCPDetector({ cacheTtlMs: 60000, httpTimeoutMs: 50, ipcTimeoutMs: 50 });
    const a = await detector.detect();
    detector.clearCache();
    const b = await detector.detect();
    expect(a).not.toBe(b);
    expect(a.available).toBe(b.available);
  });

  test('env method recognizes NOTION_MCP_ENABLED + URL', async () => {
    process.env.NOTION_MCP_ENABLED = 'true';
    process.env.NOTION_MCP_SERVER_URL = 'http://example.invalid:9999';
    const detector = new MCPDetector({ httpTimeoutMs: 50, ipcTimeoutMs: 50 });
    const result = await detector.detect();
    // HTTP probe will fail (invalid host) but env method should still match
    expect(result.available).toBe(true);
    expect(['http', 'env']).toContain(result.method);
  });

  test('env method ignores enabled-without-config', async () => {
    process.env.NOTION_MCP_ENABLED = 'true';
    const detector = new MCPDetector({ httpTimeoutMs: 50, ipcTimeoutMs: 50 });
    const result = await detector.detect();
    expect(result.available).toBe(false);
  });
});
