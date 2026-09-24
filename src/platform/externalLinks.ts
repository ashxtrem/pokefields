import { Browser } from "@capacitor/browser";

export const PRIVACY_POLICY_URL =
  "https://pokefields-privacy.pages.dev/privacy";

export async function openPrivacyPolicy(): Promise<void> {
  await Browser.open({ url: PRIVACY_POLICY_URL });
}
