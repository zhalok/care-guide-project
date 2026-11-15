// Needs the seeded demo data (./scripts/seed-docker.sh): alice (admin) and bob
// (user) with 10,000 notes each. The UI loads 20 notes per request.
export const PAGE_SIZE = 20;
// How long the cursor dot takes to glide to its next target.
export const CURSOR_GLIDE_MS = 700;
// Delay between typed characters.
export const TYPING_DELAY_MS = 150;
// Pause after each step so a person watching a headed run can follow along.
export const STEP_PAUSE_MS = 2000;
