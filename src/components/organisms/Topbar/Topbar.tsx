import type { Ref } from "react";
import Image from "next/image";
import { ChevronLeft, Eye, Save } from "lucide-react";
import {
  devicePresets,
  getDevicePreset,
} from "@/components/organisms/LayoutCanvas/devicePresets";
import styles from "./Topbar.module.css";

type TopbarProps = {
  readonly projectName: string;
  readonly devicePresetId: string;
  readonly zoom: number;
  readonly previewButtonRef?: Ref<HTMLButtonElement>;
  readonly onBack?: () => void;
  readonly onDeviceChange: (devicePresetId: string) => void;
  readonly onZoomChange: (zoom: number) => void;
  readonly onPreview: () => void;
  readonly onSave: () => void;
};

export function Topbar({
  projectName,
  devicePresetId,
  zoom,
  previewButtonRef,
  onBack,
  onDeviceChange,
  onZoomChange,
  onPreview,
  onSave,
}: TopbarProps) {
  const device = getDevicePreset(devicePresetId);
  const iosDevices = devicePresets.filter(
    (preset) => preset.platform === "iOS",
  );
  const androidDevices = devicePresets.filter(
    (preset) => preset.platform === "Android",
  );

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        {onBack ? (
          <button
            type="button"
            className={styles.back}
            onClick={onBack}
            aria-label="Volver a Mis proyectos"
          >
            <ChevronLeft size={18} />
          </button>
        ) : null}
        <Image
          src="/assets/branding/aircraft-mark.svg"
          alt=""
          width={34}
          height={34}
        />
        <strong>Aircraft Editor</strong>
      </div>

      <label className={styles.control}>
        <span className="sr-only">Proyecto actual</span>
        <select value={projectName} disabled>
          <option value={projectName}>{projectName}</option>
        </select>
      </label>

      <div className={styles.spacer} />

      <label className={styles.control}>
        <span className="sr-only">Dispositivo</span>
        <select
          aria-label="Dispositivo"
          value={devicePresetId}
          onChange={(event) => onDeviceChange(event.target.value)}
        >
          <optgroup label="iOS">
            {iosDevices.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} ({preset.width} × {preset.height})
              </option>
            ))}
          </optgroup>
          <optgroup label="Android">
            {androidDevices.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} ({preset.width} × {preset.height})
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <label className={styles.zoom}>
        <span className="sr-only">Zoom</span>
        <select
          aria-label="Zoom"
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
        >
          {[50, 75, 100, 125].map((value) => (
            <option key={value} value={value}>{value}%</option>
          ))}
        </select>
      </label>

      <button
        ref={previewButtonRef}
        type="button"
        className={styles.action}
        onClick={onPreview}
      >
        <Eye size={18} /> Vista previa
      </button>
      <button
        type="button"
        className={styles.action}
        title="Los cambios se conservan localmente durante esta sesión."
        onClick={onSave}
      >
        <Save size={18} /> Guardar
      </button>
      <span className={styles.localStatus} title={device.label}>
        Cambios locales
      </span>
      <span className={styles.avatar} aria-label="Usuario actual">JD</span>
    </header>
  );
}
