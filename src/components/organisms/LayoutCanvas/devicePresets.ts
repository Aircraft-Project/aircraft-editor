export type DevicePlatform = "iOS" | "Android";
export type DeviceCategory = "phone" | "tablet";

export type DevicePreset = {
  id: string;
  label: string;
  platform: DevicePlatform;
  category: DeviceCategory;
  /** Puntos CSS lógicos (no píxeles físicos), consistente con cómo el navegador mide viewport. */
  width: number;
  height: number;
};

export const devicePresets: DevicePreset[] = [
  { id: "iphone-se", label: "iPhone SE", platform: "iOS", category: "phone", width: 375, height: 667 },
  { id: "iphone-14", label: "iPhone 14", platform: "iOS", category: "phone", width: 390, height: 844 },
  { id: "iphone-15", label: "iPhone 15", platform: "iOS", category: "phone", width: 393, height: 852 },
  { id: "iphone-15-pro-max", label: "iPhone 15 Pro Max", platform: "iOS", category: "phone", width: 430, height: 932 },
  { id: "galaxy-s23", label: "Galaxy S23", platform: "Android", category: "phone", width: 360, height: 780 },
  { id: "pixel-8", label: "Pixel 8", platform: "Android", category: "phone", width: 412, height: 915 },
  { id: "pixel-8-pro", label: "Pixel 8 Pro", platform: "Android", category: "phone", width: 412, height: 892 },
  { id: "ipad-10", label: "iPad (10th gen)", platform: "iOS", category: "tablet", width: 820, height: 1180 },
  { id: "ipad-pro-12", label: "iPad Pro 12.9\"", platform: "iOS", category: "tablet", width: 1024, height: 1366 },
  { id: "pixel-tablet", label: "Pixel Tablet", platform: "Android", category: "tablet", width: 800, height: 1280 },
];

export const defaultDevicePresetId = "iphone-15";

export function getDevicePreset(id: string): DevicePreset {
  return (
    devicePresets.find((preset) => preset.id === id) ??
    devicePresets.find((preset) => preset.id === defaultDevicePresetId) ??
    devicePresets[0]
  );
}
