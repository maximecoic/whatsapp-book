# Chatbound

**Chatbound** transforme une archive WhatsApp en un livre PDF personnalisable, sans que la conversation quitte l'ordinateur.

Le code de l'application se trouve dans [`app`](app). Le cahier des charges et les décisions produit sont consignés dans [`whatsapp-book.md`](whatsapp-book.md).

```bash
cd app
npm install
npm run dev
```

Fonctionnalités actuelles : import ZIP iOS/Android, association des photos, recherche et sélection chronologique, choix de couverture, chapitres, sauts de page manuels, annuler/rétablir, sauvegarde automatique locale, quatre compositions et huit ambiances graphiques, formats papier et orientations multiples, aperçu physique fidèle, photos sans recadrage, contrôle prépresse, téléchargement PDF direct et installation PWA.

L’atelier est organisé autour de l’aperçu avec quatre accès permanents : **Couverture** pour le titre et le choix de photo, **Souvenirs** pour la sélection, **Organiser** pour la structure et **Apparence** pour la mise en page. Sur ordinateur, navigation, commandes de fichier et export partagent une barre compacte ; les statistiques et les en-têtes des panneaux sont réduits pour privilégier le livre. Sur mobile, les commandes tiennent sur deux lignes et les panneaux restent accessibles en plein écran.

L’accueil propose une entrée unique pour ouvrir une archive ZIP ou un projet `.chatbound`, par sélection de fichier ou glisser-déposer. Les projets récents restent accessibles et l’ouverture est verrouillée pendant la lecture de l’archive.

Dans **Souvenirs**, la recherche, le type de contenu, l’état des filtres et la position dans la liste sont conservés lorsqu’on change d’espace ou règle une photo. Fermer un inspecteur ramène à l’espace depuis lequel il a été ouvert. Les filtres de période et de participants sont repliés par défaut pour privilégier les résultats ; les actions **Tout inclure** et **Tout masquer** s’appliquent aux résultats courants.

Collage privilégie les photographies : il compare plusieurs répartitions en rangées et adapte les cadres aux proportions réelles des portraits, paysages et images tournées. Si la page manque de hauteur, les cadres rétrécissent proportionnellement et restent centrés, sans ajouter de grandes bandes blanches autour des images. Une page impaire peut associer une photo dominante et une paire, selon le contenu. Les messages sans photo restent à leur place chronologique parmi les images. La date, l’auteur et l’heure sont regroupés pour laisser plus de place aux photos, sans imposer de recadrage.

Les dimensions sont relevées progressivement lors de l’affichage et complétées avant l’export. Le cache reste propre à l’archive ouverte et n’entre pas dans les réglages sauvegardés. La préparation du PDF recalcule la pagination avec les dimensions connues afin que le plan partagé par l’aperçu et le PDF reste cohérent.

L’espace **Apparence** permet de limiter globalement la densité de 1 à 6 photos par page et de choisir un format personnalisé de 80 à 420 mm par côté. Ce nombre de photos est un maximum : de longues légendes ou beaucoup de notes peuvent nécessiter une page supplémentaire plutôt que des photos illisibles. Avant l’impression, un rapport prépresse calcule le DPI réel de chaque image à sa taille imprimée et permet d’ouvrir directement les pages à vérifier.

Le PDF est généré localement dans un Web Worker et son export peut être annulé. Les formats d’image lisibles par le navigateur, notamment WebP, sont convertis lorsque le moteur PDF l’exige ; les photos surdimensionnées sont adaptées à leur plus grande taille d’impression avec une marge de 330 DPI, sans agrandir celles qui sont déjà de résolution insuffisante. Les JPEG de couverture sont normalisés pour respecter leur orientation EXIF ; les modes Ajuster et Remplir, le point focal et la rotation sont appliqués au rendu PDF. Les ressources temporaires sont libérées après l’export.

Le PDF incorpore les sous-ensembles de polices utilisés (Roboto et Roboto Slab, proches des polices de l’aperçu, ainsi que des polices Noto de secours pour les symboles, emojis et plusieurs écritures) et conserve son texte sélectionnable, ses dimensions physiques, ses métadonnées, les liens du sommaire et les signets éditoriaux. Les emojis sont monochromes et leurs variantes de teint ne sont pas conservées. Chaque export direct vérifie que toutes les polices référencées sont incorporées ; certains caractères ou signes invisibles non couverts peuvent encore bloquer l’export. Cette vérification ne constitue pas une certification PDF/X : les exigences de profil colorimétrique, de fond perdu et de format doivent être confirmées avec l’imprimeur. L’impression système reste disponible comme solution de repli.

Un projet peut être exporté en `.chatbound`, transféré sur un autre ordinateur puis rouvert en sélectionnant le ZIP WhatsApp correspondant. L’accueil affiche également les projets locaux récents. Le fichier projet contient les réglages et certains noms, mais jamais les messages ou médias.

Chaque photo du livre est directement sélectionnable dans l’aperçu. Un inspecteur contextuel permet de modifier sa disposition, son cadrage, son point focal, sa rotation et sa légende, sans quitter la page courante. Les mêmes réglages sont accessibles depuis **Souvenirs**.

