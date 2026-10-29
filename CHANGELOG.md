# Changelog

Toutes les évolutions notables de Plume, de la plus récente à la plus ancienne.

## [0.1.12] - 2026-10-29

### Corrigé

- La version Intel (x86_64) de l'application est de nouveau publiée.

## [0.1.11] - 2026-10-29

### Modifié

- L'application est désormais signée et notarisée par Apple : elle s'installe et s'ouvre sans avertissement « développeur non identifié ». Les autorisations micro et capture audio système devront être accordées à nouveau une fois.

## [0.1.10] - 2026-10-13

### Ajouté

- Recherche dans le transcript : surlignage des résultats, compteur, et masquage des paragraphes qui ne correspondent pas.
- L'app reste active en arrière-plan quand on ferme la dernière fenêtre (notification micro et menu de la barre de menus toujours disponibles). Réouverture via le Dock, le menu « Ouvrir Plume » ou la notification.

## [0.1.9] - 2026-10-13

### Ajouté

- Nouvelle icône « fichier audio » pour afficher le lecteur du fichier `.wav`.

### Corrigé

- En-tête de la réunion : les boutons de droite restent visibles quand la fenêtre est réduite et la date est toujours sous le titre.
- Renommer une réunion ne fait plus perdre le focus ni clignoter la page pendant la saisie.
- Arrêt de l'utilisation CPU à 100 % causée par une notification micro en attente.

## [0.1.8] - 2026-09-17

### Ajouté

- Proposition de démarrer une réunion quand une autre application active le micro.
- Suppression d'une réunion avec confirmation.
- Démarrage automatique de l'enregistrement pour une réunion qui vient d'être créée.
- Renommage du dossier de la réunion depuis son titre, avec détection d'un renommage fait en dehors de l'app (Finder).
- Meilleure gestion de la durée de l'audio et affichage dans l'éditeur de transcript.

### Corrigé

- Activation de la fonctionnalité `watch` du plugin fs, nécessaire à la surveillance des dossiers de réunions.

## [0.1.7] - 2026-07-17

### Ajouté

- Sauvegarde de `capture.wav` toutes les 30 secondes pendant l'enregistrement, pour ne rien perdre en cas de crash.
- Temps de parole par speaker plus précis, avec pourcentages cohérents.
- Horodatages dans le transcript.
- Troncature des noms de réunion trop longs.
- Modèles IA mis à jour et identification des speakers améliorée.

## [0.1.6] - 2026-04-07

### Ajouté

- Temps de parole par speaker.
- Confirmations de suppression via un bouton d'action.

### Corrigé

- Sauvegarde des noms de speakers.

## [0.1.5] - 2026-04-02

### Ajouté

- Suppression de fichiers d'une réunion avec confirmation.
- Éditeur Markdown (Tiptap) pour les documents générés.
- Nouvelle icône de l'app.
- Lecteur audio dans une popover.
- Bouton pour ouvrir le dossier de la réunion.
- Choix du modèle IA par prompt.
- Notifications pour la fin de transcription et de génération.
- Ouverture de nouvelles fenêtres avec un raccourci clavier.
- Liste des réunions sur la page d'accueil, triée par date, avec dossier et date de réunion.
- Import de fichiers audio (dont mp3).
- Un dossier par réunion (audio, transcript, documents générés).
- Prompts personnalisables via une boîte de dialogue.
- Choix du thème clair / sombre.
- Menu de la barre de menus (démarrer / arrêter l'enregistrement) et génération en streaming via OpenRouter.
- Reconnexion automatique quand le flux audio est perdu et meilleure remontée des erreurs de capture.

### Corrigé

- Divers ajustements d'interface (polices, boutons, dialogues).

## [0.1.4] - 2026-03-20

### Corrigé

- Workflow de release : compilation de la bibliothèque AudioCapture et nom de la release.

## [0.1.3] - 2026-03-20

### Corrigé

- Correctifs du CI/CD (chemins, workspace pnpm).

## [0.1.2] - 2026-03-20

### Ajouté

- Publication automatisée via GitHub Actions.
- Durée de génération du transcript.
- Prompts accessibles dès le premier écran, avec rendu Markdown.
- Date et durée de la réunion transmises au contexte du LLM.

## [0.1.1] - 2026-03-19

Première version publiée.
