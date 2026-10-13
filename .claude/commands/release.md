---
description: Update CHANGELOG.md from the commits since the last tag, then run the release
argument-hint: [version, e.g. 0.2.0]
---

Release Plume. Version argument: `$ARGUMENTS`

1. Find the last tag (`git describe --tags --abbrev=0`) and read the commits since it (`git log <tag>..HEAD --format='%h %s'`), ignoring `release:` commits. Skim the diffs if a message is unclear.
2. Version: use `$ARGUMENTS` if given. Otherwise propose one (patch for fixes only, minor when features were added) and ask me to confirm before going on.
3. Add a new section at the top of `CHANGELOG.md`, right under the intro, following the existing format exactly: `## [X.Y.Z] - YYYY-MM-DD` (today's date), then `### Ajouté` / `### Modifié` / `### Corrigé` (only the ones that apply). Write in French, from the user's point of view: short sentences describing what changed in the app, not commit messages. Leave out refactors, CI, docs and other changes users cannot see.
4. Show me the new section and wait for my OK.
5. Run `pnpm release X.Y.Z` from the repo root. The script commits `package.json` and `CHANGELOG.md` together, pushes, and pushes the `vX.Y.Z` tag, which triggers the GitHub Actions build. Do not commit the changelog separately.
6. Report the result (or the script's error) faithfully.

Never add `Co-Authored-By` or any AI attribution anywhere.
