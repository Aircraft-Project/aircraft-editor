"use client";

import { DragEvent, useState } from "react";
import { Button, Select } from "@/components/atoms";
import { ASTNodeCard } from "@/components/molecules";
import type { Selection } from "@/store/useEditorStore";
import type { BodyNode, ColumnNode, DroppedPaletteItem, RowNode } from "@/modules/screens/layoutTree";
import { defaultDevicePresetId, devicePresets, getDevicePreset } from "./devicePresets";
import styles from "./LayoutCanvas.module.css";

const DRAG_MIME = "application/json";

function readDroppedItem(event: DragEvent): DroppedPaletteItem | null {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DroppedPaletteItem;
  } catch {
    return null;
  }
}

type LayoutCanvasProps = {
  body: BodyNode;
  selection: Selection;
  onSelectComponent: (id: string) => void;
  onSelectRow: (id: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (id: string) => void;
  onRemoveRow: (id: string) => void;
  onDropOnColumn: (columnId: string, item: DroppedPaletteItem) => void;
  onDropOnRow: (rowId: string, item: DroppedPaletteItem) => void;
};

export function LayoutCanvas({
  body,
  selection,
  onSelectComponent,
  onSelectRow,
  onAddColumn,
  onRemoveColumn,
  onRemoveRow,
  onDropOnColumn,
  onDropOnRow,
}: LayoutCanvasProps) {
  const [devicePresetId, setDevicePresetId] = useState(defaultDevicePresetId);
  const device = getDevicePreset(devicePresetId);

  const iosDevices = devicePresets.filter((preset) => preset.platform === "iOS");
  const androidDevices = devicePresets.filter((preset) => preset.platform === "Android");

  return (
    <div className={styles.canvas}>
      <div className={styles.toolbar}>
        <Button variant="secondary" size="sm" onClick={onAddColumn}>
          + Columna
        </Button>

        <div className={styles.deviceField}>
          <Select
            label="Dispositivo"
            value={devicePresetId}
            onChange={(event) => setDevicePresetId(event.target.value)}
          >
            <optgroup label="iOS">
              {iosDevices.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Android">
              {androidDevices.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </optgroup>
          </Select>
          <span className={styles.deviceDims}>
            {device.width} × {device.height}
          </span>
        </div>

        <span className={styles.hint}>Arrastra componentes desde la paleta hacia una row o hacia el área vacía de una column.</span>
      </div>

      <div className={styles.viewport}>
        <div className={styles.deviceFrame} style={{ width: device.width, height: device.height }}>
          <div className={styles.body}>
            {body.columns.map((column) => (
              <ColumnView
                key={column.id}
                column={column}
                selection={selection}
                canRemove={body.columns.length > 1}
                onSelectComponent={onSelectComponent}
                onSelectRow={onSelectRow}
                onRemoveColumn={onRemoveColumn}
                onRemoveRow={onRemoveRow}
                onDropOnColumn={onDropOnColumn}
                onDropOnRow={onDropOnRow}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ColumnViewProps = {
  column: ColumnNode;
  selection: Selection;
  canRemove: boolean;
  onSelectComponent: (id: string) => void;
  onSelectRow: (id: string) => void;
  onRemoveColumn: (id: string) => void;
  onRemoveRow: (id: string) => void;
  onDropOnColumn: (columnId: string, item: DroppedPaletteItem) => void;
  onDropOnRow: (rowId: string, item: DroppedPaletteItem) => void;
};

function ColumnView({
  column,
  selection,
  canRemove,
  onSelectComponent,
  onSelectRow,
  onRemoveColumn,
  onRemoveRow,
  onDropOnColumn,
  onDropOnRow,
}: ColumnViewProps) {
  const [dropZoneOver, setDropZoneOver] = useState(false);

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <span className={styles.columnLabel}>Column</span>
        {canRemove ? (
          <button type="button" className={styles.removeButton} onClick={() => onRemoveColumn(column.id)}>
            ×
          </button>
        ) : null}
      </div>

      {column.rows.map((row) => (
        <RowView
          key={row.id}
          row={row}
          selected={selection?.kind === "row" && selection.id === row.id}
          selectedComponentId={selection?.kind === "component" ? selection.id : null}
          onSelectComponent={onSelectComponent}
          onSelectRow={onSelectRow}
          onRemoveRow={onRemoveRow}
          onDropOnRow={onDropOnRow}
        />
      ))}

      <div
        className={[styles.dropZone, dropZoneOver ? styles.dropZoneOver : ""].filter(Boolean).join(" ")}
        onDragOver={(event) => {
          event.preventDefault();
          setDropZoneOver(true);
        }}
        onDragLeave={() => setDropZoneOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropZoneOver(false);
          const item = readDroppedItem(event);
          if (item) onDropOnColumn(column.id, item);
        }}
      >
        Suelta un componente acá para crear una nueva row
      </div>
    </div>
  );
}

type RowViewProps = {
  row: RowNode;
  selected: boolean;
  selectedComponentId: string | null;
  onSelectComponent: (id: string) => void;
  onSelectRow: (id: string) => void;
  onRemoveRow: (id: string) => void;
  onDropOnRow: (rowId: string, item: DroppedPaletteItem) => void;
};

function RowView({ row, selected, selectedComponentId, onSelectComponent, onSelectRow, onRemoveRow, onDropOnRow }: RowViewProps) {
  const [dragOver, setDragOver] = useState(false);
  const sizingClass = row.weight !== undefined ? styles.rowWeighted : styles.rowWrap;

  return (
    <div
      className={[styles.row, sizingClass, selected ? styles.rowSelected : "", dragOver ? styles.rowDragOver : ""]
        .filter(Boolean)
        .join(" ")}
      style={row.weight !== undefined ? { flexGrow: row.weight } : undefined}
      onClick={() => onSelectRow(row.id)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        const item = readDroppedItem(event);
        if (item) onDropOnRow(row.id, item);
      }}
    >
      <span className={styles.rowLabel}>Row</span>
      {row.weight !== undefined ? <span className={styles.rowWeightBadge}>weight: {row.weight}</span> : null}

      <div className={styles.rowComponents}>
        {row.components.length === 0 ? (
          <span className={styles.hint}>vacía</span>
        ) : (
          row.components.map((component) => (
            <div
              key={component.id}
              onClick={(event) => {
                event.stopPropagation();
                onSelectComponent(component.id);
              }}
            >
              <ASTNodeCard type={component.type} name={component.name} selected={selectedComponentId === component.id} />
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        className={styles.removeButton}
        onClick={(event) => {
          event.stopPropagation();
          onRemoveRow(row.id);
        }}
      >
        ×
      </button>
    </div>
  );
}
