/**
 * Demo catalogue for the five showcase stores. Image values are keys
 * resolved against images.ts (curated Unsplash photos).
 */

export type SeedVariant = { o1?: string; o2?: string; hex?: string; stock: number; price?: number };
export type SeedProduct = {
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  description: string;
  images: string[];
  brand?: string;
  featured?: boolean;
  isNew?: boolean;
  sold?: number;
  option1Name?: string;
  option2Name?: string;
  variants: SeedVariant[];
};
export type SeedBanner = {
  placement: "hero" | "promo";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  image: string;
};
export type SeedStore = {
  slug: string;
  name: string;
  industry: string;
  template: string;
  domain: string;
  ownerEmail: string;
  ownerName: string;
  tagline: string;
  description: string;
  announcement: string;
  whatsapp: string;
  instagram: string;
  email: string;
  address: string;
  city: string;
  province: string;
  hours: string;
  categories: { name: string; image?: string; description?: string }[];
  banners: SeedBanner[];
  products: SeedProduct[];
  coupons: { code: string; description: string; type: "PERCENT" | "FIXED" | "FREE_SHIPPING"; value: number; minSubtotal?: number }[];
  freeShippingThreshold: number;
  transferDiscountPct: number;
  enableCash: boolean;
};

// Variant builders -----------------------------------------------------------
const C = {
  blanco: ["Blanco", "#f4f2ee"],
  negro: ["Negro", "#1d1d1b"],
  arena: ["Arena", "#d8c7ab"],
  gris: ["Gris melange", "#a9a9a6"],
  camel: ["Camel", "#b4835a"],
  oliva: ["Verde oliva", "#6b6b45"],
  celeste: ["Celeste", "#9fb8cf"],
  azul: ["Azul oscuro", "#2c3a52"],
  crudo: ["Crudo", "#ece4d4"],
  chocolate: ["Chocolate", "#5a3d2b"],
  terracota: ["Terracota", "#b45a3c"],
  rayado: ["Rayado azul", "#3c4f75"],
} as const;
type ColorKey = keyof typeof C;

function sizeColor(sizes: string[], colors: ColorKey[], stockFn: (si: number, ci: number) => number): SeedVariant[] {
  const out: SeedVariant[] = [];
  colors.forEach((c, ci) =>
    sizes.forEach((s, si) => out.push({ o1: s, o2: C[c][0], hex: C[c][1], stock: stockFn(si, ci) })),
  );
  return out;
}
const std = (si: number, ci: number) => [4, 8, 10, 7, 3][si % 5] + ci;
const low = (si: number, ci: number) => (si === 0 && ci === 0 ? 1 : [2, 3, 2, 1, 2][si % 5]);
const LETTERS = ["XS", "S", "M", "L", "XL"];
const SML = ["S", "M", "L"];
const SHOES = ["35", "36", "37", "38", "39", "40"];
const JEANS = ["34", "36", "38", "40", "42", "44"];

function colorsOnly(colors: ColorKey[], stock = [6, 4, 5]): SeedVariant[] {
  return colors.map((c, i) => ({ o2: C[c][0], hex: C[c][1], stock: stock[i % stock.length] }));
}

