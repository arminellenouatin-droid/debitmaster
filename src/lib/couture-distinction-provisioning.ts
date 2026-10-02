export const DISTINCTION_DEMO_NAME = "DISTINCTION";

export const distinctionSitesSpec = [
  // 1 Atelier à Lomé
  {
    name: "Atelier Central Kodjoviakopé",
    siteType: "ATELIER" as const,
    country: "Togo",
    city: "Lomé",
    address: "Quartier Kodjoviakopé, Lomé, Togo",
    currency: "FCFA",
    latitude: 6.1285,
    longitude: 1.2150,
  },
  // 3 Boutiques à Lomé
  {
    name: "Boutique Nyékonakpoè",
    siteType: "BOUTIQUE" as const,
    country: "Togo",
    city: "Lomé",
    address: "Boulevard Circulaire, Nyékonakpoè, Lomé",
    currency: "FCFA",
    latitude: 6.1340,
    longitude: 1.2080,
  },
  {
    name: "Boutique Hôtel 2 Février",
    siteType: "BOUTIQUE" as const,
    country: "Togo",
    city: "Lomé",
    address: "Galerie Marchande, Hôtel 2 Février, Lomé",
    currency: "FCFA",
    latitude: 6.1315,
    longitude: 1.2175,
  },
  {
    name: "Boutique Agoè Minamadou",
    siteType: "BOUTIQUE" as const,
    country: "Togo",
    city: "Lomé",
    address: "Carrefour Minamadou, Agoè-Nyivé, Lomé",
    currency: "FCFA",
    latitude: 6.2100,
    longitude: 1.1950,
  },
  // 2 Boutiques à Douala (Cameroun)
  {
    name: "Boutique Bonamoussadi",
    siteType: "BOUTIQUE" as const,
    country: "Cameroun",
    city: "Douala",
    address: "Rond-Point Maçon, Bonamoussadi, Douala",
    currency: "XAF",
    latitude: 4.0750,
    longitude: 9.7350,
  },
  {
    name: "Boutique Bonapriso",
    siteType: "BOUTIQUE" as const,
    country: "Cameroun",
    city: "Douala",
    address: "Rue Tokoto, Bonapriso, Douala",
    currency: "XAF",
    latitude: 4.0250,
    longitude: 9.6980,
  },
];

export const distinctionPriceMatrix = [
  { model: "Goodluck", leader: 120_000, vip: 200_000, royale: 350_000, presidentiel: 500_000 },
  { model: "Danshiki", leader: 150_000, vip: 350_000, royale: 500_000, presidentiel: 700_000 },
  { model: "Agbada", leader: 300_000, vip: 500_000, royale: 700_000, presidentiel: 900_000 },
  { model: "Abacost", leader: 250_000, vip: 400_000, royale: 600_000, presidentiel: 900_000 },
  { model: "Robe", leader: 100_000, vip: 200_000, royale: 350_000, presidentiel: 600_000 },
  { model: "Boubou", leader: 100_000, vip: 200_000, royale: 350_000, presidentiel: 500_000 },
];

export const distinctionStaffSummary = {
  atelierLome: {
    chefAtelier: 1,
    coupeurs: 2,
    couturiers: 10,
    brodeurs: 5,
    magasinierAtelier: 1,
    totalAtelier: 19,
  },
  boutiquesLome: {
    nyekonakpoe: { chefAgence: 1, vendeuses: 3 },
    hotel2Fevrier: { chefAgence: 1, vendeuses: 3 },
    agoeMinamadou: { chefAgence: 1, vendeuses: 3 },
    totalBoutiquesLome: 12,
  },
  boutiquesDouala: {
    bonamoussadi: { chefAgence: 1, vendeuses: 3 },
    bonapriso: { chefAgence: 1, vendeuses: 3 },
    totalBoutiquesDouala: 8,
  },
  administrationCentrale: {
    comptable: 1,
    directeurMarketing: 1,
    directeurCommunication: 1,
    directeurRH: 1,
    chargeAchats: 1,
    agentsEntretien: 2,
    gardiens: 3,
    totalAdmin: 10,
  },
  totalGeneralEmployes: 49,
};

export const distinctionWorkSchedulesSpec = [
  {
    staffCategory: "BOUTIQUE" as const,
    days: [1, 2, 3, 4, 5, 6], // Lundi à Samedi
    morningStart: "09:00",
    morningEnd: "13:00",
    afternoonStart: "15:00",
    afternoonEnd: "21:00",
    isDayOff: false,
  },
  {
    staffCategory: "BOUTIQUE" as const,
    days: [0], // Dimanche
    morningStart: "10:00",
    morningEnd: "13:00",
    afternoonStart: "15:00",
    afternoonEnd: "19:00",
    isDayOff: false,
  },
  {
    staffCategory: "ADMIN" as const,
    days: [1, 2, 3, 4, 5, 6], // Lundi à Samedi
    morningStart: "08:00",
    morningEnd: "12:00",
    afternoonStart: "14:00",
    afternoonEnd: "18:00",
    isDayOff: false,
  },
  {
    staffCategory: "ADMIN" as const,
    days: [0], // Dimanche repos
    morningStart: null,
    morningEnd: null,
    afternoonStart: null,
    afternoonEnd: null,
    isDayOff: true,
  },
  {
    staffCategory: "ATELIER" as const,
    days: [1, 2, 3, 4, 5, 6], // Lundi à Samedi (8h-11h, 12h-15h, 16h-20h)
    morningStart: "08:00",
    morningEnd: "11:00",
    afternoonStart: "12:00",
    afternoonEnd: "15:00",
    eveningStart: "16:00",
    eveningEnd: "20:00",
    isDayOff: false,
  },
  {
    staffCategory: "ATELIER" as const,
    days: [0], // Dimanche repos
    morningStart: null,
    morningEnd: null,
    afternoonStart: null,
    afternoonEnd: null,
    isDayOff: true,
  },
];
