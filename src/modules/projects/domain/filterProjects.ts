import type { Project } from "./project";

export const filterProjects = (
  projects: readonly Project[],
  query: string,
): Project[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase("es");

  if (!normalizedQuery) {
    return [...projects];
  }

  return projects.filter((project) => {
    const name = project.name.toLocaleLowerCase("es");
    const description = project.description.toLocaleLowerCase("es");

    return (
      name.includes(normalizedQuery) ||
      description.includes(normalizedQuery)
    );
  });
};
