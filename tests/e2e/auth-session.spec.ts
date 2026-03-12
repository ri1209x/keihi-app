import { expect, test } from "@playwright/test";

test.describe("auth session flow", () => {
  test("requires login before showing workflow", async ({ page, request }) => {
    const response = await request.get("/api/journals/recent?limit=20");
    expect(response.status()).toBe(401);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "認証セッション" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ログインが必要です" })).toBeVisible();
    await expect(page.getByRole("button", { name: "このユーザーでログイン" })).toBeVisible();
  });

  test("operator can sign in and use upload workflow", async ({ page }) => {
    await page.goto("/");

    await page.selectOption("select", "operator");
    await page.getByRole("button", { name: "このユーザーでログイン" }).click();

    await expect(page.getByText("現在の権限:")).toContainText("operator");
    await expect(page.getByText("現在の組織:")).toContainText("demo-tenant");
    await expect(page.getByRole("button", { name: "Upload and Enqueue" })).toBeEnabled();
    await expect(page.getByRole("link", { name: "承認済みCSVをDL" })).toBeVisible();
  });

  test("approver can sign in but upload remains disabled", async ({ page }) => {
    await page.goto("/");

    await page.selectOption("select", "approver");
    await page.getByRole("button", { name: "このユーザーでログイン" }).click();

    await expect(page.getByText("現在の権限:")).toContainText("approver");
    await expect(page.getByRole("button", { name: "Upload and Enqueue" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "仕訳候補と承認" })).toBeVisible();
  });
});
