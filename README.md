# SBU 2026

Shared hackathon project. Application code and run commands will be added once the team chooses the idea and stack.

## Team workflow

1. Clone the shared GitHub repository and open that folder in Codex using your own account.
2. Before starting a task, run `git switch main` and `git pull --ff-only` with a clean working tree.
3. Create a short-lived branch: `git switch -c your-name/feature`.
4. Build one small feature, check it locally, commit, and push your branch.
5. Open a pull request into `main`. Have a teammate review it and squash merge when ready.
6. Pull the updated `main` before the next task.

Keep `main` ready to demo. Assign a person to each feature and coordinate before editing the same files. Prefer small pull requests that can be merged quickly.

## Secrets and setup

Keep API keys in a local `.env` file. Commit an `.env.example` containing variable names and placeholder values only. Share actual secrets through a secure channel.

## Before submission

- Confirm the hackathon's repository visibility and submission requirements.
- Add installation, run, and demo instructions here.
- Test the demo from a fresh clone.
- Record the submission commit and avoid last-minute untested merges.
