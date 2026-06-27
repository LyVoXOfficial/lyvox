import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---- Mocks (hoisted before imports) ------------------------------------------

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));
vi.mock("@/lib/fetcher", () => ({
  apiFetch,
  RateLimitedError: class RateLimitedError extends Error {},
}));

const { mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// ---- Helpers ------------------------------------------------------------------

import { TeamManager } from "../TeamManager";

const messages = {
  team: {
    title: "Team",
    invite: "Invite member",
    email_label: "Email address",
    role_label: "Role",
    role_member: "Member",
    role_admin: "Admin",
    invite_btn: "Invite",
    pending: "Pending",
    remove: "Remove",
    accept_invite: "Accept invitation to {business}",
    invited_ok: "Invitation sent",
    user_not_found: "User must register first",
    already_member: "Already a member",
    invite_error: "Could not send invitation",
    removed_ok: "Member removed",
    accepted_ok: "Invitation accepted",
  },
};

const ownerMember = {
  user_id: "owner-id",
  role: "owner" as const,
  accepted_at: "2024-01-01T00:00:00Z",
  display_name: "Owner User",
};

const adminMember = {
  user_id: "admin-id",
  role: "admin" as const,
  accepted_at: "2024-01-02T00:00:00Z",
  display_name: "Admin User",
};

const regularMember = {
  user_id: "member-id",
  role: "member" as const,
  accepted_at: "2024-01-03T00:00:00Z",
  display_name: "Regular Member",
};

const pendingMember = {
  user_id: "pending-id",
  role: "member" as const,
  accepted_at: null,
  display_name: "Pending User",
};

const viewerPendingMember = {
  user_id: "viewer-id",
  role: "member" as const,
  accepted_at: null,
  display_name: "The Viewer",
};

function renderManager(overrides: Partial<React.ComponentProps<typeof TeamManager>> = {}) {
  const defaults: React.ComponentProps<typeof TeamManager> = {
    businessId: "biz-123",
    businessName: "Acme Corp",
    members: [ownerMember, regularMember],
    viewerId: "admin-id",
    viewerRole: "admin",
    locale: "en",
    messages,
  };
  return render(<TeamManager {...defaults} {...overrides} />);
}

// ---- Tests -------------------------------------------------------------------

describe("<TeamManager />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Pending chip ─────────────────────────────────────────────────────────────

  it("shows a Pending chip for members with accepted_at == null", () => {
    renderManager({
      members: [ownerMember, pendingMember],
    });
    expect(screen.getByText("Pending")).toBeTruthy();
  });

  it("does not show Pending chip for accepted members", () => {
    renderManager({ members: [ownerMember, regularMember] });
    expect(screen.queryByText("Pending")).toBeNull();
  });

  // ── Invite form visibility ───────────────────────────────────────────────────

  it("shows invite form when viewer is admin", () => {
    renderManager({ viewerId: "admin-id", viewerRole: "admin", members: [ownerMember, adminMember, regularMember] });
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("shows invite form when viewer is owner", () => {
    renderManager({ viewerId: "owner-id", viewerRole: "owner" });
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("hides invite form when viewer is a plain member", () => {
    renderManager({ viewerId: "member-id", viewerRole: "member" });
    expect(screen.queryByLabelText("Email address")).toBeNull();
  });

  // ── Invite form — happy path ─────────────────────────────────────────────────

  it("POSTs the correct body when invite form is submitted", async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ ok: true, data: { invited: true } }),
    });

    renderManager({ viewerRole: "owner", viewerId: "owner-id" });

    const emailInput = screen.getByLabelText("Email address");
    const roleSelect = screen.getByLabelText("Role");
    const inviteBtn = screen.getByRole("button", { name: "Invite" });

    fireEvent.change(emailInput, { target: { value: "newuser@example.com" } });
    fireEvent.change(roleSelect, { target: { value: "admin" } });
    fireEvent.click(inviteBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/business/biz-123/members",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "newuser@example.com", role: "admin" }),
        }),
      );
      expect(toast.success).toHaveBeenCalledWith("Invitation sent");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  // ── Invite form — 409 ALREADY_MEMBER ────────────────────────────────────────

  it("shows already-member message on 409 ALREADY_MEMBER response", async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ ok: false, error: "ALREADY_MEMBER" }),
    });

    renderManager({ viewerRole: "owner", viewerId: "owner-id" });

    const emailInput = screen.getByLabelText("Email address");
    const inviteBtn = screen.getByRole("button", { name: "Invite" });

    fireEvent.change(emailInput, { target: { value: "existing@example.com" } });
    fireEvent.click(inviteBtn);

    await waitFor(() => {
      expect(screen.getByText("Already a member")).toBeTruthy();
    });
  });

  // ── Invite form — 404 USER_NOT_FOUND ────────────────────────────────────────

  it("shows user-not-found message on USER_NOT_FOUND response", async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ ok: false, error: "USER_NOT_FOUND" }),
    });

    renderManager({ viewerRole: "owner", viewerId: "owner-id" });

    const emailInput = screen.getByLabelText("Email address");
    const inviteBtn = screen.getByRole("button", { name: "Invite" });

    fireEvent.change(emailInput, { target: { value: "notfound@example.com" } });
    fireEvent.click(inviteBtn);

    await waitFor(() => {
      expect(screen.getByText("User must register first")).toBeTruthy();
    });
  });

  // ── Remove button visibility ─────────────────────────────────────────────────

  it("does NOT render Remove button for an owner row", () => {
    renderManager({
      viewerId: "admin-id",
      viewerRole: "admin",
      members: [ownerMember, adminMember, regularMember],
    });
    // Owner row should have no Remove button
    const rows = screen.getAllByRole("listitem");
    const ownerRow = rows.find((r) => r.textContent?.includes("Owner User"));
    expect(ownerRow).toBeTruthy();
    const removeButtons = ownerRow!.querySelectorAll("button");
    const hasRemove = Array.from(removeButtons).some(
      (b) => b.textContent?.trim() === "Remove",
    );
    expect(hasRemove).toBe(false);
  });

  it("does NOT render Remove button for the viewer's own row", () => {
    renderManager({
      viewerId: "admin-id",
      viewerRole: "admin",
      members: [ownerMember, adminMember, regularMember],
    });
    const rows = screen.getAllByRole("listitem");
    const selfRow = rows.find((r) => r.textContent?.includes("Admin User"));
    expect(selfRow).toBeTruthy();
    const removeButtons = selfRow!.querySelectorAll("button");
    const hasSelfRemove = Array.from(removeButtons).some(
      (b) => b.textContent?.trim() === "Remove",
    );
    expect(hasSelfRemove).toBe(false);
  });

  it("renders Remove button for non-owner, non-self members when viewer is admin", () => {
    renderManager({
      viewerId: "admin-id",
      viewerRole: "admin",
      members: [ownerMember, adminMember, regularMember],
    });
    const rows = screen.getAllByRole("listitem");
    const regularRow = rows.find((r) => r.textContent?.includes("Regular Member"));
    expect(regularRow).toBeTruthy();
    const removeButtons = regularRow!.querySelectorAll("button");
    const hasRemove = Array.from(removeButtons).some(
      (b) => b.textContent?.trim() === "Remove",
    );
    expect(hasRemove).toBe(true);
  });

  // ── Remove — happy path ──────────────────────────────────────────────────────

  it("sends DELETE to the correct endpoint on Remove and toasts on success", async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ ok: true, data: { removed: true } }),
    });

    renderManager({
      viewerId: "admin-id",
      viewerRole: "admin",
      members: [ownerMember, adminMember, regularMember],
    });

    const rows = screen.getAllByRole("listitem");
    const regularRow = rows.find((r) => r.textContent?.includes("Regular Member"))!;
    const removeBtn = Array.from(regularRow.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Remove",
    )!;

    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/business/biz-123/members/member-id",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(toast.success).toHaveBeenCalledWith("Member removed");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  // ── Accept invitation banner ─────────────────────────────────────────────────

  it("shows Accept invitation banner when viewer has a pending invite", () => {
    renderManager({
      viewerId: "viewer-id",
      viewerRole: "member",
      members: [ownerMember, viewerPendingMember],
    });
    expect(screen.getByText(/Accept invitation to Acme Corp/)).toBeTruthy();
  });

  it("does NOT show Accept banner when viewer's invite is already accepted", () => {
    renderManager({
      viewerId: "member-id",
      viewerRole: "member",
      members: [ownerMember, regularMember],
    });
    expect(screen.queryByText(/Accept invitation/)).toBeNull();
  });

  it("POSTs to accept endpoint and toasts on success", async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ ok: true }),
    });

    renderManager({
      viewerId: "viewer-id",
      viewerRole: "member",
      members: [ownerMember, viewerPendingMember],
    });

    const acceptBtn = screen.getByRole("button", { name: /Accept invitation/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/business/biz-123/members/accept",
        expect.objectContaining({ method: "POST" }),
      );
      expect(toast.success).toHaveBeenCalledWith("Invitation accepted");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
