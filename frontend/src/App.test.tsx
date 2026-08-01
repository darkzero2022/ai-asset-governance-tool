import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("login form", () => {
  it("renders empty credential fields", () => {
    localStorage.clear();
    render(<App />);

    expect(screen.getByRole("heading", { name: /sign in to manage ai assets/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
  });
});
