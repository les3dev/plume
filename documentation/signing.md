# Signature et notarisation de l'app

Le workflow [release.yml](../.github/workflows/release.yml) signe et notarise Plume automatiquement
via `tauri-apps/tauri-action`, dès que les secrets ci-dessous sont définis dans GitHub. Sans eux,
le build fonctionne mais l'app n'est ni signée ni notarisée (Gatekeeper la bloque).

Ce guide liste ce qu'il faut faire **une seule fois** côté Apple et GitHub.

## 1. Certificat « Developer ID Application »

> Déjà fait (automatiquement) : la clé privée et la demande de certificat (CSR) ont été générées avec
> `openssl` dans `~/plume-signing/` :
>
> - `plume-developer-id.certSigningRequest` : à envoyer à Apple
> - `plume-developer-id.key` : clé privée, **ne jamais la commiter ni la partager**
>
> Pour régénérer (si besoin) :
>
> ```sh
> cd ~/plume-signing
> openssl genrsa -out plume-developer-id.key 2048
> openssl req -new -key plume-developer-id.key -out plume-developer-id.certSigningRequest \
>     -subj "/emailAddress=<ton-email>/CN=Plume Dev Key/C=FR"
> ```

À faire par toi (connexion Apple obligatoire). Seul le titulaire du compte (Account Holder) peut
créer ce certificat. Il faut ce type précis : « Apple Development » ne convient pas pour une
distribution hors App Store.

- [ ] Aller sur <https://developer.apple.com/account/resources/certificates> → **+**
- [ ] Choisir **Developer ID Application** → _Continue_
- [ ] Si Apple demande un profil (_Profile Type_), garder la valeur par défaut (G2 Sub-CA)
- [ ] Envoyer `~/plume-signing/plume-developer-id.certSigningRequest` → _Continue_
- [ ] Télécharger le `.cer` (`developerID_application.cer`) et le mettre dans `~/plume-signing/`
- [ ] Relever deux valeurs, visibles dans la liste des certificats ou dans _Membership details_ :
    - le **Team ID** (10 caractères) → `APPLE_TEAM_ID`
    - le nom exact du certificat → `APPLE_SIGNING_IDENTITY`, de la forme
      `Developer ID Application: Ton Nom (TEAMID)`. Une fois le `.p12` créé (étape 2), la commande
      `openssl x509 -in cert.pem -noout -subject` en affiche le `CN`, qui est cette chaîne

## 2. Fabriquer le `.p12`

Cette étape se fait en ligne de commande, sans Trousseau d'accès, et peut être faite par Claude une
fois le `.cer` en place. Seul le mot de passe du `.p12` doit être choisi et tapé par toi.

- [ ] Convertir le `.cer` (format DER) en PEM et vérifier le nom du certificat :

    ```sh
    cd ~/plume-signing
    openssl x509 -inform DER -in developerID_application.cer -out cert.pem
    openssl x509 -in cert.pem -noout -subject
    ```

- [ ] Créer le `.p12` avec un mot de passe de ton choix (valeur de `APPLE_CERTIFICATE_PASSWORD`).
      Les options de chiffrement `3DES`/`sha1` sont nécessaires : sans elles, macOS refuse d'importer un `.p12`
      créé avec OpenSSL 3 (erreur « MAC verification failed »)

    ```sh
    openssl pkcs12 -export -inkey plume-developer-id.key -in cert.pem -out plume.p12 \
        -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1
    ```

- [ ] Encoder en base64 et copier dans le presse-papiers (valeur de `APPLE_CERTIFICATE`) :

    ```sh
    base64 -i plume.p12 | pbcopy
    ```

- [ ] Une fois les secrets GitHub enregistrés (étape 4), supprimer le dossier :
      `rm -rf ~/plume-signing`. Garder une sauvegarde du `.p12` dans ton gestionnaire de mots de passe
      si tu veux pouvoir le réutiliser : Apple ne redonne pas la clé privée

## 3. Clé API App Store Connect (notarisation)

La notarisation utilise une clé API plutôt qu'un Apple ID + mot de passe : elle ne donne aucun accès
au compte et se révoque en un clic. Elle doit être créée par un Admin / Account Holder (ici le
titulaire du compte EOLE).

- [ ] <https://appstoreconnect.apple.com/access/integrations/api> → onglet _Team Keys_ → **+**
      (si besoin, _Request Access_ la première fois)
- [ ] Nom : « Plume notarisation », accès : **Developer** → _Generate_
- [ ] Télécharger le fichier `AuthKey_XXXXXXXXXX.p8` (**une seule fois possible**)
- [ ] Relever le **Key ID** (colonne de la clé, 10 caractères) et l'**Issuer ID** (en haut de la page, un UUID)

## 4. Ajouter les secrets GitHub

Repo → _Settings_ → _Secrets and variables_ → _Actions_ (ou `gh secret set`) :

| Secret                       | Valeur                                                 |
| ---------------------------- | ------------------------------------------------------ |
| `APPLE_CERTIFICATE`          | base64 du `.p12` (étape 2)                             |
| `APPLE_CERTIFICATE_PASSWORD` | mot de passe du `.p12` (étape 2)                       |
| `APPLE_SIGNING_IDENTITY`     | `Developer ID Application: Ton Nom (TEAMID)` (étape 1) |
| `APPLE_API_KEY_CONTENT`      | contenu complet du fichier `.p8` (étape 3)             |
| `APPLE_API_KEY`              | Key ID (étape 3)                                       |
| `APPLE_API_ISSUER`           | Issuer ID (étape 3)                                    |

Le workflow importe le certificat dans un keychain temporaire, signe `libAudioCapture.dylib`
(resource du bundle, elle doit l'être pour passer la notarisation), puis `tauri-action` signe et
notarise l'app.

## 5. Tester avec une vraie release

Les releases sont publiées en pré-release (`prerelease: true`), donc c'est sans risque.

- [ ] Lancer `/release` (ou `pnpm release <version>`) et attendre la fin du workflow GitHub Actions
- [ ] Vérifier dans les logs du step _Build and release with Tauri_ que la signature et la
      notarisation ont bien eu lieu (pas d'erreur `notarytool`)
- [ ] Télécharger le `.dmg` depuis la release, installer l'app, puis vérifier :

    ```sh
    spctl -a -vv /Applications/Plume.app
    codesign -dv --verbose=4 /Applications/Plume.app
    xcrun stapler validate /Applications/Plume.app
    ```

    Attendu : `accepted` et `source=Notarized Developer ID`.

- [ ] Lancer l'app et vérifier que la **capture audio système** et le **micro** fonctionnent. Les
      permissions macOS (TCC) sont liées à l'identité de signature : il faudra les redonner une fois
      par rapport à l'ancienne version non signée.

## Dépannage

- **L'app plante ou la capture système échoue au lancement** : la dylib `libAudioCapture.dylib` n'a
  pas pu être chargée. L'entitlement `com.apple.security.cs.disable-library-validation` (déjà dans
  [entitlements.plist](../src-tauri/entitlements.plist)) est là pour ça. Si le problème persiste,
  signer explicitement la dylib avant le bundle.
- **Échec de notarisation** : consulter le log avec
  `xcrun notarytool log <submission-id> --apple-id … --team-id … --password …`.
- **`no identity found` dans le workflow** : `APPLE_SIGNING_IDENTITY` ne correspond pas exactement à
  la chaîne affichée par `security find-identity`, ou `APPLE_CERTIFICATE` n'inclut pas la clé privée
  (réexporter le `.p12` depuis _Mes certificats_).
