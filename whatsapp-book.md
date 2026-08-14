# Chatbound — vision produit

- Application simple prenant en entrée une archive exportée d’une conversation WhatsApp (texte + médias/photos).
- Produit un livre PDF mis en page à partir de la chronologie de la conversation.
- L’utilisateur choisit le format et l’orientation : A4 ou autre format, portrait ou paysage.
- La mise en page doit intégrer harmonieusement messages, dates, participants et photos contenues dans l’archive.
- Questions produit à trancher : application web locale/PWA ou application desktop portable, prise en charge exacte des exports Android/iOS, formats papier et styles proposés, limites de volume, confidentialité et éventuelle impression.
- Priorité pressentie : traitement local sur l’appareil, sans envoi des conversations vers un serveur, prévisualisation avant export et fonctionnement multi-plateforme.

## Décisions V1

- Nom produit : **Chatbound** — « Your conversations, beautifully bound ».
- Type : application web locale installable (PWA), utilisable sur macOS, Windows et Linux depuis un navigateur moderne.
- Architecture : React + TypeScript + Vite, sans backend ; lecture ZIP et création du livre dans le navigateur.
- Confidentialité : aucune archive, conversation ou photo n’est envoyée sur le réseau ou stockée par l’application.
- Export : document paginé aux dimensions choisies, transmis au dialogue d’impression du système pour l’enregistrement en PDF.
- Fidélité : l’aperçu utilise les mêmes dimensions physiques et la même typographie que le document imprimé, puis est réduit uniformément à l’écran.
- Photos : ratio intrinsèque conservé avec `contain`, cadres flexibles bornés par la page et grille Album adaptée aux photos seules ou multiples.
- Contrôle prépresse : toutes les pages, images, légendes et zones de texte sont inspectées après décodage des médias ; l’impression est bloquée si un élément sort de la page ou si un cadre photo devient trop petit.
- Textes longs : messages et légendes sont répartis sur des pages de continuation explicites.
- Formats : A5, A4, Letter et carré ; portrait ou paysage.
- Styles : Carnet éditorial, Messages et Album.
- Filtres : période, participants, messages système, médias absents et messages supprimés.
- Compatibilité testée : export iOS français comprenant caractères directionnels, messages multilignes et 498 photos ; parseur également couvert pour le format Android anglais.
- Évolution possible : emballage desktop Tauri à partir de la même base si les limites mémoire du navigateur deviennent gênantes sur de très grandes archives.

## État de la V1

- Application située dans `app/` ; les archives privées restent à la racine et sont exclues de Git.
- 74 tests automatisés couvrent le parseur, le lecteur ZIP paresseux, les filtres, formats, continuations, pagination, composition, direction artistique, traitements de date, contrastes, overrides photo et éditoriaux, sommaire adaptatif, signets de continuation, densité globale, calcul DPI, bornes géométriques, sélection de contenu, persistance IndexedDB, projet portable et historique annuler/rétablir.
- Build PWA, lint et audit npm validés.

## Jalon 0.2 — édition du contenu

- Tiroir chronologique avec recherche accent-insensible et multi-termes.
- Vues Tout, Photos et Masqués, miniatures chargées seulement à proximité de l’écran.
- Inclusion/exclusion individuelle ou groupée, avec mise à jour immédiate des compteurs et de la pagination.
- Navigation depuis un résultat vers sa page dans le livre.
- Choix d’une photo de couverture, indépendant de son inclusion dans le corps du livre.
- Sauvegarde automatique IndexedDB identifiée par une empreinte stable du texte de conversation.
- Reprise automatique après réimport du même ZIP ; réinitialisation explicite disponible.
- Seuls les réglages, identifiants exclus et nom du média de couverture sont stockés ; aucun message, média ou blob n’est persisté.

## Jalon 0.3 — structure éditoriale

- Saut de page manuel avant n’importe quel message inclus.
- Chapitre nommé avant un message, avec nouvelle page implicite et en-tête éditorial partagé par l’aperçu et le PDF.
- Actions disponibles directement dans chaque ligne de la chronologie ; éditeur de titre inline sur desktop et mobile.
- Historique borné à 100 états avec coalescence des saisies rapides.
- Boutons annuler/rétablir et raccourcis `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z` hors champs de saisie.
- Chapitres et sauts persistés dans IndexedDB, validés contre les identifiants du ZIP lors de la reprise.
- En-têtes de chapitre ajoutés au contrôle prépresse géométrique.

