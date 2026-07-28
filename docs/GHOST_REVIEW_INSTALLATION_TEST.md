# GHOST Review installation test

This pull request is an installation smoke test created on 2026-07-28.

Expected results:

- GitHub Actions publishes `Build and docs` and `Domain verification` checks.
- GHOST Review publishes its Check Run, summary, review guide, and installation help without duplicate components.
- The repository configuration enables direct-push review for `main`, `release/**`, and `hotfix/**` after this pull request is merged.
- High-severity direct-push findings may automatically create Issues after merge.
- Conflict analysis remains read-only because fix branches are disabled.

No game runtime behavior is changed by this test.
