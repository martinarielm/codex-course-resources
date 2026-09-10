import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthForm from "@/app/components/auth-form";

const { signInEmail, signUpEmail } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
  },
}));

describe("AuthForm", () => {
  beforeEach(() => {
    signInEmail.mockReset();
    signUpEmail.mockReset();
  });

  it("renders the login fields and registration link", () => {
    render(<AuthForm mode="login" />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome back");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe(
      "current-password",
    );
    expect(screen.getByRole("link", { name: "Register" }).getAttribute("href")).toBe(
      "/register",
    );
  });

  it("renders the extra registration requirements", () => {
    render(<AuthForm mode="register" />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Create your account",
    );
    expect(screen.getByRole("textbox", { name: "Name" }).hasAttribute("required")).toBe(true);
    expect(screen.getByLabelText("Password").getAttribute("minlength")).toBe("8");
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
  });

  it("validates the registration name before calling the API", () => {
    render(<AuthForm mode="register" />);
    const form = screen.getByRole("button", { name: "Create account" }).closest("form");
    if (!form) throw new Error("Expected the registration form to exist.");

    fireEvent.submit(form);

    expect(screen.getByRole("alert").textContent).toBe("Please enter your name.");
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("shows a generic invalid-credentials error from the login API", async () => {
    signInEmail.mockResolvedValue({ error: { status: 401 } });
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Unable to log in. Check your email and password.",
      );
    });
    expect(signInEmail).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "incorrect password",
    });
  });

  it("distinguishes rate limiting without exposing API details", async () => {
    signInEmail.mockResolvedValue({ error: { status: 429, message: "internal detail" } });
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Too many attempts. Please try again later.",
      );
    });
    expect(screen.queryByText("internal detail")).toBeNull();
  });

  it("recovers from a network failure and re-enables submission", async () => {
    signInEmail.mockRejectedValue(new Error("network details"));
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Unable to connect. Please try again.",
      );
    });
    expect(screen.getByRole("button", { name: "Log in" }).hasAttribute("disabled")).toBe(false);
  });
});
