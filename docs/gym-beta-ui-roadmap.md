# Gym beta UI roadmap

The gym beta at `/gym` is a phone-first shell on the existing book. These are the next interface pieces, in the order they unblock a real club trial.

1. **Onboarding.** A first-run path that creates the book, sets a passphrase and 6-digit code, and explains that a workout mints no credit. Needs the existing wallet setup calls and a three-screen flow. No new server.

2. **Accessibility.** Name every control, keep 48px targets, and check the charts with a screen reader. Needs a pass on the gym page only. The charts are already inline SVG.

3. **Notifications.** A local reminder to tap Finish, using the Notifications API if the member allows it. Needs a permission prompt on Start. No push server. Easy to miss on iOS home-screen apps, which limit web notifications.

4. **Wearable import.** A file picker for a member-exported workout file, stored only on the phone, with the same evidence hash. Needs a documented file shape. Do not call a vendor cloud from the page.

5. **Trainer dashboard.** One trainer’s list of sessions waiting for verification, still without ranks or streaks. Needs the group filter that already hides other clubs. It should stay a list, not a scoreboard.

Chat sync, email check, and shared listings stay off until their env switches are set. Chat text does not go to Hedera.