## Correctif 0.3.1 — cohérence photo par défaut

- La hauteur disponible est répartie selon le nombre de photos de chaque date, et non plus également entre les dates.
- Le coût des légendes et messages textuels est compensé au niveau de la date et de chaque bloc photo.
- Sur la page A4 de référence, les cadres passent de `138 / 124 / 61 / 61 px` à `91 / 97 / 103 / 103 px`.
- Sur les 153 pages Carnet A4 de référence : ratio médian `1,07`, aucune page au-delà de 1,5×, cadre minimal `82 px`, zéro débordement.
- Album planifie ses lignes : paires courtes en deux colonnes, longues légendes et photos orphelines en pleine largeur, lignes texte à hauteur naturelle.
- Export complet vérifié : 153 pages, 499 images, aucun cadre écrasé, aucun élément hors page et aucune page au-delà de 2× d’écart.

## Jalon 0.4 — réglages photo et prépresse

- Nouveau panneau **Réglages des photos** avec maximum global de 1 à 6 photos par page ; valeur par défaut 4.
- La limite est une contrainte dure du paginateur, persistée dans IndexedDB et incluse dans annuler/rétablir.
- Mesure sur l’épisode d’octobre : 4 max = 9 pages / cadre min 91 px ; 2 max = 13 pages / 161 px ; 1 max = 25 pages / 403 px.
- Rapport obligatoire avant PDF, calculé sur le document physique après décodage des images.
- DPI effectif calculé selon dimensions naturelles, cadre imprimé et mode `contain`/`cover`.
- Seuils : excellente ≥ 300 DPI ; correcte 180–299 ; faible < 180 ; indisponible si le média ne peut être décodé.
- Les avertissements indiquent page, fichier, pixels, taille imprimée et DPI, avec navigation directe vers l’aperçu.
- Une image faible doit être imprimée plus petite : le rapport recommande plus de densité ou un format de page inférieur, sans automatisme trompeur.
- Archive complète à densité 6 : 499 images, 442 excellentes, 54 correctes, 3 faibles, 0 indisponible.
- Matrice extrême validée : 48 configurations (3 styles × 4 formats × 2 orientations × limites 1/6) à 120 %, sans dépassement de limite, cadre écrasé ni débordement.

## Jalon 0.5 — projet portable

- Export JSON versionné avec extension `.chatbound`, nom ASCII dérivé du titre et limite de 1 Mo.
- Le fichier contient l’empreinte stable du texte source, le nom attendu du ZIP et les réglages du livre.
- Aucun message, média, blob ou URL locale n’est exporté ; les noms des participants inclus, le titre et le nom d’archive restent présents comme métadonnées de réglage.
- À l’import, le ZIP d’origine est obligatoire et son empreinte doit correspondre exactement ; une autre conversation est refusée sans perdre le projet en attente.
- Tous les champs externes sont normalisés selon une liste blanche ; formats, thèmes, dates, couleurs, échelles et références invalides sont ramenés aux valeurs sûres.
- Reprise validée sur une origine navigateur vierge : import `.chatbound`, rattachement du ZIP, restauration des réglages et création du projet IndexedDB local.
- L’accueil propose jusqu’à cinq projets récents, chacun demandant à nouveau son ZIP privé.

## Jalon 0.6 — réglages photo individuels

- Clic ou activation clavier directement sur une photo dans `page-stage`, avec contour de sélection et affordance de réglage.
- Inspecteur contextuel non modal à droite sur desktop et feuille basse responsive sur mobile.
- Dispositions : automatique, pleine largeur, demi-page et pleine page isolée.
- Cadrage : `contain` par défaut ou `cover` volontaire avec point focal horizontal et vertical.
- Rotation : 0°, 90°, 180° et 270°, y compris pour les images non carrées sans sortir du cadre.
- Légende affichable/masquable localement ; une légende masquée ne pèse plus dans la pagination et ne génère pas de continuation.
- Reset individuel, annuler/rétablir et badge « Photo réglée » dans le tiroir Contenu.
- Overrides normalisés à l’import, persistés dans IndexedDB et inclus dans `.chatbound` sans média.
- Pagination Pleine page, grilles Demi-page, Album et Messages partagées par l’aperçu et le PDF.
- Prépresse adapté aux rotations et recadrages volontaires ; dimensions visibles du cadre affichées en mode Remplir.
- Matrice réelle validée sur 24 combinaisons style/format/orientation à 120 %, sans débordement, cadre écrasé, image échappée ni page pleine contenant plusieurs photos.

