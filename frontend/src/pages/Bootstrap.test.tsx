import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Bootstrap from "./Bootstrap";

afterEach(() => vi.restoreAllMocks());

describe("Bootstrap", () => {
  it("rejects a password/confirm mismatch before calling the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<Bootstrap apiBaseUrl="" onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different111" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to /auth/bootstrap and hands the token back on success", async () => {
    const onComplete = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "tok-123", user: { role: "ADMIN" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<Bootstrap apiBaseUrl="" onComplete={onComplete} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "longenough1" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("tok-123"));
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/auth/bootstrap");
  });

  it("surfaces the API error envelope message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "ALREADY_BOOTSTRAPPED", message: "Already set up" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<Bootstrap apiBaseUrl="" onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "longenough1" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Already set up")).toBeInTheDocument();
  });
});
