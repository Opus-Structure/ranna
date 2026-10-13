/** `npm run vapid`: prints a fresh VAPID key pair for Web Push. Paste into .env.local. */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.info(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.info(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