// ---------------------------------------------------------------------------
export const ALMA: SeedStore = {
  slug: "alma",
  name: "Alma Store",
  industry: "Moda",
  template: "fashion",
  domain: "almastore.com.ar",
  ownerEmail: "demo@bmdev.solutions",
  ownerName: "Sofía Medina",
  tagline: "Básicos que duran. Diseño que se nota.",
  description:
    "Alma es una marca de indumentaria femenina hecha en Buenos Aires. Prendas atemporales en algodón, lino y lana, pensadas para usar todos los días.",
  announcement: "3 cuotas sin interés · Envío gratis desde $120.000 · 10% off pagando por transferencia",
  whatsapp: "5491155550123",
  instagram: "almastore.ar",
  email: "hola@almastore.com.ar",
  address: "Gorriti 4870, Palermo",
  city: "CABA",
  province: "CABA",
  hours: "Lunes a sábado de 11 a 20 hs",
  freeShippingThreshold: 120000,
  transferDiscountPct: 10,
  enableCash: true,
  categories: [
    { name: "Remeras y tops", image: "cat-remeras", description: "Algodón peinado y morley, cortes rectos y boxy." },
    { name: "Buzos y sweaters", image: "cat-buzos", description: "Tejidos y frisas para los días frescos." },
    { name: "Pantalones y jeans", image: "cat-pantalones", description: "Denim rígido, cargo y sastreros." },
    { name: "Camperas y abrigos", image: "cat-camperas", description: "Capas para todo el invierno." },
    { name: "Vestidos y camisas", image: "cat-vestidos", description: "Lino, viscosa y estampas propias." },
    { name: "Calzado", image: "cat-calzado", description: "Zapatillas y botas de cuero." },
    { name: "Accesorios", image: "cat-accesorios", description: "Carteras, riñoneras, lentes y más." },
  ],
  banners: [
    {
      placement: "hero",
      eyebrow: "Colección Otoño–Invierno 26",
      title: "Capas que se sienten bien",
      subtitle: "Tejidos nobles, colores tierra y cortes amplios para todos los días.",
      ctaLabel: "Ver colección",
      ctaHref: "/productos?orden=nuevos",
      image: "banner-1",
    },
    {
      placement: "hero",
      eyebrow: "Denim",
      title: "El jean que buscabas",
      subtitle: "Wide leg, mom y cargo en denim rígido 100% algodón.",
      ctaLabel: "Comprar jeans",
      ctaHref: "/categorias/pantalones-y-jeans",
      image: "banner-2",
    },
    {
      placement: "promo",
      eyebrow: "Hasta 25% off",
      title: "Sale de temporada",
      subtitle: "Últimos talles de prendas seleccionadas.",
      ctaLabel: "Ver ofertas",
      ctaHref: "/productos?oferta=1",
      image: "banner-3",
    },
  ],
  coupons: [
    { code: "BIENVENIDA10", description: "10% off en tu primera compra", type: "PERCENT", value: 10 },
    { code: "ALMA5000", description: "$5.000 off en compras desde $60.000", type: "FIXED", value: 5000, minSubtotal: 60000 },
    { code: "ENVIOGRATIS", description: "Envío sin cargo", type: "FREE_SHIPPING", value: 0 },
  ],
  products: [
    {
      name: "Remera Essential",
      category: "Remeras y tops",
      price: 18900,
      description:
        "La remera que vas a querer en todos los colores. Algodón peinado 24/1 de 180 g, cuello redondo con ribb y calce recto que no se deforma con los lavados.\n\nModelo: 1,70 m, usa talle S.",
      images: ["remera-essential-1", "remera-essential-2"],
      featured: true,
      sold: 142,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(LETTERS, ["blanco", "negro", "arena"], std),
    },
    {
      name: "Remera Boxy Rayada",
      category: "Remeras y tops",
      price: 22500,
      compareAt: 26900,
      description:
        "Corte boxy, hombro caído y rayas tejidas (no estampadas). Jersey de algodón pesado que mantiene la forma.",
      images: ["remera-rayada-1", "remera-rayada-2"],
      sold: 64,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["rayado"], std),
    },
    {
      name: "Top Basic Ribb",
      category: "Remeras y tops",
      price: 14900,
      description: "Top al cuerpo en morley acanalado con elastano. Ideal para usar solo o como primera capa.",
      images: ["top-basic-1", "top-basic-2"],
      isNew: true,
      sold: 88,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["negro", "blanco", "chocolate"], std),
    },
    {
      name: "Musculosa Lino",
      category: "Remeras y tops",
      price: 19900,
      description: "Musculosa de lino lavado con terminación a la vista. Fresca, liviana y con caída natural.",
      images: ["musculosa-lino-1"],
      sold: 31,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["crudo", "negro"], low),
    },
    {
      name: "Buzo Oversize",
      category: "Buzos y sweaters",
      price: 46900,
      description:
        "Frisa invisible de algodón 320 g, interior perchado. Calce amplio, puños y cintura con ribb. Nuestro buzo más vendido.",
      images: ["buzo-oversize-1", "buzo-oversize-2"],
      featured: true,
      sold: 121,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["gris", "negro", "oliva"], std),
    },
    {
      name: "Sweater Trenza",
      category: "Buzos y sweaters",
      price: 54900,
      compareAt: 64900,
      description: "Tejido de punto trenzado con mezcla de lana. Cuello redondo, abrigado sin ser pesado.",
      images: ["sweater-trenza-1", "sweater-trenza-2"],
      featured: true,
      sold: 57,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["crudo", "camel"], std),
    },
    {
      name: "Cardigan Bruma",
      category: "Buzos y sweaters",
      price: 49900,
      description: "Cárdigan largo de punto suave con botones forrados. Una capa liviana para toda la temporada.",
      images: ["cardigan-bruma-1"],
      isNew: true,
      sold: 22,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(["S/M", "L/XL"], ["arena", "gris"], low),
    },
    {
      name: "Jean Wide Leg",
      category: "Pantalones y jeans",
      price: 52900,
      description:
        "Tiro alto, pierna amplia y largo al piso. Denim rígido 100% algodón de 13 oz que se amolda con el uso.",
      images: ["jean-wide-1", "jean-wide-2"],
      featured: true,
      isNew: true,
      sold: 133,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(JEANS, ["azul", "celeste"], std),
    },
    {
      name: "Jean Mom Celeste",
      category: "Pantalones y jeans",
      price: 48900,
      compareAt: 56900,
      description: "Calce mom de tiro alto con pierna recta al tobillo. Lavado celeste vintage.",
      images: ["jean-mom-1"],
      sold: 76,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(JEANS, ["celeste"], std),
    },
    {
      name: "Pantalón Cargo",
      category: "Pantalones y jeans",
      price: 45900,
      description: "Gabardina de algodón con bolsillos laterales y cintura con cordón ajustable en el ruedo.",
      images: ["pantalon-cargo-1", "pantalon-cargo-2"],
      isNew: true,
      sold: 49,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(LETTERS.slice(0, 4), ["oliva", "negro", "arena"], std),
    },
    {
      name: "Pantalón Sastrero",
      category: "Pantalones y jeans",
      price: 49900,
      description: "Pinzas al frente, tiro alto y pierna recta. Crepe con caída que no se arruga.",
      images: ["pantalon-sastrero-1"],
      sold: 38,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(LETTERS.slice(0, 4), ["negro", "camel"], std),
    },
    {
      name: "Campera Urban",
      category: "Camperas y abrigos",
      price: 89900,
      description: "Campera de jean oversize con botones metálicos y bolsillos parche. Un clásico que mejora con el tiempo.",
      images: ["campera-urban-1", "campera-urban-2"],
      featured: true,
      sold: 61,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["azul"], std),
    },
    {
      name: "Campera Puffer Nórdica",
      category: "Camperas y abrigos",
      price: 119900,
      compareAt: 139900,
      description: "Puffer liviana con relleno de guata siliconada y capucha desmontable. Repele agua y viento.",
      images: ["campera-puffer-1"],
      sold: 44,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["negro", "arena"], low),
    },
    {
      name: "Blazer Oversize",
      category: "Camperas y abrigos",
      price: 94900,
      description: "Blazer de corte masculino con hombreras suaves y forro de viscosa. Se lleva con jean o sastrero.",
      images: ["blazer-1", "blazer-2"],
      isNew: true,
      sold: 27,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["negro", "camel"], std),
    },
    {
      name: "Camisa Linen",
      category: "Vestidos y camisas",
      price: 39900,
      description: "Camisa de lino 100% con cuello clásico y bolsillo al pecho. Fresca, amplia y con textura natural.",
      images: ["camisa-linen-1", "camisa-linen-2"],
      sold: 69,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["blanco", "crudo", "celeste"], std),
    },
    {
      name: "Vestido Milano",
      category: "Vestidos y camisas",
      price: 62900,
      description: "Vestido midi de viscosa con escote cuadrado y breteles regulables. Va de día y de noche.",
      images: ["vestido-milano-1", "vestido-milano-2"],
      featured: true,
      sold: 53,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(LETTERS.slice(0, 4), ["negro"], std),
    },
    {
      name: "Vestido Midi Floral",
      category: "Vestidos y camisas",
      price: 58900,
      compareAt: 69900,
      description: "Estampa floral propia sobre crepe liviano. Cintura marcada con elástico y falda con vuelo.",
      images: ["vestido-floral-1"],
      sold: 35,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SML, ["crudo"], low),
    },
    {
      name: "Zapatillas Street",
      category: "Calzado",
      price: 84900,
      description: "Cuero vacuno con plantilla acolchada de memory foam y suela de caucho cosida. Hechas en Argentina.",
      images: ["zapatillas-street-1", "zapatillas-street-2"],
      featured: true,
      sold: 98,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SHOES, ["blanco"], std),
    },
    {
      name: "Botas Chelsea",
      category: "Calzado",
      price: 129900,
      description: "Cuero engrasado, elásticos laterales y suela de goma antideslizante de 3 cm.",
      images: ["botas-chelsea-1"],
      isNew: true,
      sold: 24,
      option1Name: "Talle",
      option2Name: "Color",
      variants: sizeColor(SHOES, ["negro", "chocolate"], low),
    },
    {
      name: "Cartera Siena",
      category: "Accesorios",
      price: 69900,
      description: "Cuero vacuno curtido al vegetal, correa regulable y cierre imantado. Entra todo lo que necesitás.",
      images: ["cartera-siena-1", "cartera-siena-2"],
      featured: true,
      sold: 72,
      option2Name: "Color",
      variants: colorsOnly(["camel", "negro", "chocolate"]),
    },
    {
      name: "Riñonera Cuero",
      category: "Accesorios",
      price: 34900,
      compareAt: 39900,
      description: "Riñonera de cuero con correa ajustable. Se usa en la cintura o cruzada.",
      images: ["rinonera-1"],
      sold: 41,
      option2Name: "Color",
      variants: colorsOnly(["negro", "camel"], [5, 2]),
    },
    {
      name: "Lentes de Sol Riviera",
      category: "Accesorios",
      price: 29900,
      description: "Marco de acetato y lentes con protección UV400. Incluye estuche rígido y paño.",
      images: ["lentes-riviera-1"],
      sold: 33,
      option2Name: "Color",
      variants: colorsOnly(["negro", "chocolate"], [9, 6]),
    },
    {
      name: "Gorro Lana",
      category: "Accesorios",
      price: 15900,
      description: "Gorro de punto inglés con mezcla de lana y doblez. Talle único.",
      images: ["gorro-lana-1"],
      sold: 47,
      option2Name: "Color",
      variants: colorsOnly(["crudo", "negro", "camel"], [12, 8, 0]),
    },
  ],
};

