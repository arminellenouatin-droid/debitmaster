import 'package:flutter/material.dart';
import 'theme/tokens.dart';

void main() => runApp(const DebitManagerApp());

class DebitManagerApp extends StatelessWidget {
  const DebitManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DebitManager',
      debugShowCheckedModeBanner: false,
      theme: dmTheme(Brightness.light),
      darkTheme: dmTheme(Brightness.dark),
      themeMode: ThemeMode.system,
      home: const LandingScreen(),
    );
  }
}

/// Écran d'accueil (icônes + gros boutons tactiles, minimum de texte).
class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(DmSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: DmColors.primary,
                  borderRadius: BorderRadius.circular(DmRadius.md),
                ),
                child: const Center(
                  child: Text('D', style: TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: DmSpace.lg),
              Text('DebitManager', style: DmType.h1, textAlign: TextAlign.center),
              const SizedBox(height: DmSpace.sm),
              Text(
                'La gestion de votre bar, maquis ou restaurant',
                style: DmType.body.copyWith(color: DmColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              FilledButton(child: const Text('Connexion'), onPressed: () {}),
              const SizedBox(height: DmSpace.sm),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(DmSpace.touchTarget),
                  foregroundColor: DmColors.primary,
                  side: const BorderSide(color: DmColors.primary, width: 2),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(DmRadius.md)),
                ),
                child: const Text('Inscription'),
                onPressed: () {},
              ),
            ],
          ),
        ),
      ),
    );
  }
}
