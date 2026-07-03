import { describe, expect, it } from "vitest";
import { getAdvertApiErrorMessage } from "../apiErrorMessage";

const translations: Record<string, string> = {
  "post.form.media_required": "Для публикации объявления требуется хотя бы 1 фотография",
  "post.form.description_min": "Описание должно содержать минимум 10 символов",
  "post.select_category": "Выберите категорию",
  "post.select_condition": "Выберите состояние",
  "post.form.location_required": "Местоположение обязательно для публикации",
};

const t = (key: string) => translations[key] ?? key;

describe("getAdvertApiErrorMessage", () => {
  it("uses localized publish-gate detail before BAD_INPUT code", () => {
    expect(
      getAdvertApiErrorMessage(
        { error: "BAD_INPUT", message: "BAD_INPUT", detail: "MEDIA_REQUIRED" },
        t,
        "Ошибка при обновлении",
      ),
    ).toBe("Для публикации объявления требуется хотя бы 1 фотография");
  });

  it("keeps validation details when no advert-specific mapping exists", () => {
    expect(
      getAdvertApiErrorMessage(
        { error: "INVALID_PAYLOAD", detail: "Validation failed: price: Expected number" },
        t,
        "Ошибка при обновлении",
      ),
    ).toBe("Validation failed: price: Expected number");
  });
});