// ---------------------------------------------------------------------------
const single = (stock: number): SeedVariant[] => [{ stock }];
const sized = (list: [string, number, number][]): SeedVariant[] =>
  list.map(([o1, price, stock]) => ({ o1, price, stock }));

export const NATIVA: SeedStore = {
  slug: "nativa",
  name: "Nativa Skin",
  industry: "Cosmética",
  template: "beauty",
  domain: "nativaskin.com.ar",
  ownerEmail: "demo-nativa@bmdev.solutions",
  ownerName: "Lucía Paredes",
  tagline: "Cosmética natural, fórmulas honestas.",
  description: "Skincare vegano y cruelty free formulado en Córdoba con activos botánicos argentinos.",
  announcement: "Envío gratis desde $60.000 · Muestras de regalo en cada pedido",
  whatsapp: "5493515550456",
  instagram: "nativa.skin",
  email: "hola@nativaskin.com.ar",
  address: "Av. Rafael Núñez 4520, Cerro de las Rosas",
  city: "Córdoba",
  province: "Córdoba",
  hours: "Lunes a viernes de 10 a 19 hs",
  freeShippingThreshold: 60000,
  transferDiscountPct: 10,
  enableCash: false,
  categories: [
    { name: "Rostro", image: "serum-vitc-1" },
    { name: "Cuerpo", image: "aceite-almendras-1" },
    { name: "Kits y regalos", image: "kit-glow-1" },
  ],
  banners: [
    {
      placement: "hero",
      eyebrow: "Nuevo",
      title: "Tu rutina, más simple",
      subtitle: "Tres pasos, ingredientes naturales y resultados que se ven en semanas.",
      ctaLabel: "Armar mi rutina",
      ctaHref: "/categorias/rostro",
      image: "banner-1",
    },
    {
      placement: "promo",
      eyebrow: "Kit Glow",
      title: "Regalá cuidado",
      subtitle: "Sérum + crema + tónico con 20% off.",
      ctaLabel: "Ver kits",
      ctaHref: "/categorias/kits-y-regalos",
      image: "banner-2",
    },
  ],
  coupons: [{ code: "BIENVENIDA10", description: "10% off en tu primera compra", type: "PERCENT", value: 10 }],
  products: [
    { name: "Sérum Vitamina C 15%", category: "Rostro", price: 21900, description: "Ilumina y unifica el tono. Vitamina C estabilizada con ácido ferúlico y extracto de rosa mosqueta.", images: ["serum-vitc-1"], featured: true, sold: 210, option1Name: "Tamaño", variants: sized([["30 ml", 21900, 24], ["50 ml", 31900, 9]]) },
    { name: "Crema Hidratante Aloe", category: "Rostro", price: 17500, description: "Textura gel-crema de absorción rápida con aloe vera y ácido hialurónico. Para todo tipo de piel.", images: ["crema-aloe-1"], featured: true, sold: 164, option1Name: "Tamaño", variants: sized([["50 g", 17500, 30]]) },
    { name: "Gel Limpiador Facial", category: "Rostro", price: 12900, description: "Limpia sin resecar. Con niacinamida y té verde, pH balanceado.", images: ["limpiador-gel-1"], sold: 120, variants: single(40) },
    { name: "Protector Solar FPS 50", category: "Rostro", price: 19800, compareAt: 23500, description: "Toque seco, sin rastro blanco. Apto para usar debajo del maquillaje.", images: ["protector-solar-1"], featured: true, sold: 188, variants: single(18) },
    { name: "Bálsamo Labial Karité", category: "Rostro", price: 6500, description: "Manteca de karité y cera de abejas para labios suaves todo el día.", images: ["balsamo-labial-1"], isNew: true, sold: 95, variants: single(55) },
    { name: "Aceite Corporal Almendras", category: "Cuerpo", price: 15900, description: "Aceite seco de almendras dulces y vitamina E. Nutre sin dejar la piel grasa.", images: ["aceite-almendras-1"], sold: 72, variants: single(2) },
    { name: "Tónico de Rosas", category: "Rostro", price: 11900, description: "Agua de rosas destilada que equilibra y prepara la piel para el sérum.", images: ["tonico-rosas-1"], isNew: true, sold: 64, variants: single(26) },
    { name: "Mascarilla de Arcilla Verde", category: "Rostro", price: 13900, compareAt: 15900, description: "Purifica y matifica. Arcilla verde y aceite de árbol de té, una vez por semana.", images: ["mascarilla-arcilla-1"], sold: 51, variants: single(14) },
    { name: "Kit Rutina Glow", category: "Kits y regalos", price: 41900, compareAt: 52300, description: "Sérum Vitamina C + Crema Aloe + Tónico de Rosas en caja de regalo.", images: ["kit-glow-1"], featured: true, sold: 83, variants: single(11) },
    { name: "Jabón Artesanal de Avena", category: "Cuerpo", price: 5900, description: "Hecho en frío con avena coloidal y leche de cabra. Ideal para pieles sensibles.", images: ["jabon-avena-1"], sold: 140, variants: single(60) },
  ],
};

