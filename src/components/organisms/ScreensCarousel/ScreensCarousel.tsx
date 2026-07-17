import styles from "./ScreensCarousel.module.css";

export type Screen = {
  id: string;
  name: string;
  documentContext: "INTERFACE" | "CATALOG_ITEM";
};

type ScreensCarouselProps = {
  screens: Screen[];
  activeScreenId: string;
  onSelectScreen: (id: string) => void;
  onAddScreen?: () => void;
};

export function ScreensCarousel({ screens, activeScreenId, onSelectScreen, onAddScreen }: ScreensCarouselProps) {
  return (
    <div className={styles.carousel}>
      {screens.map((screen) => {
        const isActive = screen.id === activeScreenId;
        return (
          <div
            key={screen.id}
            className={[styles.screen, isActive ? styles.active : ""].filter(Boolean).join(" ")}
            onClick={() => onSelectScreen(screen.id)}
          >
            {isActive ? <span className={styles.activeDot} /> : null}
            <div className={[styles.name, isActive ? styles.activeName : ""].filter(Boolean).join(" ")}>
              {screen.name}
            </div>
            <div className={styles.badge}>{screen.documentContext === "INTERFACE" ? "Interface" : "Catalog item"}</div>
          </div>
        );
      })}
      <button type="button" className={styles.addScreen} onClick={onAddScreen}>
        + Nueva Pantalla
      </button>
    </div>
  );
}
