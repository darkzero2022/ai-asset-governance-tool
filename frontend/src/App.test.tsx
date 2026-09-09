import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("login form", () => {
  it("renders empty credential fields once the session check finishes with no session", async () => {
    // No backend in the test env: the mount-time refreshSession() call fails,
    // authChecked flips true, and with no token we land on the login screen.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: /sign in to manage ai systems/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
    vi.restoreAllMocks();
  });
});
