import type { Metadata } from "next";
import { SecuritySettingsClient } from "./SecuritySettingsClient";

export const metadata: Metadata = {
  title: "Security settings | LyVoX",
  description:
    "Manage account security, two-factor authentication, and active sessions for your LyVoX account.",
};

export default function SecuritySettingsPage() {
  return <SecuritySettingsClient />;
}
