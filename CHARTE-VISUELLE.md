# Charte visuelle Upside Down Training

Règle d'Alexis : **tout contenu créé dans l'app doit être harmonisé.** Peu importe le module
(force, endurance, gymnastique, ou tout module futur), le résultat visuel doit être le même.

## Fiches exportées (zones, profils, tests)

Toutes les fiches image passent par **`zones-export.js`** (`udtZonesExport.png(data)`), jamais par
un rendu maison. Le modèle impose la charte :

- **fond teal** `#0B9488`, cartes teal foncé, texte crème/blanc ;
- **logo Upside Down** en haut (logo par défaut si le module n'en fournit pas) ;
- **palette des zones** (de la plus facile à la plus dure) :
  | Couleur | Hex | Usage |
  |---|---|---|
  | Bleu | `#3B8FEA` | zone 1 / vitesse maximale |
  | Vert | `#22B35E` | zone 2 / vitesse-force |
  | Jaune | `#E8C21C` | zone 3 / puissance max |
  | Orange | `#F58A1F` | zone 4 / force-vitesse |
  | Rouge | `#E5483B` | zone 5 / force maximale |
  | Violet | `#9B6CF0` | zone 6 (au-delà de Z5) |
- polices : Space Grotesk (titres, chiffres) et Inter (texte).

Si un module envoie un autre thème, pas de logo ou une couleur hors palette, le modèle **corrige
automatiquement** et affiche une **alerte « non harmonisé »** (bandeau rouge + `console.warn`).
L'alerte signifie qu'il faut corriger le module à la source.

Palette et logo sont exposés : `udtZonesExport.palette`, `udtZonesExport.logo`.

## Séances (texte des séances)

- Charges et cibles de vitesse en teal `#2dd4bf` ; cibles en italique.
- Seuls les titres et les formats sont en gras.

## Nouveau module

1. Réutiliser les tokens CSS existants (`--accent #0B9488`, `--bad`, `--warn`, etc.) et le thème clair/sombre.
2. Exporter les fiches via `udtZonesExport` avec la palette ci-dessus.
3. Vérifier qu'aucune alerte « non harmonisé » ne s'affiche à l'export.
