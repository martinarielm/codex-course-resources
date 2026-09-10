import { expect, test } from "@playwright/test";

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
}

async function register(page: import("@playwright/test").Page, email = uniqueEmail("user")) {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Name" }).fill("Test User");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/notes");
  await page.waitForLoadState("networkidle");
  return email;
}

async function logOut(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");
  await page.waitForLoadState("networkidle");
}

test("registers, logs out, rejects a bad password, and logs back in", async ({ page }) => {
  const email = await register(page);

  await logOut(page);

  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Unable to log in. Check your email and password.")).toBeVisible();

  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/notes");
});

test("creates, persists, edits, and deletes a note", async ({ page }) => {
  await register(page);
  await expect(page.getByRole("heading", { name: "Your first note starts here" })).toBeVisible();

  await page.getByRole("link", { name: "New note" }).click();
  await expect(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
  await page.getByRole("textbox", { name: "Note title" }).fill("Release checklist");
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f]{8}-[0-9a-f-]{27}$/);

  await page.getByRole("link", { name: "Back to notes" }).click();
  await expect(page.getByRole("link", { name: "Open Release checklist" })).toBeVisible();

  await page.getByRole("link", { name: "Open Release checklist" }).click();
  await page.getByRole("textbox", { name: "Note title" }).fill("Updated checklist");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Note title" })).toHaveValue(
    "Updated checklist",
  );

  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByText("This permanently deletes the note.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/notes");
  await expect(page.getByRole("heading", { name: "Your first note starts here" })).toBeVisible();
});

test("protects note routes and hides notes owned by another user", async ({ page }) => {
  await page.goto("/notes/new");
  await expect(page).toHaveURL("/login");

  await register(page, uniqueEmail("owner"));
  await page.getByRole("link", { name: "New note" }).click();
  await expect(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
  await page.getByRole("textbox", { name: "Note title" }).fill("Private plan");
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f]{8}-[0-9a-f-]{27}$/);
  const ownerNoteUrl = page.url();

  await logOut(page);
  await register(page, uniqueEmail("other-user"));
  await page.goto(ownerNoteUrl);

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByText("isn’t available to your account", { exact: false })).toBeVisible();
});

test("shows the custom 404 page for an unknown route", async ({ page }) => {
  await page.goto("/route-that-does-not-exist");

  await expect(page).toHaveURL("/route-that-does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
