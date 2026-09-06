"use client";

import { LoaderCircle, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type {
  CreateProjectErrors,
  CreateProjectValues,
} from "@/modules/projects";

import styles from "./CreateProjectModal.module.css";

export type CreateProjectSubmissionResult =
  | {
      success: true;
    }
  | {
      success: false;
      errors: CreateProjectErrors;
      message?: string;
    };

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    values: CreateProjectValues,
  ) => Promise<CreateProjectSubmissionResult>;
}

const initialValues: CreateProjectValues = {
  name: "",
  description: "",
};

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [values, setValues] =
    useState<CreateProjectValues>(initialValues);
  const [errors, setErrors] = useState<CreateProjectErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    nameInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = dialogRef.current?.querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement
      >(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement =
        focusableElements[focusableElements.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === firstElement
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const closeModal = (): void => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrors({});
    setGeneralError(null);
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    let result: CreateProjectSubmissionResult;

    try {
      result = await onCreate(values);
    } catch {
      result = {
        success: false,
        errors: {},
        message: "No fue posible crear el proyecto.",
      };
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }

    if (!result.success) {
      setErrors(result.errors);
      setGeneralError(result.message ?? null);
      return;
    }

    setValues(initialValues);
    setErrors({});
    setGeneralError(null);
    onClose();
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        aria-describedby="create-project-dialog-description"
      >
        <header className={styles.header}>
          <div>
            <h2 id="create-project-title">Crear nuevo proyecto</h2>
            <p
              id="create-project-dialog-description"
              className={styles.srOnly}
            >
              Completa los datos para crear un nuevo proyecto.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closeModal}
            disabled={isSubmitting}
          >
            <X size={21} aria-hidden="true" />
          </button>
        </header>

        <form
          className={styles.form}
          onSubmit={handleSubmit}
          noValidate
        >
          <div className={styles.field}>
            <label htmlFor="create-project-name">
              Nombre del proyecto *
            </label>
            <input
              ref={nameInputRef}
              id="create-project-name"
              name="name"
              value={values.name}
              maxLength={80}
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name ? "create-project-name-error" : undefined
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            {errors.name ? (
              <p
                className={styles.error}
                id="create-project-name-error"
              >
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="create-project-description">
              Descripción
            </label>
            <textarea
              id="create-project-description"
              name="description"
              value={values.description}
              maxLength={200}
              rows={4}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description
                  ? "create-project-description-error"
                  : undefined
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
            {errors.description ? (
              <p
                className={styles.error}
                id="create-project-description-error"
              >
                {errors.description}
              </p>
            ) : null}
          </div>

          {generalError ? (
            <p className={styles.generalError} role="alert">
              {generalError}
            </p>
          ) : null}

          <footer className={styles.actions}>
            <button
              className={styles.cancelButton}
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              className={styles.createButton}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    className={styles.spinner}
                    size={18}
                    aria-hidden="true"
                  />
                  Creando proyecto...
                </>
              ) : (
                "Crear proyecto"
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