export const MIA: SeedStore = {
  slug: "mia",
  name: "Mía Pastelería",
  industry: "Pastelería",
  template: "food",
  domain: "miapasteleria.com.ar",
  ownerEmail: "demo-mia@bmdev.solutions",
  ownerName: "Mía Fernández",
  tagline: "Pastelería casera, hecha cada mañana.",
  description: "Tortas, tartas y dulces artesanales en Rosario. Pedidos con 24 hs de anticipación.",
  announcement: "Pedidos con 24 hs de anticipación · Envíos en Rosario y alrededores",
  whatsapp: "5493415550789",
  instagram: "mia.pasteleria",
  email: "pedidos@miapasteleria.com.ar",
  address: "Bv. Oroño 1250",
  city: "Rosario",
  province: "Santa Fe",
  hours: "Martes a domingo de 9 a 20 hs",
  freeShippingThreshold: 45000,
  transferDiscountPct: 5,
  enableCash: true,
  categories: [
    { name: "Tortas", image: "torta-rogel-1" },
    { name: "Tartas", image: "lemon-pie-1" },
    { name: "Dulces y boxes", image: "alfajores-1" },
    { name: "Panadería", image: "medialunas-1" },
  ],
  banners: [
    {
      placement: "hero",
      eyebrow: "Hecho hoy",
      title: "Tortas para cada ocasión",
      subtitle: "Rogel, chocotorta, cheesecake y más. Elegí el tamaño y te la llevamos.",
      ctaLabel: "Ver tortas",
      ctaHref: "/categorias/tortas",
      image: "banner-1",
    },
    {
      placement: "promo",
      eyebrow: "Para la merienda",
      title: "Box dulce para compartir",
      subtitle: "Alfajores, cookies y brownies listos para regalar.",
      ctaLabel: "Ver boxes",
      ctaHref: "/categorias/dulces-y-boxes",
      image: "banner-2",
    },
  ],
  coupons: [{ code: "BIENVENIDA10", description: "10% off en tu primer pedido", type: "PERCENT", value: 10 }],
  products: [
    { name: "Torta Rogel", category: "Tortas", price: 32000, description: "Capas finas de masa crocante, dulce de leche repostero y merengue italiano flambeado.", images: ["torta-rogel-1"], featured: true, sold: 96, option1Name: "Tamaño", variants: sized([["8 porciones", 32000, 6], ["16 porciones", 54000, 4]]) },
    { name: "Cheesecake Frutos Rojos", category: "Tortas", price: 29500, description: "Base de galletitas, crema de queso horneada y coulis casero de frutos rojos.", images: ["cheesecake-1"], featured: true, sold: 112, option1Name: "Tamaño", variants: sized([["8 porciones", 29500, 5], ["12 porciones", 41000, 3]]) },
    { name: "Lemon Pie", category: "Tartas", price: 24500, description: "Masa sablée, crema de limón bien ácida y merengue suizo.", images: ["lemon-pie-1"], sold: 88, option1Name: "Tamaño", variants: sized([["8 porciones", 24500, 7]]) },
    { name: "Chocotorta", category: "Tortas", price: 27000, compareAt: 30000, description: "La clásica: galletitas de chocolate, dulce de leche y queso crema. Sin horno, con mucho amor.", images: ["chocotorta-1"], featured: true, sold: 134, option1Name: "Tamaño", variants: sized([["8 porciones", 27000, 8], ["16 porciones", 46000, 3]]) },
    { name: "Box Alfajores de Maicena x12", category: "Dulces y boxes", price: 14500, description: "Alfajores de maicena con dulce de leche y coco rallado.", images: ["alfajores-1"], sold: 210, variants: single(20) },
    { name: "Cookies Chips de Chocolate x6", category: "Dulces y boxes", price: 9800, description: "Crocantes por fuera, húmedas por dentro, con chips de chocolate semiamargo.", images: ["cookies-1"], isNew: true, sold: 143, variants: single(25) },
    { name: "Brownie Box x9", category: "Dulces y boxes", price: 16900, description: "Brownies húmedos con nueces, cortados en 9 cuadrados.", images: ["brownies-1"], sold: 77, variants: single(2) },
    { name: "Medialunas de Manteca x12", category: "Panadería", price: 10500, description: "Hojaldradas, con almíbar. Salen del horno a las 8 hs.", images: ["medialunas-1"], sold: 260, variants: single(30) },
    { name: "Budín de Limón y Amapola", category: "Panadería", price: 8900, description: "Húmedo, con glaseado de limón.", images: ["budin-limon-1"], sold: 64, variants: single(12) },
    { name: "Macarons x12", category: "Dulces y boxes", price: 19900, description: "Pistacho, frambuesa, chocolate y dulce de leche. Caja de regalo.", images: ["macarons-1"], isNew: true, sold: 58, variants: single(9) },
  ],
};

