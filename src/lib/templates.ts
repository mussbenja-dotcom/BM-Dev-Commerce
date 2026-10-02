/**
 * Visual templates. A template is just a preset of theme tokens, home layout
 * and starter categories — every store runs the same storefront code.
 * To add a template: add an entry here. Nothing else needs to change.
 */

export const HOME_SECTIONS = [
  "hero",
  "categories",
  "featured",
  "new",
  "promo",
  "offers",
  "bestsellers",
  "benefits",
  "instagram",
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export const FONT_OPTIONS = {
  jost: "Jost",
  "dm-sans": "DM Sans",
  manrope: "Manrope",
  fraunces: "Fraunces",
  cormorant: "Cormorant Garamond",
} as const;
export type FontKey = keyof typeof FONT_OPTIONS;

export type ThemeTokens = {
  primaryColor: string;
  primaryContrast: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  headingFont: FontKey;
  bodyFont: FontKey;
  radius: "none" | "sm" | "md" | "lg";
  heroLayout: "full" | "split" | "minimal";
  cardStyle: "portrait" | "square";
  headingCase: "normal" | "upper";
  homeSections: HomeSection[];
};

export type TemplateDefinition = {
  key: string;
  label: string;
  description: string;
  industries: string[];
  theme: ThemeTokens;
  starterCategories: string[];
  productOptions: { option1Name: string | null; option2Name: string | null };
};

export const TEMPLATES: Record<string, TemplateDefinition> = {
  fashion: {
    key: "fashion",
    label: "Fashion",
    description: "Editorial, fotos verticales grandes, tipografía geométrica en mayúsculas.",
    industries: ["Moda", "Calzado", "Accesorios"],
    theme: {
      primaryColor: "#1c1a17",
      primaryContrast: "#ffffff",
      accentColor: "#9c4a2a",
      backgroundColor: "#faf8f5",
      surfaceColor: "#f1ede6",
      textColor: "#1c1a17",
      mutedColor: "#6b665e",
      borderColor: "#e3ddd3",
      headingFont: "jost",
      bodyFont: "dm-sans",
      radius: "none",
      heroLayout: "full",
      cardStyle: "portrait",
      headingCase: "upper",
      homeSections: ["hero", "categories", "new", "promo", "featured", "offers", "bestsellers", "benefits", "instagram"],
    },
    starterCategories: ["Remeras", "Pantalones", "Abrigos", "Accesorios"],
    productOptions: { option1Name: "Talle", option2Name: "Color" },
  },
  beauty: {
    key: "beauty",
    label: "Beauty",
    description: "Suave y luminoso, serif elegante, ideal para cosmética y cuidado personal.",
    industries: ["Cosmética", "Perfumería", "Bienestar"],
    theme: {
      primaryColor: "#344e41",
      primaryContrast: "#ffffff",
      accentColor: "#b98b5e",
      backgroundColor: "#f7f5f0",
      surfaceColor: "#ece8df",
      textColor: "#1f2a22",
      mutedColor: "#5f6b62",
      borderColor: "#dcd6ca",
      headingFont: "cormorant",
      bodyFont: "manrope",
      radius: "lg",
      heroLayout: "split",
      cardStyle: "square",
      headingCase: "normal",
      homeSections: ["hero", "benefits", "featured", "categories", "promo", "bestsellers", "offers", "instagram"],
    },
    starterCategories: ["Rostro", "Cuerpo", "Kits"],
    productOptions: { option1Name: "Tamaño", option2Name: null },
  },
  food: {
    key: "food",
    label: "Food",
    description: "Cálido y apetitoso, pensado para pastelerías, viandas y alimentos.",
    industries: ["Pastelería", "Alimentos", "Cafetería"],
    theme: {
      primaryColor: "#7a2e22",
      primaryContrast: "#ffffff",
      accentColor: "#d9922e",
      backgroundColor: "#fff9f1",
      surfaceColor: "#f8ecdc",
      textColor: "#2b1a14",
      mutedColor: "#735f54",
      borderColor: "#ecdcc8",
      headingFont: "fraunces",
      bodyFont: "dm-sans",
      radius: "lg",
      heroLayout: "split",
      cardStyle: "square",
      headingCase: "normal",
      homeSections: ["hero", "featured", "categories", "promo", "bestsellers", "benefits", "instagram"],
    },
    starterCategories: ["Tortas", "Dulces", "Panadería"],
    productOptions: { option1Name: "Tamaño", option2Name: null },
  },
  home: {
    key: "home",
    label: "Home & Deco",
    description: "Tonos naturales y terracota, para decoración, bazar y objetos.",
    industries: ["Decoración", "Bazar", "Viveros", "Artesanías"],
    theme: {
      primaryColor: "#8c4f33",
      primaryContrast: "#ffffff",
      accentColor: "#5f6f52",
      backgroundColor: "#f6f1ea",
      surfaceColor: "#ece3d7",
      textColor: "#2a221c",
      mutedColor: "#6e6258",
      borderColor: "#dfd3c4",
      headingFont: "fraunces",
      bodyFont: "manrope",
      radius: "md",
      heroLayout: "full",
      cardStyle: "portrait",
      headingCase: "normal",
      homeSections: ["hero", "categories", "featured", "promo", "new", "offers", "benefits", "instagram"],
    },
    starterCategories: ["Living", "Cocina", "Aromas"],
    productOptions: { option1Name: "Color", option2Name: null },
  },
  minimal: {
    key: "minimal",
    label: "Minimal",
    description: "Blanco, limpio y directo. Funciona para cualquier rubro.",
    industries: ["Regalería", "Ferretería", "Tecnología", "Otro"],
    theme: {
      primaryColor: "#141414",
      primaryContrast: "#ffffff",
      accentColor: "#c9a227",
      backgroundColor: "#ffffff",
      surfaceColor: "#f4f4f2",
      textColor: "#141414",
      mutedColor: "#666660",
      borderColor: "#e5e5e0",
      headingFont: "manrope",
      bodyFont: "manrope",
      radius: "md",
      heroLayout: "minimal",
      cardStyle: "square",
      headingCase: "normal",
      homeSections: ["hero", "categories", "featured", "promo", "bestsellers", "offers", "benefits", "instagram"],
    },
    starterCategories: ["Destacados", "Novedades"],
    productOptions: { option1Name: null, option2Name: null },
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

export function getTemplate(key: string): TemplateDefinition {
  return TEMPLATES[key] ?? TEMPLATES.minimal;
}

export const RADIUS_PX: Record<ThemeTokens["radius"], string> = {
  none: "0px",
  sm: "4px",
  md: "10px",
  lg: "18px",
};
