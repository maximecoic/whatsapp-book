# Chatbound — roadmap produit

Cette roadmap décrit les prochains jalons après la version 0.7. Les priorités peuvent évoluer selon les tests d’impression et les retours d’usage.

## Livré

- **0.1** — Import ZIP WhatsApp, parseur iOS/Android, aperçu paginé, styles, formats et PDF via impression native.
- **0.2** — Sélection chronologique, recherche, exclusions, couverture et sauvegarde locale IndexedDB.
- **0.3** — Chapitres, sauts de page et historique annuler/rétablir.
- **0.3.1** — Cohérence automatique de la surface des photos et planification Album.
- **0.4** — Densité photo globale et rapport prépresse DPI.
- **0.5** — Projet portable `.chatbound`, rattachement sécurisé au ZIP et projets récents.
- **0.6** — Réglages photo individuels directement dans l’aperçu, overrides persistants et prépresse adapté.
- **0.6.1** — Chapitres et nouvelles pages directement dans l’aperçu, avec panneau Contenu docké sur desktop.
- **0.6.2** — Panneau Contenu à hauteur bornée et cadrage/rotation dédiés de la photo de couverture.
- **0.7** — Édition éditoriale : légendes locales, pages personnelles, sommaire, identités et navigation de livre.
- **0.7.1** — Identités actives, switches corrigés, signets directs, slider de pages et aperçu livre ouvert.
- **0.8** — Direction artistique : presets, typographie, couleurs, pages, éléments et couvertures personnalisables.
- **0.8.1** — Rythme vertical Album et traitements Classique, Cartouche ou Minimal des dates.
- **0.8.2** — Confinement du scroll desktop et ancrage accessible des checkboxes Participants.
- **0.8.3** — Atelier unifié autour de l’aperçu, espaces Souvenirs/Organiser/Apparence, menu Projet et préparation PDF robuste en arrière-plan.

## 0.9 — PDF direct et impression professionnelle (en cours)

Premier incrément livré dans `0.9.0-dev` :

- Téléchargement PDF direct sans dialogue navigateur, avec impression système conservée en repli.
- Rendu dans un Web Worker pour préserver la réactivité sur les livres longs.
- Texte sélectionnable, polices WOFF incorporées, liens de sommaire et signets de couverture, chapitres et pages éditoriales.
- Métadonnées titre, auteurs, langue, sujet, dates de conversation, créateur et producteur.
- Formats physiques fixes, points focaux, rotations, cadrages, couleurs, couvertures et numérotation issus du snapshot Chatbound.
- Quatrième de couverture photo ou texte et pages personnelles blanches, partagées par aperçu, impression et PDF direct.

À poursuivre dans le jalon :

- Profils écran, impression domestique et imprimeur.
- Fond perdu, zones de sécurité et traits de coupe.
- Validation des combinaisons composition × style × format.
- Évaluation de PDF/X, profils ICC et d’un emballage desktop Tauri si nécessaire.

## 0.10 — médias WhatsApp supplémentaires

- Décodage HEIC local et vérification PNG/WebP.
- Stickers.
- Vidéos avec vignette et QR code.
- Audios avec durée et QR code.
- Documents avec miniature et état de compatibilité.
- Localisations avec carte statique lorsque possible sans serveur.

## 0.11 — grandes archives

- Parseur, miniatures et traitement d’images dans des Web Workers.
- Réduction des images à la résolution d’impression utile.
- Cache persistant des miniatures.
- Libération progressive des blobs et suivi mémoire.
- Protection renforcée contre les archives fortement compressées.
- Reprise après interruption.

## Bêta publique

- Corpus anonymisé d’exports iOS et Android réels, groupes et discussions individuelles.
- Plusieurs langues et formats de date.
- Tests Playwright intégrés et captures visuelles de référence.
- CI GitHub pour tests, build et audit.
- Déploiement HTTPS afin d’activer PWA et service worker hors localhost.
- Documentation utilisateur et politique de confidentialité explicite.