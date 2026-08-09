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

/**
 * Un solo objeto de callbacks que se pasa sin tocar en cada nivel de
 * recursión (Column → Row → Column anidada → ...), para no tener que
 * acordarse de reenviar cada prop individual en cada nivel.
 */
type TreeCallbacks = {
  selection: Selection;
  onSelectComponent: (id: string) => void;
  onSelectRow: (id: string) => void;
  onSelectColumn: (id: string) => void;
  onAddColumnToRow: (rowId: string) => void;
  onRemoveColumn: (id: string) => void;
  onRemoveRow: (id: string) => void;
  onDropOnColumn: (columnId: string, item: DroppedPaletteItem) => void;
  onDropOnRow: (rowId: string, item: DroppedPaletteItem) => void;
};

type LayoutCanvasProps = TreeCallbacks & {
  body: BodyNode;
  onAddColumn: () => void;
};

export function LayoutCanvas({ body, onAddColumn, ...callbacks }: LayoutCanvasProps) {
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

        <span className={styles.hint}>
          Arrastra componentes desde la paleta hacia una row o hacia el área vacía de una column. Una
          row también puede dividirse en columns con el botón &quot;+ Col&quot;.
        </span>
      </div>

      <div className={styles.viewport}>
        <div className={styles.deviceFrame} style={{ width: device.width, height: device.height }}>
          <div className={styles.body}>
            {body.columns.map((column) => (
              <ColumnView key={column.id} column={column} canRemove={body.columns.length > 1} callbacks={callbacks} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ColumnViewProps = {
  column: ColumnNode;
  canRemove: boolean;
  callbacks: TreeCallbacks;
};

function ColumnView({ column, canRemove, callbacks }: ColumnViewProps) {
  const { selection, onSelectColumn, onRemoveColumn, onDropOnColumn } = callbacks;
  const [dropZoneOver, setDropZoneOver] = useState(false);
  const selected = selection?.kind === "column" && selection.id === column.id;

  return (
    <div className={styles.columnSizer} style={{ flexGrow: column.weight }}>
      <div
        className={[styles.column, selected ? styles.columnSelected : ""].filter(Boolean).join(" ")}
        onClick={() => onSelectColumn(column.id)}
      >
        {canRemove ? (
          <button
            type="button"
            className={styles.removeColumnButton}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveColumn(column.id);
            }}
          >
            ×
          </button>
        ) : null}

        {column.rows.map((row) => (
          <RowView key={row.id} row={row} callbacks={callbacks} />
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
            event.stopPropagation();
            setDropZoneOver(false);
            const item = readDroppedItem(event);
            if (item) onDropOnColumn(column.id, item);
          }}
        >
          Suelta un componente acá para crear una nueva row
        </div>
      </div>
    </div>
  );
}

type RowViewProps = {
  row: RowNode;
  callbacks: TreeCallbacks;
};

function RowView({ row, callbacks }: RowViewProps) {
  const {
    selection,
    onSelectComponent,
    onSelectRow,
    onAddColumnToRow,
    onRemoveRow,
    onDropOnRow,
  } = callbacks;
  const [dragOver, setDragOver] = useState(false);
  const selected = selection?.kind === "row" && selection.id === row.id;
  const selectedComponentId = selection?.kind === "component" ? selection.id : null;

  const sizingClass =
    row.weight !== undefined ? styles.rowWeighted : row.height === "match_parent" ? styles.rowMatchParent : styles.rowWrap;

  return (
    <div className={[styles.rowSizer, sizingClass].join(" ")} style={row.weight !== undefined ? { flexGrow: row.weight } : undefined}>
      <div
        className={[styles.row, selected ? styles.rowSelected : "", dragOver ? styles.rowDragOver : ""].filter(Boolean).join(" ")}
        onClick={(event) => {
          event.stopPropagation();
          onSelectRow(row.id);
        }}
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
        <div className={styles.rowChildren}>
          {row.children.length === 0 ? (
            <span className={styles.hint}>vacía</span>
          ) : (
            row.children.map((child) =>
              child.kind === "component" ? (
                <div
                  key={child.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectComponent(child.id);
                  }}
                >
                  <ASTNodeCard type={child.type} name={child.name} selected={selectedComponentId === child.id} />
                </div>
              ) : (
                <ColumnView key={child.id} column={child} canRemove callbacks={callbacks} />
              )
            )
          )}
        </div>

        <button
          type="button"
          className={styles.addColumnButton}
          title="Dividir esta row en columns"
          onClick={(event) => {
            event.stopPropagation();
            onAddColumnToRow(row.id);
          }}
        >
          + Col
        </button>

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
    </div>
  );
}
