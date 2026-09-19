import Image from "next/image";
import type { BodyNode } from "@/modules/screens/layoutTree";
import { listComponents } from "@/modules/screens/layoutTree";
import { getDevicePreset } from "@/components/organisms/LayoutCanvas/devicePresets";
import { getComponentPresentation } from "../../presentation";
import styles from "./DevicePreview.module.css";

interface DevicePreviewProps {
  readonly body: BodyNode;
  readonly devicePresetId: string;
  readonly screenName: string;
  readonly zoom?: number;
}

export function DevicePreview({
  body,
  devicePresetId,
  screenName,
  zoom = 74,
}: DevicePreviewProps) {
  const device = getDevicePreset(devicePresetId);
  const components = listComponents(body);

  return (
    <div className={styles.stage}>
      <div
        className={styles.device}
        style={{
          width: device.width,
          height: device.height,
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top center",
        }}
        aria-label={`Vista de ${screenName} en ${device.label}`}
      >
        <div className={styles.statusBar}>
          <strong>9:41</strong>
          <span>● ● ▰</span>
        </div>
        <div className={styles.previewHeader}>
          <Image
            src="/assets/branding/aircraft-mark.svg"
            alt=""
            width={38}
            height={38}
          />
          <strong>{screenName}</strong>
        </div>
        <div className={styles.previewContent}>
          {components.length ? (
            components.map((component) => {
              const presentation = getComponentPresentation(component.type);
              const text =
                component.properties.label ??
                component.properties.defaultText ??
                component.name;
              return (
                <div
                  key={component.id}
                  className={styles.component}
                  data-component-type={component.type}
                >
                  <span>{presentation.label}</span>
                  <strong>
                    {typeof text === "string" ? text : component.name}
                  </strong>
                </div>
              );
            })
          ) : (
            <div className={styles.empty}>
              <Image
                src="/assets/branding/aircraft-mark.svg"
                alt=""
                width={72}
                height={72}
              />
              <strong>Tu pantalla está lista</strong>
              <span>Agrega componentes para comenzar a diseñarla.</span>
            </div>
          )}
        </div>
        <div className={styles.navigationBar}>
          <span>Inicio</span>
          <span>Explorar</span>
          <span>Perfil</span>
        </div>
      </div>
    </div>
  );
}
