---
status: complete
phase: 05-customer-experience-wishlist-profile-native-questionnaire
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md]
started: 2026-06-01T18:04:57Z
updated: 2026-06-02T00:00:00Z
---

## Current Test

[testing complete]

## Tests

<!-- ─── User-flow walk-through (run first) ─── -->

### 1. Cold Start Smoke Test
expected: Kill any running dev server, start fresh (npm run dev:client). Site boots with no errors; homepage/shop loads live product data from Supabase (products render, no blank/crash).
result: pass
note: "Initially failed in production with 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'. Root cause: deploy.yml built with no VITE_ env. Fixed in commit 256400b (env block injecting the 3 public-client vars from GitHub secrets; secrets set via gh). Deploy run succeeded; user confirmed site loads — PASS."

### 2. Save a Product While Logged In
expected: Logged in, on Shop/home tap the heart on a product card. Heart fills (saved state) and the navbar heart count badge increments by one. The card heart does NOT open the product detail modal.
result: pass

### 3. View the Wishlist Page
expected: Click the navbar heart (or Wishlist menu entry) to open /wishlist. The product you just saved appears in the saved-products grid.
result: pass

### 4. Remove From Wishlist
expected: On /wishlist (or via a card heart), remove a saved product. It disappears immediately (no confirm dialog) and the navbar count badge decrements; badge hides at 0.
result: pass

### 5. Complete the Questionnaire Wizard
expected: Go to /questionnaire. It's a native branded multi-step wizard (About you → Your skin → What you're looking for → Review & send), NOT an embedded Google Form. Fill each step, advance with Continue, and submit on the review step. A thank-you finale appears (logged-in shows "View my requests"; anon shows a create-account nudge).
result: pass

### 6. Submission Lands in Admin Inbox
expected: Log into the admin portal and open the Submissions inbox. The questionnaire you just submitted appears as a new row with the correct name/email/skin type, and its detail shows concerns/product interest/allergies under the payload "Details".
result: pass

### 7. View Your Account (Profile)
expected: Logged in, open "Your account" from the navbar dropdown → /profile. Shows account forms (display name, email, password) and a "Your requests" section listing YOUR own questionnaire submissions with date + snippet; clicking one opens a read-only detail dialog.
result: pass

### 8. Update Display Name
expected: On /profile change the display name and Save. "Name updated." toast appears and the new name persists after a page refresh.
result: pass

### 9. Change Password
expected: On /profile set a new password and update. "Password updated." toast appears; logging out and back in with the new password works.
result: pass

### 10. Email Change Is Pending-Confirmation
expected: On /profile change the email and submit. You see "Check your inbox to confirm your new email." (NOT a "changed" message); the login email stays the same until you click the emailed confirmation link.
result: pass

<!-- ─── Technical / edge checks (deferred — run after the user flow passes) ─── -->

### 11. Logged-Out Guard Redirects
expected: While logged OUT, navigating directly to /wishlist and /profile redirects to the sign-in page (login?next=...), and after signing in you land back on the page you requested.
result: pass

### 12. Owner-Scoping (Privacy)
expected: As a DIFFERENT customer, /profile "Your requests" and /wishlist show only THAT customer's own rows — none of the first customer's submissions or saved products leak across accounts.
result: pass

### 13. Anon Questionnaire Submission
expected: While logged OUT, complete and submit /questionnaire. It still succeeds (name/email typed manually, required + email-format validated) and the row lands in the admin inbox with no associated user.
result: pass

### 14. Per-Step Validation Blocks Bad Input
expected: In the questionnaire, leaving a required field blank (or entering an invalid email) prevents Continue from advancing and surfaces a validation message (e.g. "Enter a valid email address.").
result: pass

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Production deploy boots and loads live Supabase data (cold start)"
  status: resolved
  reason: "Production threw 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY' — fixed and verified live"
  severity: blocker
  test: 1
  root_cause: "deploy.yml built with no VITE_* env; .env.local gitignored so CI inlined undefined Supabase URL/key into the bundle"
  resolution: "commit 256400b adds env block (3 public-client vars from GitHub secrets); secrets set via gh; deploy run succeeded; user confirmed site loads"
  artifacts:
    - path: ".github/workflows/deploy.yml"
      issue: "Build client step had no env block for the VITE_ public-client vars (FIXED)"
