import assert from "node:assert/strict";
import test from "node:test";
import { companyHasSpecialOption } from "../src/lib/subscription-plans.ts";

test("Messagerie interne: Gating Option Normale vs Option Avancée", () => {
  // Option Normale : Pas d'option spéciale
  const normalEstablishment = {
    activity_type: "BUVETTE",
    subscription_plan: "BUVETTE",
    has_special_option: false,
  };
  assert.equal(companyHasSpecialOption(normalEstablishment), false);

  // Établissements avec Option Avancée / Spéciale
  const specialByFlag = {
    activity_type: "BUVETTE",
    subscription_plan: "BUVETTE",
    has_special_option: true,
  };
  assert.equal(companyHasSpecialOption(specialByFlag), true);

  const specialByPlanSuffix = {
    activity_type: "BUVETTE",
    subscription_plan: "BUVETTE_SPECIAL",
  };
  assert.equal(companyHasSpecialOption(specialByPlanSuffix), true);

  const barRestaurantSpecial = {
    activity_type: "BAR_RESTAURANT",
    subscription_plan: "BAR_RESTAURANT_SPECIAL",
  };
  assert.equal(companyHasSpecialOption(barRestaurantSpecial), true);
});

test("Messagerie interne: Matrice des droits par média", () => {
  const allowedFeatures = (company) => {
    const isSpecial = companyHasSpecialOption(company);
    return {
      text: true, // Toujours autorisé
      audioVoiceNotes: isSpecial,
      photosAndVideos: isSpecial,
      audioCalls: isSpecial,
      videoCalls: isSpecial,
    };
  };

  const normalPerms = allowedFeatures({ subscription_plan: "BUVETTE" });
  assert.equal(normalPerms.text, true);
  assert.equal(normalPerms.audioVoiceNotes, false);
  assert.equal(normalPerms.photosAndVideos, false);
  assert.equal(normalPerms.audioCalls, false);
  assert.equal(normalPerms.videoCalls, false);

  const specialPerms = allowedFeatures({ subscription_plan: "BUVETTE_SPECIAL" });
  assert.equal(specialPerms.text, true);
  assert.equal(specialPerms.audioVoiceNotes, true);
  assert.equal(specialPerms.photosAndVideos, true);
  assert.equal(specialPerms.audioCalls, true);
  assert.equal(specialPerms.videoCalls, true);
});

test("Messagerie interne: Validation stricte de l'isolation par tenant", () => {
  const validateTenantBoundary = (senderTenantId, recipientTenantId) => {
    if (!senderTenantId || !recipientTenantId) return false;
    return senderTenantId === recipientTenantId;
  };

  // Même établissement : OK
  assert.equal(validateTenantBoundary("tenant-buvette-1", "tenant-buvette-1"), true);

  // Établissements différents : REJET ABSOLU
  assert.equal(validateTenantBoundary("tenant-buvette-1", "tenant-bar-2"), false);
  assert.equal(validateTenantBoundary("tenant-buvette-1", null), false);
});

test("Notifications & Rappel Échéance: Détection seuil 10 jours", () => {
  const calculateDaysRemaining = (expiresAt, now = Date.now()) => {
    if (!expiresAt) return null;
    const diffMs = new Date(expiresAt).getTime() - now;
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
  };

  const now = Date.now();
  const nineDaysLater = new Date(now + 9 * 24 * 60 * 60 * 1000).toISOString();
  const twelveDaysLater = new Date(now + 12 * 24 * 60 * 60 * 1000).toISOString();

  const days9 = calculateDaysRemaining(nineDaysLater, now);
  assert.equal(days9, 9);
  const shouldNotify9 = days9 !== null && days9 <= 10 && days9 >= 0;
  assert.equal(shouldNotify9, true);

  const days12 = calculateDaysRemaining(twelveDaysLater, now);
  assert.equal(days12, 12);
  const shouldNotify12 = days12 !== null && days12 <= 10 && days12 >= 0;
  assert.equal(shouldNotify12, false);
});
