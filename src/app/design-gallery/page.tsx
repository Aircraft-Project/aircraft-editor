export const metadata = {
  title: "Galería de Diseño — Assembler IDE",
};

/**
 * Sirve Assembler_IDE_Design_Gallery.html tal cual (sin reescribir),
 * copiado a public/assembler-design-gallery.html, dentro de un iframe
 * a pantalla completa para poder tenerlo abierto en una pestaña propia
 * mientras se desarrolla en otra.
 */
export default function DesignGalleryPage() {
  return (
    <iframe
      src="/assembler-design-gallery.html"
      title="Assembler IDE — Galería de Diseño"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
    />
  );
}
