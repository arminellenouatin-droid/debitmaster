// ============================================================================
// DebitManager — Design tokens (docs/design-system.md)
// Source unique partagée avec le web (web/tailwind.config.js).
// ============================================================================
import 'package:flutter/material.dart';

abstract class DmColors {
  // Marque
  static const primary = Color(0xFF0F4C3A);
  static const primaryLight = Color(0xFFE8F3EE);
  static const secondary = Color(0xFFD9A441);

  // Sémantiques (clair / sombre)
  static const success = Color(0xFF1E8E3E);
  static const successDark = Color(0xFF3DDC84);
  static const warning = Color(0xFFF59E0B);
  static const warningDark = Color(0xFFFBBF24);
  static const danger = Color(0xFFDC2626);
  static const dangerDark = Color(0xFFF87171);
  static const info = Color(0xFF2563EB);
  static const infoDark = Color(0xFF60A5FA);

  // Neutres
  static const backgroundLight = Color(0xFFFFFFFF);
  static const backgroundDark = Color(0xFF0E1512);
  static const surfaceLight = Color(0xFFF7F8F7);
  static const surfaceDark = Color(0xFF182420);
  static const borderLight = Color(0xFFE2E4E2);
  static const borderDark = Color(0xFF2A3833);
  static const textPrimary = Color(0xFF111827);
  static const textPrimaryDark = Color(0xFFF3F4F2);
  static const textSecondary = Color(0xFF6B7280);
  static const textSecondaryDark = Color(0xFF9CA69F);
}

abstract class DmSpace {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const xxl = 48.0;
  static const touchTarget = 48.0; // zone tactile minimale
}

abstract class DmRadius {
  static const sm = 6.0;
  static const md = 12.0;
  static const lg = 20.0;
}

abstract class DmType {
  static const display = TextStyle(fontSize: 32, fontWeight: FontWeight.w700);
  static const h1 = TextStyle(fontSize: 24, fontWeight: FontWeight.w700);
  static const h2 = TextStyle(fontSize: 20, fontWeight: FontWeight.w600);
  static const h3 = TextStyle(fontSize: 17, fontWeight: FontWeight.w600);
  static const body = TextStyle(fontSize: 15, fontWeight: FontWeight.w400);
  static const caption = TextStyle(fontSize: 13, fontWeight: FontWeight.w400);
  static const button = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);
}

ThemeData dmTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  return ThemeData(
    brightness: brightness,
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: DmColors.primary,
      brightness: brightness,
      surface: dark ? DmColors.surfaceDark : DmColors.surfaceLight,
    ),
    scaffoldBackgroundColor: dark ? DmColors.backgroundDark : DmColors.backgroundLight,
    textTheme: TextTheme(
      displayMedium: DmType.display,
      headlineMedium: DmType.h1,
      titleLarge: DmType.h2,
      titleMedium: DmType.h3,
      bodyMedium: DmType.body,
      labelLarge: DmType.button,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: DmColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(DmSpace.touchTarget),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(DmRadius.md)),
        textStyle: DmType.button,
      ),
    ),
  );
}
