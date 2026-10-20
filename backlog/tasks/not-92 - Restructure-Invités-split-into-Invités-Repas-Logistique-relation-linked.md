---
id: NOT-92
title: 'Restructure Invités: split into Invités / Repas / Logistique (relation-linked)'
status: ready-for-agent
assignee: []
created_date: '2026-08-12 08:06'
updated_date: '2026-08-12 08:12'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le workspace 'Let's get married' (https://notara.legrand.sh/let-s-get-married) mélange dans la base Invités (60 enregistrements) : identité (Type, Adultes, Enfants, Adresse), comms (Save the date ?, Faire part ?), RSVP (Présents ?), repas (jeudi soir, vendredi midi/soir, samedi midi, dimanche midi) et logistique (Logistique, Besoin de navette). Décisions validées avec Thomas le 2026-08-11 : Repas = colonnes par repas + vues filtrantes par repas ; Couchage géré par la base Chambres existante (pas de doublon) ; normaliser 'ne sais pas'/'ne sait pas' en 'ne sait pas'. Pattern existant : Chambres et Tables référencent déjà Invités via des relations.

Blocked by : None — can start immediately.

Accès au workspace (IDs publics, aucun secret ici) :
- NOTARA_URL=https://notara.legrand.sh
- NOTARA_WORKSPACE=01KS60PH491BS1C32MNE41YFGY
- dbId Invités = 01KSR9ESC7JA9YG2CEVTVGR9ZQ
- Page Invités = 01KSR9ERWPA31ZKER4Q2DPN4G1 (les nouvelles bases Repas/Logistique y seront créées)
- Clé API (ntr_...) : à demander à Thomas. Ne jamais committer de secret : le backlog est suivi par git.

Risque AC #1 (backup) : le backup admin (POST /api/backup/trigger) exige S3 configuré + session admin. Vérifier d'abord Settings → Backups dans l'app. Si S3 est désactivé : fallback = snapshot du DATA_DIR serveur (bases SQLite + attachments) avant toute modification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AVANT TOUTE MODIFICATION : lancer un backup manuel (Settings → Backups → Run backup, endpoint admin POST /api/backup/trigger) et vérifier qu'il apparaît dans la liste des backups
- [ ] #2 Créer la base Repas : relation → Invité + colonnes Présent jeudi soir, Vendredi midi, Vendredi soir, Samedi midi, Dimanche midi (select oui/non/ne sait pas)
- [ ] #3 Créer la base Logistique : relation → Invité + colonnes Logistique (texte) et Besoin de navette (select)
- [ ] #4 Migrer les 60 enregistrements : créer une ligne liée par invité dans Repas et Logistique, valeurs copiées depuis Invités
- [ ] #5 Normaliser les options des repas en 'oui'/'non'/'ne sait pas' (aujourd'hui mélangées 'ne sais pas'/'ne sait pas')
- [ ] #6 Supprimer de la base Invités les colonnes déplacées (repas, Logistique, Besoin de navette) après vérification des données
- [ ] #7 Créer une vue filtrante par repas dans Repas (ex. 'Vendredi soir — oui') pour compter les couverts
- [ ] #8 Vérification finale : 60 lignes liées dans chaque base, relations OK, échantillonnage des valeurs, rollback possible depuis le backup
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Lancer le backup manuel (Settings → Backups → Run backup) et vérifier sa présence dans la liste. Fallback si S3 désactivé : snapshot DATA_DIR.
2. Lister les champs actuels de Invités (notara databases fields 01KSR9ESC7JA9YG2CEVTVGR9ZQ) pour référence.
3. Créer la base Repas : notara databases create --page 01KSR9ERWPA31ZKER4Q2DPN4G1 --name 'Repas', puis add-field : relation → Invités + Présent jeudi soir, Vendredi midi, Vendredi soir, Samedi midi, Dimanche midi (select oui/non/ne sait pas).
4. Créer la base Logistique : idem, relation → Invités + Logistique (texte) + Besoin de navette (select).
5. Pour chacun des 60 invités : créer la ligne liée dans Repas et Logistique (add-record --title <nom>), puis set la relation (valeur JSON ["<invitéId>"]) et copier les valeurs des colonnes repas/logistique/navette.
6. Échantillonner et compter avant suppression : 60 lignes liées par base, valeurs identiques à Invités.
7. Normaliser les options : 'ne sais pas' → 'ne sait pas' (update-field --options).
8. Supprimer de Invités les colonnes déplacées (delete-field) : Présent jeudi soir, Repas vendredi midi/soir/samedi midi/dimanche midi, Logistique, Besoin de navette. Garder Type, Adultes, Enfants, Présents ?, Adresse, Save the date ?, Faire part ?.
9. Créer une vue filtrante par repas dans Repas (ex. 'Vendredi soir — oui').
10. Vérification finale : relations OK, rollback possible depuis le backup.
<!-- SECTION:PLAN:END -->