## Correctif 0.6.1 — atelier structurel

- Bouton contextuel sur chaque message de `page-stage` pour créer, modifier ou supprimer un chapitre et basculer un saut de page.
- Inspecteur non modal qui suit le message après repagination et réutilise l’historique, IndexedDB et le format `.chatbound` existants.
- Chapitre et saut redondant restent exclusifs ; le chapitre garantit déjà une nouvelle page.
- Panneau Contenu intégré comme troisième colonne entre 1101 px et les grands écrans, sans backdrop ni verrouillage du défilement.
- Sous 1101 px, le même composant conserve son dialogue en surimpression avec backdrop, fermeture Échap et verrouillage du body.

## Correctif 0.6.2 — couverture et panneau Contenu

- La troisième colonne Contenu est contrainte à la hauteur de l’atelier ; en-tête, filtres et pied restent fixes, seule la chronologie utilise `overflow-y: auto`.
- Clic ou activation clavier directement sur la photo de couverture pour ouvrir l’inspecteur contextuel.
- Cadrage Ajuster/Remplir, point focal horizontal/vertical et rotation 0°/90°/180°/270° propres à la couverture.
- L’override est lié au média de couverture et reste indépendant des réglages de la même photo dans les pages intérieures.
- Valeurs normalisées à la reprise, persistées dans IndexedDB et `.chatbound`, intégrées à annuler/rétablir et au reset.
- Aperçu, document imprimé et calcul DPI partagent le même cadrage ; aucune affordance d’édition n’entre dans le PDF.

## Jalon 0.7 — édition éditoriale

- Légendes photo locales limitées à 2 000 caractères, appliquées à la pagination sans mutation du message source.
- Pages de dédicace, introduction, texte libre avant un message ou en fin de livre, et épilogue ; textes longs continués sur des pages isolées.
- Raccourci depuis chaque message pour insérer directement une page personnelle à cet emplacement.
- Sommaire automatique dérivé des pages finales, réparti au-delà de 14 entrées et recalculé après chaque repagination.
- Pseudonymes et couleurs par participant, partagés par l’aperçu, Contenu et le document imprimé.
- Signets nommés depuis l’inspecteur de structure et navigation par couverture, textes, sommaire, chapitres et pages signalées.
- Une page dont le message d’ancrage sort de la sélection reste dans le livre et est placée à la fin ; les signets indisponibles sont signalés.
- Panneau Éditorial docké comme troisième colonne sur desktop et dialogue plein volet sur tablette/mobile.
- Tous les champs sont historisés, normalisés, sauvegardés dans IndexedDB et inclus dans `.chatbound` avec contrôle UTF-8 de la limite de 1 Mo.
- PDF purement éditorial autorisé même sans message sélectionné ; pages éditoriales et sommaire intégrés au contrôle géométrique prépresse.

## Correctif 0.7.1 — navigation et aperçu livre

- La liste Identités suit les participants inclus dans Composition, sans supprimer les profils des personnes temporairement décochées.
- États visuels cochés et focus clavier corrigés pour les switches Sommaire, Légende, Nouvelle page et réglages généraux.
- Signet rouge accessible directement en haut à droite de chaque page de conversation, avec cible tactile indépendante du zoom.
- Un signet posé sur une continuation cible sa partie exacte et retombe sur le début du message si une repagination supprime cette partie.
- Slider inférieur pour parcourir les pages ; en mode livre ouvert, chaque pas correspond à un spread réellement différent.
- Aperçu double page optionnel : couverture seule, première page intérieure à droite, puis pages imprimées 2–3, 4–5, etc.
- Repli automatique en mono-page sous 720 px de largeur utile ou lorsqu’un panneau latéral réduit l’atelier.
- Numéros de navigation alignés sur les numéros imprimés : Couverture, Page 1, Pages 2–3.
- Slider, signets et spread restent exclus du document imprimé et ne modifient jamais la géométrie PDF.

