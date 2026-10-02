export type CoutureProductionStepType =
  | "COUPE"
  | "COUTURE"
  | "BRODERIE"
  | "FINITION_REPASSAGE"
  | "CONTROLE_QUALITE"
  | "EMBALLAGE"
  | "LIVRAISON";

export type CoutureStepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

export type CoutureCardStatus =
  | "QUEUED"
  | "IN_PRODUCTION"
  | "QUALITY_CONTROL"
  | "PACKED"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type CouturePriority = "NORMAL" | "URGENT" | "VERY_URGENT";

export type ProductionStepDefinition = {
  stepOrder: number;
  stepType: CoutureProductionStepType;
  label: string;
  requiredCraft?: "COUPEUR" | "COUTURIER" | "BRODEUR_MAIN" | "BRODEUR_MACHINE" | "FINISSEUR";
};

/**
 * Génère le numéro séquentiel d'une fiche de fabrication : FAB-YYYY-XXXXXX.
 */
export function generateProductionCardNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `FAB-${year}-${padded}`;
}

/**
 * Construit la séquence fixe standard des étapes de fabrication.
 * Coupe -> Couture -> Broderie (optionnelle) -> Finition & Repassage -> Contrôle Qualité -> Emballage -> Livraison
 */
export function buildDefaultProductionSteps(hasEmbroidery = false): ProductionStepDefinition[] {
  const steps: ProductionStepDefinition[] = [
    { stepOrder: 1, stepType: "COUPE", label: "Coupe du tissu", requiredCraft: "COUPEUR" },
    { stepOrder: 2, stepType: "COUTURE", label: "Assemblage & Couture", requiredCraft: "COUTURIER" },
  ];

  let order = 3;
  if (hasEmbroidery) {
    steps.push({
      stepOrder: order++,
      stepType: "BRODERIE",
      label: "Broderie (main ou machine)",
      requiredCraft: "BRODEUR_MAIN",
    });
  }

  steps.push({
    stepOrder: order++,
    stepType: "FINITION_REPASSAGE",
    label: "Finition, pose boutons & repassage",
    requiredCraft: "FINISSEUR",
  });
  steps.push({
    stepOrder: order++,
    stepType: "CONTROLE_QUALITE",
    label: "Contrôle qualité de conformité",
  });
  steps.push({
    stepOrder: order++,
    stepType: "EMBALLAGE",
    label: "Emballage & Housse de protection",
  });
  steps.push({
    stepOrder: order++,
    stepType: "LIVRAISON",
    label: "Expédition / Livraison boutique",
  });

  return steps;
}

/**
 * Vérifie si le métier d'un ouvrier est compatible avec l'étape de production.
 */
export function isCraftCompatibleWithStep(
  crafts: string[],
  stepType: CoutureProductionStepType
): boolean {
  if (stepType === "CONTROLE_QUALITE" || stepType === "EMBALLAGE" || stepType === "LIVRAISON") {
    return true; // Étapes gérées par le chef d'atelier ou magasinier
  }

  const normalizedCrafts = crafts.map((c) => c.toUpperCase());

  if (stepType === "COUPE") {
    return normalizedCrafts.includes("COUPEUR");
  }

  if (stepType === "COUTURE") {
    return normalizedCrafts.includes("COUTURIER");
  }

  if (stepType === "BRODERIE") {
    return normalizedCrafts.includes("BRODEUR_MAIN") || normalizedCrafts.includes("BRODEUR_MACHINE");
  }

  if (stepType === "FINITION_REPASSAGE") {
    return normalizedCrafts.includes("FINISSEUR") || normalizedCrafts.includes("COUTURIER");
  }

  return false;
}

/**
 * Détermine le statut global de la fiche de fabrication selon l'étape courante et les contrôles.
 */
export function resolveCardStatusFromStep(
  stepType: CoutureProductionStepType,
  stepStatus: CoutureStepStatus
): CoutureCardStatus {
  if (stepStatus === "REJECTED") return "IN_PRODUCTION";

  switch (stepType) {
    case "COUPE":
    case "COUTURE":
    case "BRODERIE":
    case "FINITION_REPASSAGE":
      return "IN_PRODUCTION";
    case "CONTROLE_QUALITE":
      return stepStatus === "COMPLETED" ? "PACKED" : "QUALITY_CONTROL";
    case "EMBALLAGE":
      return stepStatus === "COMPLETED" ? "READY_FOR_DELIVERY" : "PACKED";
    case "LIVRAISON":
      return stepStatus === "COMPLETED" ? "DELIVERED" : "READY_FOR_DELIVERY";
    default:
      return "IN_PRODUCTION";
  }
}
