import { useDashboardStore } from "./useDashboardStore";

const summary = {
  totalProjects: 5,
  editingProjects: 2,
  publishedProjects: 1,
};

describe("useDashboardStore", () => {
  beforeEach(() => {
    useDashboardStore.getState().reset();
  });

  it("tracks loading and success without owning projects", () => {
    useDashboardStore.getState().startLoading();

    expect(useDashboardStore.getState()).toMatchObject({
      summary: null,
      status: "loading",
      error: null,
    });

    useDashboardStore.getState().setSuccess(summary);

    expect(useDashboardStore.getState()).toMatchObject({
      summary,
      status: "success",
      error: null,
    });
    expect(useDashboardStore.getState()).not.toHaveProperty("projects");
  });

  it("tracks a safe loading error", () => {
    useDashboardStore
      .getState()
      .setError("No fue posible cargar tus proyectos.");

    expect(useDashboardStore.getState()).toMatchObject({
      status: "error",
      error: "No fue posible cargar tus proyectos.",
    });
  });

  it("updates summary after a project mutation", () => {
    useDashboardStore.getState().setSuccess(summary);
    useDashboardStore.getState().updateSummary({
      ...summary,
      totalProjects: 6,
      editingProjects: 3,
    });

    expect(useDashboardStore.getState().summary).toEqual({
      totalProjects: 6,
      editingProjects: 3,
      publishedProjects: 1,
    });
  });

  it("resets the lifecycle", () => {
    useDashboardStore.getState().setSuccess(summary);
    useDashboardStore.getState().reset();

    expect(useDashboardStore.getState()).toMatchObject({
      summary: null,
      status: "idle",
      error: null,
    });
  });
});
