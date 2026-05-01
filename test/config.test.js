'use strict';

const { validateConfig, assertConfig, isLikelyNotionId } = require('../src/client/config');
const { ConfigError } = require('../src/utils/errors');

describe('validateConfig', () => {
  test('flags missing NOTION_API_KEY', () => {
    const r = validateConfig({});
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/NOTION_API_KEY is required/);
  });

  test('flags malformed NOTION_API_KEY', () => {
    const r = validateConfig({ NOTION_API_KEY: 'badkey' });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/format looks invalid/);
  });

  test('accepts valid secret_-prefixed key', () => {
    const r = validateConfig({
      NOTION_API_KEY: 'secret_' + 'a'.repeat(40),
      NOTION_PARENT_PAGE_ID: 'a'.repeat(32)
    });
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  test('accepts valid ntn_-prefixed key', () => {
    const r = validateConfig({
      NOTION_API_KEY: 'ntn_' + 'a'.repeat(40),
      NOTION_PARENT_PAGE_ID: 'b'.repeat(32)
    });
    expect(r.valid).toBe(true);
  });

  test('warns when parent page id is missing', () => {
    const r = validateConfig({
      NOTION_API_KEY: 'secret_' + 'a'.repeat(40)
    });
    expect(r.warnings.join(' ')).toMatch(/NOTION_PARENT_PAGE_ID/);
  });

  test('warns on malformed parent page id', () => {
    const r = validateConfig({
      NOTION_API_KEY: 'secret_' + 'a'.repeat(40),
      NOTION_PARENT_PAGE_ID: 'not-an-id'
    });
    expect(r.warnings.join(' ')).toMatch(/does not look like a Notion ID/);
  });
});

describe('assertConfig', () => {
  test('returns the config when valid', () => {
    const cfg = assertConfig({
      NOTION_API_KEY: 'secret_' + 'a'.repeat(40),
      NOTION_PARENT_PAGE_ID: 'a'.repeat(32)
    });
    expect(cfg.notionApiKey).toMatch(/^secret_/);
  });

  test('throws ConfigError when invalid', () => {
    expect(() => assertConfig({})).toThrow(ConfigError);
  });
});

describe('isLikelyNotionId', () => {
  test('accepts 32-char hex', () => {
    expect(isLikelyNotionId('a'.repeat(32))).toBe(true);
  });

  test('accepts hyphenated UUID', () => {
    expect(isLikelyNotionId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toBe(true);
  });

  test('rejects garbage', () => {
    expect(isLikelyNotionId('not-an-id')).toBe(false);
    expect(isLikelyNotionId('')).toBe(false);
    expect(isLikelyNotionId(null)).toBe(false);
  });
});