export const NIDO: SeedStore = {
  slug: "nido",
  name: "Casa Nido",
  industry: "Decoración",
  template: "home",
  domain: "casanido.com.ar",
  ownerEmail: "demo-nido@bmdev.solutions",
  ownerName: "Julieta Ríos",
  tagline: "Objetos con alma para tu casa.",
  description: "Deco y bazar de diseño, con piezas hechas por artesanos argentinos.",
  announcement: "Envío gratis desde $90.000 · 6 cuotas sin interés",
  whatsapp: "5492615550321",
  instagram: "casanido.deco",
  email: "hola@casanido.com.ar",
  address: "Arístides Villanueva 380",
  city: "Mendoza",
  province: "Mendoza",
  hours: "Lunes a sábado de 10 a 20 hs",
  freeShippingThreshold: 90000,
  transferDiscountPct: 10,
  enableCash: false,
  categories: [
    { name: "Living", image: "almohadon-lino-1" },
    { name: "Cocina y mesa", image: "taza-gres-1" },
    { name: "Aromas e iluminación", image: "vela-soja-1" },
  ],
  banners: [
    {
      placement: "hero",
      eyebrow: "Colección Tierra",
      title: "Texturas que abrigan",
      subtitle: "Lino, algodón y cerámica en tonos naturales.",
      ctaLabel: "Explorar",
      ctaHref: "/productos",
      image: "banner-1",
    },
    {
      placement: "promo",
      eyebrow: "Mesa puesta",
      title: "Cerámica de autor",
      subtitle: "Piezas únicas hechas a mano en Mendoza.",
      ctaLabel: "Ver cocina y mesa",
      ctaHref: "/categorias/cocina-y-mesa",
      image: "banner-2",
    },
  ],
  coupons: [{ code: "BIENVENIDA10", description: "10% off en tu primera compra", type: "PERCENT", value: 10 }],
  products: [
    { name: "Almohadón de Lino", category: "Living", price: 18900, description: "Funda de lino lavado 50x50 con cierre invisible. Incluye relleno de vellón siliconado.", images: ["almohadon-lino-1"], featured: true, sold: 92, option1Name: "Color", variants: [{ o1: "Natural", stock: 12 }, { o1: "Terracota", stock: 8 }, { o1: "Verde salvia", stock: 5 }] },
    { name: "Manta Tejida Chunky", category: "Living", price: 54900, compareAt: 62900, description: "Tejido grueso a mano en hilado acrílico suave. 120x150 cm.", images: ["manta-tejida-1"], featured: true, sold: 41, option1Name: "Color", variants: [{ o1: "Crudo", stock: 4 }, { o1: "Gris", stock: 2 }] },
    { name: "Florero de Cerámica", category: "Living", price: 22500, description: "Cerámica esmaltada artesanal, 24 cm de alto. Cada pieza es única.", images: ["florero-ceramica-1"], isNew: true, sold: 37, variants: single(9) },
    { name: "Vela de Soja Lavanda", category: "Aromas e iluminación", price: 12900, description: "Cera de soja con mecha de algodón y aceite esencial de lavanda. 40 horas de duración.", images: ["vela-soja-1"], featured: true, sold: 156, variants: single(34) },
    { name: "Lámpara de Mesa Duna", category: "Aromas e iluminación", price: 68900, description: "Base de cerámica y pantalla de lino. Incluye lámpara LED cálida.", images: ["lampara-mesa-1"], sold: 19, variants: single(3) },
    { name: "Canasto de Seagrass", category: "Living", price: 26900, description: "Tejido a mano, ideal para plantas, mantas o juguetes. 35 cm de diámetro.", images: ["canasto-1"], sold: 48, variants: single(15) },
    { name: "Espejo Redondo Ratán", category: "Living", price: 49900, compareAt: 57900, description: "Marco de ratán natural, 60 cm de diámetro. Listo para colgar.", images: ["espejo-redondo-1"], sold: 26, variants: single(1) },
    { name: "Taza de Gres", category: "Cocina y mesa", price: 9900, description: "Gres esmaltado de 350 ml, apta microondas y lavavajillas.", images: ["taza-gres-1"], isNew: true, sold: 120, option1Name: "Color", variants: [{ o1: "Arena", stock: 20 }, { o1: "Verde", stock: 14 }] },
    { name: "Tabla de Madera Petiribí", category: "Cocina y mesa", price: 21900, description: "Tabla de servir en petiribí macizo curada con aceite mineral.", images: ["bandeja-madera-1"], sold: 63, variants: single(10) },
  ],
};

