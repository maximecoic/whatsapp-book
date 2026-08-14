# Chatbound

**Chatbound** transforme une archive WhatsApp en un livre PDF personnalisable, sans que la conversation quitte l'ordinateur.

Le code de l'application se trouve dans [`app`](app). Le cahier des charges et les décisions produit sont consignés dans [`whatsapp-book.md`](whatsapp-book.md).

```bash
cd app
npm install
npm run dev
```

Fonctionnalités actuelles : import ZIP iOS/Android, association des photos, recherche et sélection chronologique, choix de couverture, chapitres, sauts de page manuels, annuler/rétablir, sauvegarde automatique locale, trois styles éditoriaux, formats papier et orientations multiples, aperçu physique fidèle, photos sans recadrage, contrôle prépresse, téléchargement PDF direct et installation PWA.

L’atelier est organisé autour de l’aperçu avec quatre responsabilités explicites : **Essentiels** pour le titre, **Souvenirs** pour la sélection, **Organiser** pour la structure et **Apparence** pour la mise en page. Les commandes de fichier sont regroupées dans le menu **Projet**.

La mise en page automatique privilégie une surface cohérente par photo, même lorsque plusieurs dates partagent une page. Les légendes sont compensées et les mosaïques Album adaptent leur nombre de colonnes à la longueur du texte.

L’espace **Apparence** permet de limiter globalement la densité de 1 à 6 photos par page. Avant l’impression, un rapport prépresse calcule le DPI réel de chaque image à sa taille imprimée et permet d’ouvrir directement les pages à vérifier.

La branche `0.9.0-dev` génère désormais le PDF localement dans un Web Worker. Le document conserve des dimensions physiques fixes, du texte sélectionnable, des fontes incorporées, des métadonnées, les liens du sommaire et les signets éditoriaux. L’impression système reste disponible comme solution de repli.

Un projet peut être exporté en `.chatbound`, transféré sur un autre ordinateur puis rouvert en sélectionnant le ZIP WhatsApp correspondant. L’accueil affiche également les projets locaux récents. Le fichier projet contient les réglages et certains noms, mais jamais les messages ou médias.

Chaque photo du livre est directement sélectionnable dans l’aperçu. Un inspecteur contextuel permet de modifier sa disposition, son cadrage, son point focal, sa rotation et sa légende, sans quitter la page courante. Les mêmes réglages sont accessibles depuis **Souvenirs**.

Chaque message propose également un réglage direct de chapitre et de nouvelle page. Sur desktop, les espaces **Souvenirs**, **Organiser** et **Apparence** remplacent temporairement Essentiels à gauche sans masquer l’aperçu ; sur les écrans plus étroits, ils deviennent des dialogues plein écran accessibles au clavier.

La photo de couverture est elle aussi sélectionnable directement dans l’aperçu. Son mode Ajuster/Remplir, son point focal et sa rotation sont indépendants des réglages de la même photo dans le corps du livre. Une quatrième de couverture optionnelle peut reprendre une photo ou rester typographique, avec son propre texte, voile, cadrage et rotation. Dans **Souvenirs**, l’en-tête et le pied restent visibles tandis que la chronologie défile dans la hauteur disponible.

L’espace **Organiser** permet d’ajouter une dédicace, une introduction, des interludes, des pages blanches ou un épilogue, générer un sommaire, créer des chapitres et nouvelles pages, personnaliser les noms et couleurs des participants et signaler des pages. Ces éléments sont paginés et imprimés par le même moteur que la conversation, avec navigation directe dans l’aperçu.

La navigation de l’aperçu propose également un slider adapté aux livres longs et un mode **livre ouvert** : couverture seule, première page à droite, puis doubles pages 2–3, 4–5, etc. Un signet rouge permet de signaler directement une page de conversation. Ces contrôles restent propres à l’atelier et n’entrent jamais dans le PDF.

L’espace **Apparence** sépare la direction artistique du mode de composition. Les choix courants restent visibles en premier ; cinq univers — Intemporel, Moderne, Correspondance, Graphique et Minimal — peuvent ensuite être affinés dans une personnalisation avancée repliable. L’aperçu et le document imprimé utilisent exactement les mêmes variables structurées.

En Album, chaque nouvelle journée retrouve un espace de respiration avant sa date. Le format des dates — complet, court ou chiffré — est indépendant de leur traitement visuel : Classique avec séparateur, Cartouche coloré ou Minimal.

Sur desktop, l’atelier reste strictement confiné à la hauteur du viewport : Essentiels, Souvenirs, Organiser et Apparence conservent leurs propres zones de défilement sans faire défiler la page entière. Sur mobile, l’aperçu précède Essentiels et les trois espaces spécialisés s’ouvrent en plein écran.

Les archives et dossiers de conversations placés à la racine sont des données privées locales et sont exclus de Git.