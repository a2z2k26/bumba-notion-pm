# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-01

### Added

- Initial public release
- `NotionClient` — rate-limited HTTP client with retry and typed errors
- `NotionPublisher` — page/database publisher with block factory and built-in PM schemas
- `GitHubIssueBridge` — bidirectional GitHub Issues ↔ Notion database sync
- `validateConfig` / `assertConfig` — environment-variable validators
- Interactive setup wizard (`bumba-notion-pm init`)
- CLI: `init`, `verify`, `create-db`, `sync`, `config`
- Built-in schemas: Tasks, Sprints, Epics, Projects
- Examples: connection verify, page creation, database creation, GitHub sync
- Test suite (Jest) covering 6 modules / 59 tests
- GitHub Actions CI

[Unreleased]: https://github.com/a2z2k26/bumba-notion-pm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/a2z2k26/bumba-notion-pm/releases/tag/v0.1.0
