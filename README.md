# Suivi Kilometrage LOA

Application de suivi du kilometrage d'un contrat LOA, utilisable seule ou comme app Home Assistant.

## Lancer l'app

```bash
cd kilometrage-loa
node server.js
```

Puis ouvrir `http://localhost:4177`.

Les donnees sont sauvegardees dans `.loa-data.json` avec une copie de secours
`.loa-data.backup.json`. Le stockage local du navigateur reste utilise comme
solution de secours.

## Installation dans Home Assistant

Cette application peut etre installee comme app locale Home Assistant OS ou Home Assistant Supervised.

1. Copier tout le dossier `kilometrage-loa` dans :

```txt
/addons/suivi_kilometrage_loa
```

2. Dans Home Assistant, ouvrir `Parametres > Apps > Boutique d'apps`.
3. Ouvrir le menu en haut a droite puis cliquer sur `Verifier les mises a jour`.
4. Ouvrir `Suivi Kilometrage LOA` dans la section des apps locales.
5. Installer puis demarrer l'app.
6. Activer l'affichage dans la barre laterale.

L'app utilise Ingress et l'API interne Home Assistant. Aucun port, URL ou jeton n'est necessaire dans ce mode.

Les donnees du contrat et l'historique sont conserves dans `/data` par Home
Assistant. Elles survivent aux redemarrages et sont incluses dans les
sauvegardes de l'app.

## Capteur kilometrage

L'app peut importer le compteur d'un capteur Home Assistant.

1. Installer l'integration Mercedes de ton choix dans Home Assistant.
2. Verifier qu'elle cree une entite contenant le kilometrage ou l'odometre.
3. Ouvrir `Kilometrage LOA` dans la barre laterale.
4. Cliquer sur `Detecter les capteurs`.
5. Selectionner le capteur puis enregistrer.
6. Utiliser `Importer le kilometrage` pour ajouter un releve.

En mode local hors Home Assistant, l'adresse et le jeton longue duree restent necessaires.
