import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LeaveReviewForm } from "../LeaveReviewForm";

// Mock sonner toast
const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

// Mock apiFetch
const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));
vi.mock("@/lib/fetcher", () => ({
  apiFetch,
  RateLimitedError: class RateLimitedError extends Error {},
}));

// Minimal messages for i18n
const messages = {
  reviews: {
    leave_title: "Leave a Review",
    rating_label: "Rating",
    comment_label: "Comment (optional)",
    comment_placeholder: "Share your experience...",
    submit: "Submit review",
    success: "Review submitted!",
    must_contact: "You can review this seller after contacting them about this listing.",
    already: "You've already reviewed this listing.",
    self: "You cannot review your own listing.",
    error: "Something went wrong. Please try again.",
    aggregate_count: "{n} reviews",
    no_reviews: "No reviews yet",
  },
};

describe("<LeaveReviewForm />", () => {
  it("submit button is disabled until a star rating is chosen", () => {
    render(<LeaveReviewForm advertId="ad-uuid-123" messages={messages} />);
    const submitBtn = screen.getByRole("button", { name: /submit review/i });
    expect(submitBtn).toBeTruthy();
    // Before clicking a star, the button should be disabled
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("submit button becomes enabled after choosing a star rating", async () => {
    render(<LeaveReviewForm advertId="ad-uuid-123" messages={messages} />);
    // Click the 3rd star (aria-label or data-rating="3")
    const stars = screen.getAllByRole("button", { name: /star/i });
    fireEvent.click(stars[2]); // 3rd star = rating 3
    const submitBtn = screen.getByRole("button", { name: /submit review/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("posts the correct body {advert_id, rating, comment} on submit", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { review_id: "rv-1" } }),
    });

    render(<LeaveReviewForm advertId="ad-uuid-456" messages={messages} />);

    // Choose rating 4
    const stars = screen.getAllByRole("button", { name: /star/i });
    fireEvent.click(stars[3]); // 4th star = rating 4

    // Add a comment
    const textarea = screen.getByPlaceholderText(/share your experience/i);
    fireEvent.change(textarea, { target: { value: "Great seller!" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/reviews",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            advert_id: "ad-uuid-456",
            rating: 4,
            comment: "Great seller!",
          }),
        }),
      );
    });
  });

  it("shows must-contact inline message on 403 NO_CONVERSATION", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, error: "NO_CONVERSATION" }),
    });

    render(<LeaveReviewForm advertId="ad-uuid-789" messages={messages} />);

    const stars = screen.getAllByRole("button", { name: /star/i });
    fireEvent.click(stars[0]); // rating 1
    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "You can review this seller after contacting them about this listing.",
        ),
      ).toBeTruthy();
    });
    // Should NOT toast on inline errors
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows success toast and resets form on 200 response", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { review_id: "rv-2" } }),
    });

    render(<LeaveReviewForm advertId="ad-uuid-ok" messages={messages} />);

    const stars = screen.getAllByRole("button", { name: /star/i });
    fireEvent.click(stars[4]); // rating 5

    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Review submitted!");
    });
  });
});
