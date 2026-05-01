'use strict';

const { NotionClient } = require('../client/notion-client');
const blocks = require('./blocks');
const schemas = require('./schemas');
const { ConfigError, ValidationError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * NotionPublisher — high-level page and database publishing.
 *
 * @example
 *   const publisher = new NotionPublisher({
 *     apiKey: process.env.NOTION_API_KEY,
 *     parentPageId: process.env.NOTION_PARENT_PAGE_ID
 *   });
 *   const page = await publisher.publishPage({
 *     title: 'Hello',
 *     blocks: [publisher.blocks.heading('Welcome')]
 *   });
 */
class NotionPublisher {
  constructor(options = {}) {
    this.client =
      options.client ||
      new NotionClient({
        apiKey: options.apiKey,
        notionVersion: options.notionVersion
      });
    this.defaultParentPageId = options.parentPageId || process.env.NOTION_PARENT_PAGE_ID || null;
  }

  /** Block factory helpers, exposed for convenience. */
  get blocks() {
    return blocks;
  }

  /** Built-in schemas (TASKS, SPRINTS, EPICS, PROJECTS). */
  get schemas() {
    return schemas;
  }

  /**
   * Create a Notion page under the given parent (page or database).
   *
   * @param {object} spec
   * @param {string} spec.title — page title
   * @param {Array}  [spec.blocks=[]] — block children to append
   * @param {string} [spec.parentPageId] — overrides defaultParentPageId
   * @param {string} [spec.parentDatabaseId] — create as a row in this database
   * @param {object} [spec.properties] — required when parentDatabaseId is set
   * @param {object} [spec.icon]
   * @param {object} [spec.cover]
   */
  async publishPage(spec) {
    if (!spec || !spec.title) {
      throw new ValidationError('publishPage requires a `title`');
    }
    const parent = this._resolveParent(spec);

    const payload = {
      parent,
      properties: spec.parentDatabaseId
        ? this._mergeTitleIntoProperties(spec.properties || {}, spec.title)
        : { title: { title: blocks.richText(spec.title) } },
      children: spec.blocks || []
    };
    if (spec.icon) payload.icon = spec.icon;
    if (spec.cover) payload.cover = spec.cover;

    const page = await this.client.pages.create(payload);
    logger.info(`Created page id=${page.id} title=${JSON.stringify(spec.title)}`);
    return page;
  }

  /**
   * Append additional blocks to an existing page.
   */
  async appendBlocks(pageId, children) {
    if (!pageId) throw new ValidationError('appendBlocks requires pageId');
    if (!Array.isArray(children) || children.length === 0) {
      throw new ValidationError('appendBlocks requires a non-empty children array');
    }
    return this.client.blocks.children.append({
      block_id: pageId,
      children
    });
  }

  /**
   * Create a database under the configured parent page.
   *
   * @param {object} spec
   * @param {string} spec.title
   * @param {object} spec.properties — Notion API properties object
   * @param {string} [spec.parentPageId]
   */
  async createDatabase(spec) {
    if (!spec || !spec.title || !spec.properties) {
      throw new ValidationError('createDatabase requires `title` and `properties`');
    }
    const parentPageId = spec.parentPageId || this.defaultParentPageId;
    if (!parentPageId) {
      throw new ConfigError('createDatabase requires parentPageId (or set NOTION_PARENT_PAGE_ID)');
    }
    const payload = {
      parent: { type: 'page_id', page_id: parentPageId },
      title: blocks.richText(spec.title),
      properties: spec.properties
    };
    if (spec.icon) payload.icon = spec.icon;
    return this.client.databases.create(payload);
  }

  /**
   * Convenience: create one of the built-in PM databases.
   * @param {'tasks'|'sprints'|'epics'|'projects'} kind
   * @param {string} title
   * @param {object} [overrides] — extra/override properties
   */
  async createPMDatabase(kind, title, overrides = {}) {
    const key = String(kind || '').toUpperCase();
    const baseSchema = this.schemas[key];
    if (!baseSchema) {
      throw new ValidationError(`Unknown PM database kind: ${kind}`);
    }
    return this.createDatabase({
      title,
      properties: { ...baseSchema, ...overrides }
    });
  }

  _resolveParent(spec) {
    if (spec.parentDatabaseId) {
      return { type: 'database_id', database_id: spec.parentDatabaseId };
    }
    const pageId = spec.parentPageId || this.defaultParentPageId;
    if (!pageId) {
      throw new ConfigError(
        'publishPage requires parentPageId or parentDatabaseId (or set NOTION_PARENT_PAGE_ID)'
      );
    }
    return { type: 'page_id', page_id: pageId };
  }

  _mergeTitleIntoProperties(properties, title) {
    const result = { ...properties };
    const titleKey = Object.keys(result).find((k) => result[k]?.title) || 'Name';
    result[titleKey] = { title: blocks.richText(title) };
    return result;
  }
}

module.exports = { NotionPublisher };
