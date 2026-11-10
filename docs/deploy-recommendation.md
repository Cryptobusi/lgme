# How to deploy lgme

lgme.app should stay a PWA until the owner accepts the testnet review. Mainnet writes stay closed until that acceptance. The installed icon already opens Health, or the saved personal page, with no splash.

## Recommendation

Ship the PWA only. Do not wrap it for the Play Store or the App Store yet.

The product is a phone book: Health, a local tape, and testnet hashes. Members install it from the browser. Android and desktop get the install prompt. iPhone gets the Add to Home Screen hint. Email sign-in and the device profile stay on the phone. That is enough to learn whether people return.

A store wrapper costs review time and can be rejected for a wallet and a health record before the testnet review is accepted. Wait.

## The three paths

**PWA only.** Cost is the hosting already in use. Effort is the manifest, the service worker, and the install hint, which are in place. Review risk is none, because there is no store. It unlocks the install icon, offline pages, Web Share, passkeys, camera, and badging where the browser allows them. iOS push works only at 16.4 or newer, and only after the icon is on the Home Screen. Contact Picker is Chromium-only. Background sync is not reliable on iOS. Bluetooth and USB depend on the browser and a user gesture.

**PWA plus TWA (Bubblewrap, Play Store).** Cost is a Play Console account, about $25 once. Effort is a Bubblewrap build of the same site, a signing key, and a listing. Review risk is moderate: a wallet and health wording can draw questions. It unlocks an install from the Play Store and a fuller Android Chrome surface, including Contact Picker and notification channels. It does not add iOS push, and it does not change the Hedera rule.

**Capacitor for the App Store.** Cost is the Apple Developer Program, about $99 a year, plus the Play fee if both stores are used. Effort is a native project, icons, a privacy nutrition label, and store review. Review risk is the highest: health data, a crypto payment link, and account deletion rules. It can unlock iOS push with more reliability, background modes, and a share sheet. Contact Picker and WebGPU still depend on the web view. A wrapper does not make mainnet safe.

## What not to do yet

Do not submit a store build to “unlock” device features that the PWA already reaches on Android. Do not turn on mainnet topics or transactions. The testnet review is the gate. After the owner accepts it, a TWA is the smaller next step if a store icon is wanted. Capacitor waits until there is a store requirement the PWA cannot meet.