Les vidéos incluses dans l’archive sont représentées par une image extraite localement, accompagnée du message associé. Dans l’inspecteur, choisissez un autre instant ou l’affichage du texte seul ; le choix est conservé dans le projet. Si la vidéo manque, dépasse la limite de 150 Mo pour un fichier de l’archive ou ne peut pas être décodée par le navigateur, le message reste visible et la vidéo est signalée comme indisponible. Aucun hébergement ni QR code n’est créé.

Dans **Souvenirs**, l’onglet **Manquants** permet d’associer manuellement un fichier vidéo local à un message ou à un média omis ; l’action est aussi disponible pour les autres messages. Le choix de l’image, le nom du fichier et son association sont enregistrés, mais la vidéo elle-même ne l’est pas : après réouverture ou transfert du projet, reconnectez-la depuis **Manquants** ou l’inspecteur. Les fichiers ne sont jamais envoyés en ligne.

Chaque message propose également un réglage direct de chapitre et de nouvelle page. Sur desktop, les espaces spécialisés remplacent temporairement la couverture à gauche sans masquer l’aperçu ; sur les écrans plus étroits, les quatre espaces s’ouvrent en dialogues plein écran accessibles au clavier.

La photo de couverture est elle aussi sélectionnable directement dans l’aperçu. Son mode Ajuster/Remplir, son point focal et sa rotation sont indépendants des réglages de la même photo dans le corps du livre. Une quatrième de couverture optionnelle peut reprendre une photo ou rester typographique, avec son propre texte, voile, cadrage et rotation. Dans **Souvenirs**, l’en-tête et le pied restent visibles tandis que la chronologie défile dans la hauteur disponible.

L’espace **Organiser** permet d’ajouter une dédicace, une introduction, des interludes, des pages blanches ou un épilogue, générer un sommaire, créer des chapitres et nouvelles pages, personnaliser les noms et couleurs des participants et signaler des pages. Chaque page de texte peut régler sa position verticale, son alignement, sa largeur ainsi que la taille du texte et du titre. Ces réglages sont conservés dans le projet et appliqués dans l’aperçu comme dans le PDF ; un texte trop long est réparti en continuations.

La navigation de l’aperçu propose également un slider adapté aux livres longs et un mode **livre ouvert** : couverture seule, première page à droite, puis doubles pages 2–3, 4–5, etc. Un signet rouge permet de signaler une page de conversation ; en Collage, il se trouve dans la barre de l’aperçu pour ne pas masquer les photos. Ces contrôles restent propres à l’atelier et n’entrent jamais dans le PDF.

L’espace **Apparence** commence par quatre compositions illustrées. **Gazette** organise les échanges en deux colonnes sous une manchette ; **Récit photo** privilégie de grandes images avec les dates dans une marge latérale ; **Collage** répartit photos montées, ruban adhésif et notes sur des papiers décalés ; **Carnet** conserve le fil chronologique classique. **Messages** et **Album** ne sont plus proposés : leurs anciens projets sont repris respectivement en Carnet et Collage sans supprimer de contenu. Ces compositions modifient la structure et la pagination, pas seulement la palette.

Les trois compositions dessinées partagent un plan de page en millimètres entre l’aperçu, l’impression système et le PDF. La pagination vérifie que chaque bloc tient dans ce plan, répartit les longues légendes en continuations et conserve les chapitres, sauts de page, photos larges et photos pleine page. Le format, l’orientation et la taille de texte sont pris en compte ; les choix sont conservés dans les sauvegardes locales et les projets exportables.

La section repliable **Couleurs et typographie** permet de combiner chaque composition avec huit ambiances. La collection **Journaling** réunit **Bullet journal** (papier pointillé, typographie nette, dates compactes), **Carnet de voyage** (papier naturel, filet de marge, texte littéraire, photos encadrées) et **Scrapbook** (photos à marges blanches et accents framboise). Les cinq **Classiques** — Intemporel, Moderne, Correspondance, Graphique et Minimal — restent disponibles. Les ambiances ne remplacent pas la composition choisie.

Les inspirations sont les carnets pointillés [LEUCHTTURM1917 / Bullet Journal](https://www.leuchtturm1917.com/bullet-journal-edition-2.html), le carnet de voyage personnalisable [TRAVELER’S notebook](https://www.travelers-company.com/products/trnote/about) et les albums à papiers et photos montées [Creative Memories](https://www.creativememories.com/). Les thèmes en sont des interprétations originales, sans reprendre leurs logos, illustrations ou modèles propriétaires. Aucune ressource externe n’est nécessaire pour les utiliser.

Les pointillés et filets sont calculés dans la même géométrie physique pour l’aperçu, l’impression système et le PDF vectoriel. Les marges des photos Scrapbook mesurent 2 mm sur les côtés et 6 mm en bas ; elles suivent le réglage de cadre « Bordure ». Les pages explicitement blanches ne reçoivent aucun motif. Les nouveaux univers sont conservés dans les sauvegardes locales et les projets `.chatbound`.

Le format des dates — complet, court ou chiffré — est indépendant de leur traitement visuel dans les ambiances : Classique avec séparateur, Cartouche coloré ou Minimal.

Sur desktop, l’atelier reste strictement confiné à la hauteur du viewport : Couverture, Souvenirs, Organiser et Apparence conservent leurs propres zones de défilement sans faire défiler la page entière. Sur mobile, l’aperçu reste au premier plan et le bouton **Couverture** donne accès au titre sans devoir défiler sous le livre.

Les archives et dossiers de conversations placés à la racine sont des données privées locales et sont exclus de Git.