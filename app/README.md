# Chatbound

Chatbound transforme une archive de conversation WhatsApp en livre PDF, entièrement dans le navigateur. Aucun message ni média n'est envoyé vers un serveur.

## Développement

Prérequis : Node.js 22 ou plus récent.

```bash
npm install
npm run dev
```

L'application est ensuite disponible sur l'adresse affichée par Vite, généralement `http://localhost:5173`.

## Vérifications

```bash
npm test
npm run lint
npm run build
npm audit
```

Les icônes PWA peuvent être régénérées après modification de `public/chatbound-icon.svg` :

```bash
npm run generate:pwa-assets
```

## Fonctionnement V1

- Import d'une archive ZIP WhatsApp iOS ou Android.
- Atelier unifié autour de l’aperçu : Essentiels pour le titre, Souvenirs pour la sélection, Organiser pour la structure et Apparence pour la mise en page.
- Actions de fichier regroupées dans le menu Projet ; annuler, rétablir, état de sauvegarde et création du PDF restent dans la barre d’outils.
- Détection des messages multilignes, événements système et médias joints.
- Extraction paresseuse des photos pour limiter l'utilisation mémoire.
- Sélection de la période, des participants et des contenus optionnels.
- Tiroir chronologique avec recherche multi-termes, vues Tout, Photos et Masqués.
- Inclusion ou exclusion individuelle et actions groupées sur les résultats.
- Choix explicite d’une photo de couverture et navigation directe vers sa page.
- Sauts de page manuels attachés à un message, conservés même si la pagination évolue.
- Chapitres nommés avec titre éditorial imprimé et démarrage garanti sur une nouvelle page.
- Réglage direct des chapitres et nouvelles pages depuis chaque message de l’aperçu `page-stage`.
- Espace Souvenirs docké à gauche sur desktop et affiché comme dialogue plein écran sur tablette/mobile.
- Période, participants et contenus optionnels regroupés dans Souvenirs avec la recherche, les vues et les exclusions.
- Hauteur de l’espace docké bornée à l’atelier ; sa chronologie défile sans déplacer l’aperçu ni la barre d’outils.
- Annuler/rétablir depuis la barre d’outils ou avec `Cmd/Ctrl+Z` et `Cmd/Ctrl+Shift+Z`.
- Sauvegarde automatique des réglages dans IndexedDB, restaurée après réimport du même ZIP.
- La sauvegarde locale ne contient ni messages, ni photos, ni blobs ; l’archive reste nécessaire à chaque nouvelle session.
- Export d’un fichier projet portable `.chatbound` versionné et inférieur à 1 Mo.
- Import sur un autre navigateur, puis rattachement obligatoire au ZIP d’origine par empreinte stable.
- Rejet explicite d’un ZIP qui ne correspond pas au projet.
- Jusqu’à cinq projets locaux récents proposés sur l’accueil.
- Styles Carnet, Messages et Album.
- Formats A5, A4, Letter et carré, en portrait ou paysage.
- Prévisualisation aux dimensions physiques identiques au document imprimé.
- Photos affichées sans recadrage, dans des cadres bornés par la page.
- Répartition automatique de la hauteur par nombre de photos plutôt que par nombre de dates.
- Compensation des légendes et messages textuels pour préserver une surface photo régulière.
- En style Album, deux photos courtes partagent une ligne ; les longues légendes et photos orphelines passent en pleine largeur.
- Réglage global de `1 à 6` photos maximum par page, sauvegardé avec le projet et compatible annuler/rétablir.
- Rapport prépresse avant chaque PDF : DPI effectif, dimensions naturelles et taille imprimée de chaque photo.
- Classement qualité : excellente à partir de 300 DPI, correcte de 180 à 299 DPI, faible sous 180 DPI, ou indisponible.
- Navigation directe du rapport vers chaque page problématique.
- Sélection directe d’une photo dans l’aperçu `page-stage`, au clic ou au clavier.
- Inspecteur individuel contextuel : Auto, Large, Demi-page ou Pleine page.
- Cadrage Ajuster sans recadrage ou Remplir volontairement avec point focal horizontal/vertical.
- Rotation 0°, 90°, 180° ou 270° et affichage local de la légende.
- Réinitialisation individuelle à l’automatique, avec annuler/rétablir, IndexedDB et `.chatbound`.
- Accès secondaire au même inspecteur depuis Souvenirs.
- Sélection directe de la photo de couverture avec cadrage Ajuster/Remplir, point focal et rotation dédiés.
- Réglages de couverture indépendants de la même photo dans le corps, persistés dans IndexedDB et `.chatbound`.
- Quatrième de couverture optionnelle, en photo plein cadre ou texte seul, avec texte, position, voile, cadrage, point focal et rotation dédiés.
- Légendes photo modifiables localement sans altérer le ZIP WhatsApp.
- Pages de dédicace, introduction, texte personnel ancré ou final, page blanche et épilogue.
- Sommaire automatique recalculé après chaque repagination, y compris sur plusieurs pages.
- Pseudonymes et couleurs personnalisés par participant dans l’aperçu et le PDF.
- Pages signalées et navigation directe par couverture, sommaire, chapitres, textes, repères et quatrième de couverture.
- Espace Organiser docké sur desktop et modal accessible sur tablette/mobile, avec chapitres, nouvelles pages, sommaire, pages personnelles, identités et repères.
- Seules les identités des participants inclus dans Souvenirs sont affichées ; leurs profils restent conservés lorsqu’ils sont temporairement masqués.
- Signet rouge directement sur chaque page de conversation, y compris sur une continuation précise.
- Slider de navigation pour parcourir rapidement les livres de plusieurs centaines de pages.
- Mode livre ouvert : couverture seule, première page à droite, puis doubles pages imprimées 2–3, 4–5, etc.
- Le mode double page se replie automatiquement quand l’espace devient insuffisant et reste absent du PDF.
- Espace Apparence docké sur desktop et modal accessible sur tablette/mobile.
- Mode de composition, format, orientation, taille du texte et densité photo exposés en premier ; typographie, couleurs et détails restent dans Personnalisation avancée repliable.
- Presets Intemporel, Moderne, Correspondance, Graphique et Minimal, indépendants de Carnet/Messages/Album.
- Paires typographiques, interlignage, densité et marges structurées avec repagination immédiate.
- Couleurs papier, texte et accent avec contraste contrôlé ; accents et palettes participant ajustés automatiquement.
- Numéros de page extérieurs, centrés ou masqués.
- Format de date Complète/Courte/Chiffrée indépendant du style Classique/Cartouche/Minimal.
- Espacement physique de `1em` entre deux journées en mode Album, partagé par aperçu et PDF.
- Scroll desktop confiné à l’atelier ; Essentiels, Souvenirs, Organiser et Apparence défilent indépendamment sans étendre `html`.
- Photos nettes, douces ou encadrées ; chapitres classiques, en bandeau ou minimaux.
- Couvertures divisée, pleine image ou typographique, avec titre bas-gauche/centré et voile sécurisé.
- Couleurs et arrière-plans préservés à l’impression via `print-color-adjust: exact`.
- Snapshot PDF atomique : le document en préparation ne change pas si l’atelier continue d’être modifié.
- Préparation PDF bornée lorsque les frames ou le décodage d’image sont suspendus dans un onglet en arrière-plan.
- Continuations automatiques pour les messages et légendes trop longs.
- Vérification géométrique de chaque page avant ouverture du dialogue PDF.
- Téléchargement PDF direct dans un Web Worker, sans dialogue navigateur ni blocage de l’atelier.
- Texte sélectionnable, fontes locales incorporées, métadonnées, liens de sommaire et signets PDF.
- Impression PDF du système conservée comme solution de repli après le même contrôle prépresse.
- Installation PWA et fonctionnement hors ligne du shell applicatif.

Les archives de test restent hors du dossier `app` et sont ignorées par Git à la racine du projet.

## Fichier `.chatbound`

Le fichier portable contient les réglages du livre : titre, format, participants inclus, exclusions, couverture, quatrième de couverture, chapitres, sauts de page, densité photo, pseudonymes, légendes locales, pages blanches et textes personnels. Il peut donc contenir des noms et du contenu éditorial privé.

Il ne contient jamais le texte des messages, les photos, les blobs ni des URL locales. Le ZIP WhatsApp d’origine reste nécessaire pour rouvrir le livre.
