# Charte visuelle UPSIDE — v2 « gris » (novembre 2026)

Référence de style : post Instagram « Ce que j'aime », site alexisgarnier (version site11), carrousel « Séances types ».
S'applique à : posts et carrousels Instagram, stories, fiches et dossiers clients, site, outils de l'app Upside Down Training.

## 1. Principes
- **Fond sombre gris**, jamais de teal plein en fond. Le teal est un **accent** : barres, chiffres clés, boutons, onglet actif, offre mise en avant.
- **Photo N&B réservée à l'accroche** (couverture, story, offre). Les contenus à données (fiches, séances, zones) sont sur le fond gris.
- **Composition centrée** pour les posts : sur-titre → grand titre → barre teal → contenu en cartes → phrase de conclusion.
- Une même information a toujours la même couleur partout (zones, seuils).

## 2. Couleurs
| Rôle | Valeur |
|---|---|
| Fond | `#161616` + image `fond-gris.jpg` (gris flouté, plus clair au centre) |
| Cartes | `rgba(0,0,0,.34)`, bordure `rgba(246,244,232,.08–.12)`, rayon 16 px |
| Texte principal | crème `#F6F4E8` |
| Texte secondaire | crème 60–72 % `rgba(246,244,232,.68)` |
| Accent teal | `#14A595` (boutons, barres, sur-titres) · teal foncé `#0F8F80` (bouton au repos) |
| Formulaires | fond crème `#F6F4E8`, texte `#161616` |

### Seuils (2 seulement)
| Seuil | Couleur | Position |
|---|---|---|
| S1 | teal clair `#7FF0DF` | entre domaine modéré et domaine élevé |
| S2 | teal soutenu `#19C2AE` | entre domaine élevé et domaine sévère |

La PMA n'est **pas** un seuil (résultat de test) : ne jamais l'afficher comme tel.
La limite sévère / extrême est une simple limite de domaine : « / » ou trait gris neutre, sans étiquette.

### Zones et domaines
| Domaine | Zones | Couleurs |
|---|---|---|
| Modéré | Z1 Récupération active · Z2 Endurance fondamentale | Z1 `#3B8FEA` · Z2 `#22B35E` |
| Élevé | Z3 Tempo · Z4 Seuil | Z3 `#E8C21C` · Z4 `#F58A1F` |
| Sévère | Z5 VO2max | Z5 `#E5483B` |
| Extrême | Z6 Sprint long · Z7 Sprint court | Z6 `#9B6CF0` · Z7 `#E86BB4` |

Bandeau continuum : **Z1 Z2 // Z3 Z4 // Z5 / Z6 Z7** (// = seuil en teal, / = limite neutre).

## 3. Typographie
| Usage | Police |
|---|---|
| Grands titres, chiffres clés, codes de zone | **Anton**, MAJUSCULES, italique simulé (inclinaison −9 à −11°) |
| Sur-titres | Space Grotesk 700, majuscules, espacement 0,22–0,3 em, teal |
| Texte, prescriptions | Space Grotesk 500 / 700 |
| Texte long (site, app) | Inter 400 / 600 |

## 4. Éléments récurrents
- **Logo** crème (lettres UPSIDE DOWN + TRAINING) : en haut à droite sur les posts, centré en bas sur les stories et couvertures photo.
- **Barre teal** 240 × 8 px sous le titre.
- **Cartes chiffres** : valeur en Anton, libellé en dessous en crème 70 %.
- **Phrase de fin** : première partie crème, seconde partie teal.
- Pas d'indicateur de page (« 2/3 ») sur les carrousels.

## 5. Formats
- Post / carrousel : 1080 × 1350. Story : 1080 × 1920.
- Export 2× puis réduit, JPG qualité 93.

## 6. Mise en œuvre technique
- **Site** : `charte.css` chargé après `styles.css` (retirer la ligne = retour à l'ancienne charte).
- **App** : mêmes valeurs dans un fichier unique de variables, importé par tous les outils ; `zones-export.js` produit les fiches sur ce modèle ; script de contrôle des couleurs hors charte avant chaque mise en ligne.
- **Visuels** : générateur `style2.py` (séances types), fond `fonds/A-gris-avant.jpg`.


## 7. Dans l'app (règles techniques)

Règle d'Alexis : **tout contenu créé dans l'app doit être harmonisé.** Peu importe le module
(force, endurance, gymnastique, ou tout module futur), le résultat visuel doit être le même.

- **Écrans des outils** : `charte-v2.css` est chargé en dernier dans chaque outil (lactate/RPE, PC/VC,
  charge-vitesse, VBT, EF). Il redéfinit les variables (`--bg`, `--panel`, `--line`, `--text`, `--muted`,
  `--accent`…), le fond gris (`/img/fond-gris.jpg`) et les titres Anton (`/fonts/anton-latin-400-normal.woff2`).
  Nouveau module : utiliser ces variables et ajouter la même ligne `<link rel="stylesheet" href="/charte-v2.css?v=1">`.
- **Fiches exportées** : toujours via `zones-export.js` (`udtZonesExport.png(data)`), jamais de rendu maison.
  Le modèle impose le thème `gris` (fond gris + halo, cartes sombres, titre Anton, seuil 1 en teal, logo crème).
  Un module qui envoie un thème inconnu, pas de logo ou une couleur hors palette est corrigé automatiquement
  et une alerte « non harmonisé » s'affiche : il faut alors corriger le module à la source.
- **Palette des zones dans les fiches** (`udtZonesExport.palette`) : bleu `#3B8FEA`, vert `#22B35E`, jaune `#E8C21C`,
  orange `#F58A1F`, rouge `#E5483B`, violet `#9B6CF0`. Charge-vitesse : du plus léger/rapide au plus lourd
  (vitesse max bleu → vitesse-force vert → puissance max jaune → force-vitesse orange → force max rouge).
- **Domaines** : modéré, élevé, sévère, extrême (Z6/Z7). **2 seuils** seulement ; la PMA n'est pas un seuil.
- Thème clair (`data-theme="light"`) : conservé tel quel pour l'instant.
- Après modification d'un outil, incrémenter sa version dans `outils.js`.
