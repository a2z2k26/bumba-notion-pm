'use strict';

/**
 * Opinionated Notion database schemas for project management.
 *
 * Each schema returns a `properties` object compatible with the Notion API's
 * `databases.create` payload. Schemas are intentionally minimal — extend them
 * by spreading and overriding.
 */

const TASKS = {
  Name: { title: {} },
  Status: {
    select: {
      options: [
        { name: 'Backlog', color: 'gray' },
        { name: 'Todo', color: 'default' },
        { name: 'In Progress', color: 'blue' },
        { name: 'In Review', color: 'yellow' },
        { name: 'Done', color: 'green' },
        { name: 'Blocked', color: 'red' }
      ]
    }
  },
  Priority: {
    select: {
      options: [
        { name: 'P0', color: 'red' },
        { name: 'P1', color: 'orange' },
        { name: 'P2', color: 'yellow' },
        { name: 'P3', color: 'gray' }
      ]
    }
  },
  Assignee: { people: {} },
  'Due Date': { date: {} },
  'GitHub Issue': { url: {} },
  'GitHub Number': { number: { format: 'number' } },
  Labels: { multi_select: { options: [] } },
  'Last Synced': { date: {} }
};

const SPRINTS = {
  Name: { title: {} },
  Status: {
    select: {
      options: [
        { name: 'Planning', color: 'gray' },
        { name: 'Active', color: 'blue' },
        { name: 'Completed', color: 'green' },
        { name: 'Cancelled', color: 'red' }
      ]
    }
  },
  'Start Date': { date: {} },
  'End Date': { date: {} },
  Goal: { rich_text: {} },
  'Story Points': { number: { format: 'number' } }
};

const EPICS = {
  Name: { title: {} },
  Status: {
    select: {
      options: [
        { name: 'Proposed', color: 'gray' },
        { name: 'Approved', color: 'blue' },
        { name: 'In Progress', color: 'yellow' },
        { name: 'Done', color: 'green' },
        { name: 'Cancelled', color: 'red' }
      ]
    }
  },
  Description: { rich_text: {} },
  Owner: { people: {} },
  'Target Date': { date: {} }
};

const PROJECTS = {
  Name: { title: {} },
  Status: {
    select: {
      options: [
        { name: 'Active', color: 'green' },
        { name: 'Paused', color: 'yellow' },
        { name: 'Archived', color: 'gray' }
      ]
    }
  },
  Description: { rich_text: {} },
  Owner: { people: {} },
  Repository: { url: {} }
};

module.exports = { TASKS, SPRINTS, EPICS, PROJECTS };