export const DETALLE: SeedStore = {
  slug: "detalle",
  name: "Detalle Regalos",
  industry: "Regalería",
  template: "minimal",
  domain: "detalleregalos.com.ar",
  ownerEmail: "demo-detalle@bmdev.solutions",
  ownerName: "Martín Ocampo",
  tagline: "El regalo justo, listo para entregar.",
  description: "Regalos con envoltorio incluido y tarjeta personalizada. Envíos en el día en CABA.",
  announcement: "Envoltorio de regalo sin cargo · Envíos en el día en CABA",
  whatsapp: "5491155550987",
  instagram: "detalle.regalos",
  email: "hola@detalleregalos.com.ar",
  address: "Av. Cabildo 2150, Belgrano",
  city: "CABA",
  province: "CABA",
  hours: "Lunes a sábado de 10 a 19 hs",
  freeShippingThreshold: 70000,
  transferDiscountPct: 10,
  enableCash: true,
  categories: [
    { name: "Boxes", image: "box-desayuno-1" },
    { name: "Para el mate", image: "set-mate-1" },
    { name: "Objetos", image: "agenda-1" },
  ],
  banners: [
    {
      placement: "hero",
      eyebrow: "Regalos con entrega en el día",
      title: "Sorprendé sin moverte de casa",
      subtitle: "Elegí el regalo, escribí la tarjeta y nosotros lo llevamos.",
      ctaLabel: "Ver regalos",
      ctaHref: "/productos",
      image: "banner-1",
    },
    {
      placement: "promo",
      eyebrow: "Boxes",
      title: "Desayunos para regalar",
      subtitle: "Armados en el día con productos frescos.",
      ctaLabel: "Ver boxes",
      ctaHref: "/categorias/boxes",
      image: "banner-2",
    },
  ],
  coupons: [{ code: "BIENVENIDA10", description: "10% off en tu primera compra", type: "PERCENT", value: 10 }],
  products: [
    { name: "Box Desayuno Clásico", category: "Boxes", price: 38900, description: "Bandeja de madera con medialunas, jugo, café, mermelada artesanal y tarjeta personalizada.", images: ["box-desayuno-1"], featured: true, sold: 142, variants: single(8) },
    { name: "Set Matero Calabaza", category: "Para el mate", price: 32900, compareAt: 36900, description: "Mate de calabaza forrado en cuero, bombilla de alpaca y yerbera. En caja de regalo.", images: ["set-mate-1"], featured: true, sold: 98, variants: single(12) },
    { name: "Caja de Bombones x16", category: "Boxes", price: 18500, description: "Bombones artesanales rellenos de dulce de leche, frutos rojos y café.", images: ["bombones-1"], sold: 117, variants: single(20) },
    { name: "Kit Aromas Difusor + Vela", category: "Objetos", price: 24900, description: "Difusor de varillas 100 ml y vela de soja con la misma fragancia: Té blanco.", images: ["kit-aromas-1"], isNew: true, sold: 64, variants: single(15) },
    { name: "Agenda 2027 Tapa Dura", category: "Objetos", price: 16900, description: "Semana a la vista, papel de 90 g y elástico de cierre.", images: ["agenda-1"], isNew: true, sold: 51, variants: single(25) },
    { name: "Taza Cerámica Artesanal", category: "Objetos", price: 11500, description: "Taza de cerámica esmaltada 300 ml hecha a mano.", images: ["taza-1"], sold: 73, variants: single(3) },
    { name: "Llavero de Cuero", category: "Objetos", price: 6900, description: "Cuero vacuno con argolla de bronce. Se puede grabar con iniciales.", images: ["llavero-cuero-1"], sold: 88, variants: single(40) },
    { name: "Portarretrato de Madera", category: "Objetos", price: 13900, compareAt: 15900, description: "Madera de pino con vidrio, foto 13x18.", images: ["portarretrato-1"], sold: 34, variants: single(10) },
  ],
};

export const SEED_STORES: SeedStore[] = [ALMA, NATIVA, MIA, NIDO, DETALLE];
