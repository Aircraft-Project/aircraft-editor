export interface PresentationMetadata {
  readonly label: string;
  readonly description: string;
}

const componentMetadata: Readonly<Record<string, PresentationMetadata>> = {
  Button: { label: "Botón", description: "Realiza una acción" },
  TextField: {
    label: "Campo de texto",
    description: "Permite ingresar información",
  },
  TextLabel: {
    label: "Etiqueta de texto",
    description: "Muestra texto en pantalla",
  },
  IMAGE: { label: "Imagen", description: "Muestra una imagen" },
  ICON: { label: "Icono", description: "Muestra un icono" },
  Catalog: {
    label: "Catálogo",
    description: "Presenta una colección de elementos",
  },
  Fractal: {
    label: "Fractal",
    description: "Componente personalizado",
  },
};

const triggerMetadata: Readonly<Record<string, PresentationMetadata>> = {
  ApiService: {
    label: "Consultar servicio",
    description: "Obtiene o envía información",
  },
  Math: { label: "Calcular", description: "Realiza una operación matemática" },
  Conditional: {
    label: "Tomar decisión",
    description: "Continúa según una condición",
  },
  ConditionalPlus: {
    label: "Decisión avanzada",
    description: "Evalúa condiciones compuestas",
  },
  ConditionalSwitcher: {
    label: "Elegir camino",
    description: "Selecciona entre varios resultados",
  },
  Navigation: {
    label: "Ir a otra pantalla",
    description: "Cambia la pantalla visible",
  },
  JsonBuilder: {
    label: "Construir información",
    description: "Agrupa datos en una estructura",
  },
  JsonMapper: {
    label: "Transformar información",
    description: "Adapta datos recibidos",
  },
  JsonEngine: {
    label: "Procesar información",
    description: "Convierte una estructura de datos",
  },
  Shooter: {
    label: "Ejecutar acciones",
    description: "Activa varios pasos",
  },
  FetchContextArg: {
    label: "Obtener dato",
    description: "Recupera información del contexto",
  },
  StateComp: {
    label: "Actualizar estado",
    description: "Modifica un componente",
  },
  StringEngine: {
    label: "Trabajar con texto",
    description: "Transforma contenido textual",
  },
};

const eventLabels: Readonly<Record<string, string>> = {
  "on-change-event": "Al cambiar",
  "on-clic-event": "Al hacer clic",
  "on-create-event": "Al crear",
  "on-destroy-event": "Al cerrar o destruir",
  "on-item-clic-event": "Al seleccionar un elemento",
  "on-observe-event": "Al observar un cambio",
  "on-pause-event": "Al pausar",
  "on-resume-event": "Al volver",
  "on-scroll-ending-event": "Al llegar al final",
  "on-triggering-event": "Al activarse",
};

const propertyLabels: Readonly<Record<string, string>> = {
  label: "Texto",
  defaultText: "Valor inicial",
  hint: "Texto de ayuda",
  dateFormat: "Formato de fecha",
  imageUrl: "Imagen",
  iconName: "Icono",
  contentDescription: "Descripción accesible",
  color: "Color",
  tint: "Color",
  size: "Tamaño",
  maxLines: "Máximo de líneas",
  minLength: "Longitud mínima",
  maxLength: "Longitud máxima",
  itemView: "Vista de elemento",
  orientation: "Orientación",
  baseUrl: "Dirección base",
  endpoint: "Ruta del servicio",
  method: "Método",
  target: "Pantalla de destino",
  expression: "Condición",
  command: "Acción",
};

export function getComponentPresentation(type: string): PresentationMetadata {
  return (
    componentMetadata[type] ?? {
      label: type,
      description: "Componente disponible en el schema",
    }
  );
}

export function getTriggerPresentation(type: string): PresentationMetadata {
  return (
    triggerMetadata[type] ?? {
      label: type,
      description: "Acción disponible en el schema",
    }
  );
}

export function getEventLabel(type: string): string {
  return eventLabels[type] ?? type;
}

export function getPropertyLabel(name: string): string {
  return propertyLabels[name] ?? name;
}
