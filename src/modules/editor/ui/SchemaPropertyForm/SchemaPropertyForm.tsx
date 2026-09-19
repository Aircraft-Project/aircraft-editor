"use client";

import type {
  PropertySchema,
  SchemaValue,
} from "@/modules/aircraft-schema";
import { displaySchemaValue } from "../../application";
import { getPropertyLabel } from "../../presentation";
import styles from "./SchemaPropertyForm.module.css";

interface SchemaPropertyFormProps {
  readonly properties: readonly PropertySchema[];
  readonly values: Readonly<Record<string, SchemaValue>>;
  readonly onChange: (name: string, value: SchemaValue) => void;
}

export function SchemaPropertyForm({
  properties,
  values,
  onChange,
}: SchemaPropertyFormProps) {
  if (!properties.length) {
    return (
      <p className={styles.empty}>
        Esta definición no declara propiedades configurables.
      </p>
    );
  }

  return (
    <div className={styles.fields}>
      {properties.map((property, index) => (
        <PropertyField
          key={`${property.name}-${index}`}
          property={property}
          value={values[property.name]}
          onChange={(value) => onChange(property.name, value)}
        />
      ))}
    </div>
  );
}

interface PropertyFieldProps {
  readonly property: PropertySchema;
  readonly value: SchemaValue | undefined;
  readonly onChange: (value: SchemaValue) => void;
}

function PropertyField({
  property,
  value,
  onChange,
}: PropertyFieldProps) {
  const id = `schema-property-${property.name}`;
  const label = getPropertyLabel(property.name);
  const describedBy = property.description
    ? `${id}-description`
    : undefined;

  if (property.valueType.kind === "boolean") {
    return (
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={describedBy}
        />
        <span>
          {label}
          {property.required ? " *" : ""}
        </span>
        <Description id={describedBy} text={property.description} />
      </label>
    );
  }

  if (property.valueType.kind === "enum" || property.options?.length) {
    return (
      <label className={styles.field} htmlFor={id}>
        <span>{label}{property.required ? " *" : ""}</span>
        <select
          id={id}
          value={displaySchemaValue(value)}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
        >
          {property.options?.map((option) => {
            const optionValue = displaySchemaValue(option);
            return (
              <option key={optionValue} value={optionValue}>
                {optionValue}
              </option>
            );
          })}
        </select>
        <Description id={describedBy} text={property.description} />
      </label>
    );
  }

  if (
    property.valueType.kind === "number" ||
    property.valueType.kind === "integer"
  ) {
    return (
      <label className={styles.field} htmlFor={id}>
        <span>{label}{property.required ? " *" : ""}</span>
        <input
          id={id}
          type="number"
          step={property.valueType.kind === "integer" ? 1 : "any"}
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-describedby={describedBy}
        />
        <Description id={describedBy} text={property.description} />
      </label>
    );
  }

  if (
    property.valueType.kind === "object" ||
    property.valueType.kind === "array" ||
    property.valueType.kind === "map" ||
    property.valueType.kind === "custom"
  ) {
    return (
      <label className={styles.field} htmlFor={id}>
        <span>{label}{property.required ? " *" : ""}</span>
        <textarea
          id={id}
          value={displaySchemaValue(value)}
          readOnly
          aria-describedby={`${id}-fallback`}
        />
        <small id={`${id}-fallback`} className={styles.description}>
          Tipo {property.valueType.raw}. La edición estructurada se incorporará
          en una fase posterior; la propiedad permanece visible y preservada.
        </small>
      </label>
    );
  }

  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}{property.required ? " *" : ""}</span>
      <input
        id={id}
        type="text"
        value={typeof value === "string" ? value : displaySchemaValue(value)}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy}
      />
      <Description id={describedBy} text={property.description} />
    </label>
  );
}

function Description({
  id,
  text,
}: {
  readonly id: string | undefined;
  readonly text: string | undefined;
}) {
  if (!id || !text) {
    return null;
  }
  return (
    <small id={id} className={styles.description}>
      {text}
    </small>
  );
}
