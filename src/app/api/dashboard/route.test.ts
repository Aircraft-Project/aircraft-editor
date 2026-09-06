/** @jest-environment node */

jest.mock("server-only", () => ({}));

import { GET } from "./route";

const createRequest = (userId?: string): Request => {
  const url = new URL("http://localhost/api/dashboard");

  if (userId !== undefined) {
    url.searchParams.set("userId", userId);
  }

  return new Request(url);
};

describe("GET /api/dashboard", () => {
  it("returns every project and a derived summary for admin", async () => {
    const response = await GET(createRequest("usr-admin-001"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.summary).toEqual({
      totalProjects: 5,
      editingProjects: 2,
      publishedProjects: 1,
    });
    expect(payload.data.projects).toHaveLength(5);
    expect(JSON.stringify(payload)).not.toContain("password");
  });

  it("returns only owned projects for developer", async () => {
    const response = await GET(
      createRequest("usr-developer-001"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.summary).toEqual({
      totalProjects: 3,
      editingProjects: 2,
      publishedProjects: 0,
    });
    expect(payload.data.projects).toHaveLength(3);
    expect(
      payload.data.projects.every(
        (project: { ownerId: string }) =>
          project.ownerId === "usr-developer-001",
      ),
    ).toBe(true);
  });

  it("returns 400 when userId is missing", async () => {
    const response = await GET(createRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "No fue posible identificar al usuario.",
    });
  });

  it("returns 401 for an unknown user identity", async () => {
    const response = await GET(createRequest("usr-unknown"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      success: false,
      message: "No fue posible identificar al usuario.",
    });
    expect(payload).not.toHaveProperty("data");
  });});