## Jalon 0.8 — direction artistique

- Mode de composition Carnet/Messages/Album séparé de la direction artistique.
- Cinq presets indépendants et clonables : Intemporel, Moderne, Correspondance, Graphique et Minimal.
- Paires de polices Éditorial, Littéraire, Contemporain et Correspondance, avec interlignage 1,20–1,80 intégré à la pagination.
- Densité Aérée/Équilibrée/Compacte avec marges et capacité de page cohérentes.
- Couleurs Papier/Texte/Accent ; contrôle WCAG 4,5:1, blocage PDF du couple texte/papier insuffisant et ajustement automatique des accents, palettes et couleurs secondaires.
- Numéros Extérieur/Centré/Masqué, dates Complètes/Courtes/Minimales, cadres photo Nets/Doux/Encadrés et chapitres Classique/Bandeau/Minimal.
- Palette participant Personnalisée/Accent/Neutre, avec couleurs rendues lisibles sur le papier.
- Couvertures Divisée/Pleine image/Typographique, titre Bas gauche/Centré et voile pleine image 55–80 %.
- Panneau Style docké ou modal accessible : focus initial, piège Tab, inert du fond, fermeture backdrop/Échap et restitution du focus.
- Tous les paramètres normalisés et persistés dans IndexedDB et `.chatbound` ; migration 0.7 vers Intemporel et fichiers partiels complétés depuis leur preset.
- Aperçu et PrintDocument partagent les mêmes fonctions de classes/variables ; couleurs préservées avec `print-color-adjust: exact`.
- Snapshot PDF atomique dérivé d’un seul clone des réglages, messages filtrés et pages.
- Sommaire adaptatif au format, à l’orientation, à la densité et à l’interlignage ; A5 paysage extrême mesuré sans overflow.
- Matrice navigateur validée : 120 combinaisons (5 presets × 3 compositions × 4 formats × 2 orientations) à 120 %, zéro page hors stage, overflow ou cadre écrasé.

## Correctif 0.8.1 — rythme Album et dates

- Le mode Album ajoute `1em` avant chaque `.book-day` suivant le premier ; Carnet et Messages restent inchangés.
- Mesure de référence : environ 9,3 px visibles dans l’aperçu réduit, 12 px physiques dans le document imprimé, sans cadre photo écrasé.
- Format des dates séparé du traitement visuel : Complète, Courte ou Chiffrée.
- Styles de dates structurés : Classique avec ligne, Cartouche sur fond accent contrasté, Minimal sans séparateur.
- Presets : Intemporel/Correspondance en Classique, Moderne/Graphique en Cartouche, Minimal en Minimal.
- Le poids de pagination suit le traitement de date ; Minimal réserve moins de hauteur que Classique.
- Réglage normalisé, historisé, persisté dans IndexedDB et `.chatbound`, avec migration automatique depuis 0.8.0.
- Matrice dédiée validée : 27 combinaisons (3 formats × 3 traitements × 3 compositions) à 120 %, zéro overflow.
- Prépresse Album validé pour les trois traitements : mêmes classes, couleurs, bordures et espacement dans aperçu/PDF.

## Correctif 0.8.2 — confinement du scroll desktop

- Les inputs invisibles de la liste Participants étaient en `position: absolute` sans contenant positionné ; ils s’échappaient du panneau scrollable et étendaient `html` de 900 à 1 313 px.
- Chaque checkbox est désormais ancrée à son `label` en `position: relative`, avec un focus clavier visible sur la case personnalisée.
- À 1 440 × 900 et 1 101 × 900, `html`, `body`, `#root` et le viewport font exactement la même hauteur, avec `scrollY = 0`.
- Le panneau Composition conserve son scroll interne (`1 454 / 770 px`) et la liste Participants le sien (`246 / 190 px`).
- Confinement validé avec focus du dernier participant, Contenu, Éditorial, Style et vue livre ouverte ; aucun état ne réintroduit de scroll racine.
