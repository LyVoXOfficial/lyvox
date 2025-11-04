/**
 * Security Settings Page
 * 
 * Страница настроек безопасности профиля:
 * - Управление биометрическими ключами
 * - Просмотр активных сессий
 * - Отключение всех устройств
 * - Управление доверенными устройствами
 */

import { Metadata } from "next";
import { SecuritySettingsClient } from "./SecuritySettingsClient";

export const metadata: Metadata = {
  title: "Настройки безопасности | LyVoX",
  description: "Управление безопасностью аккаунта, биометрической авторизацией и активными сессиями",
};

export default function SecuritySettingsPage() {
  return <SecuritySettingsClient />;
}

