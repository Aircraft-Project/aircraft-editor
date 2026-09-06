export const PROJECT_NAME_MAX_LENGTH = 80;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 200;

export interface CreateProjectValues {
  name: string;
  description?: string;
}

export interface CreateProjectErrors {
  name?: string;
  description?: string;
}

export interface CreateProjectValidationResult {
  isValid: boolean;
  values: CreateProjectValues;
  errors: CreateProjectErrors;
}

export const validateCreateProject = (
  input: CreateProjectValues,
): CreateProjectValidationResult => {
  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const errors: CreateProjectErrors = {};

  if (!name) {
    errors.name = "El nombre del proyecto es obligatorio.";
  } else if (name.length > PROJECT_NAME_MAX_LENGTH) {
    errors.name = `El nombre no puede superar los ${PROJECT_NAME_MAX_LENGTH} caracteres.`;
  }

  if (description.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
    errors.description = `La descripción no puede superar los ${PROJECT_DESCRIPTION_MAX_LENGTH} caracteres.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    values: {
      name,
      description: description || undefined,
    },
    errors,
  };
};
