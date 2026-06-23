<?php
/**
 * api.php — Arbre Généalogique
 * Backend PHP + SQLite (PDO)
 * Toutes les actions passent par ce fichier via fetch() côté JS
 */

/* ─── Configuration ───────────────────────────────── */
define('DB_PATH', __DIR__ . '/famille.db');   // fichier SQLite (créé automatiquement)
define('ALLOWED_ORIGIN', '*');                // mettre ton domaine en prod : 'https://monsite.com'

/* ─── Headers CORS + JSON ─────────────────────────── */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: '  . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Répondre OK aux preflight OPTIONS (navigateurs modernes)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ─── Connexion PDO SQLite ────────────────────────── */
try {
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE,            PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    // Activer les clés étrangères SQLite (désactivées par défaut)
    $pdo->exec('PRAGMA foreign_keys = ON;');
} catch (Exception $e) {
    jsonError('Impossible d\'ouvrir la base de données : ' . $e->getMessage(), 500);
}

/* ─── Création des tables (si première exécution) ─── */
$pdo->exec("
    CREATE TABLE IF NOT EXISTS membres (
        id          TEXT PRIMARY KEY,         -- ID string unique (ex: 'lx3k9a2b')
        firstname   TEXT NOT NULL,
        lastname    TEXT NOT NULL,
        gender      TEXT DEFAULT 'M',         -- 'M', 'F', 'N'
        birth       TEXT,                     -- 'YYYY-MM-DD'
        birthplace  TEXT,
        death       TEXT,                     -- 'YYYY-MM-DD' ou NULL
        deathplace  TEXT,
        parent_id   TEXT,                     -- FK vers membres.id (nullable)
        spouse_id   TEXT,                     -- FK vers membres.id (nullable)
        notes       TEXT,
        photo       TEXT,                     -- URL ou base64
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parametres (
        cle         TEXT PRIMARY KEY,
        valeur      TEXT NOT NULL
    );
");

// Valeurs par défaut des paramètres
$pdo->exec("
    INSERT OR IGNORE INTO parametres (cle, valeur) VALUES
        ('treeName',    'Ma Famille'),
        ('theme',       '0'),
        ('orientation', 'top');
");

/* ─── Routeur d'actions ───────────────────────────── */
// L'action vient soit en GET (?action=...) soit dans le body JSON POST
$action = $_GET['action'] ?? null;

// Pour les POST, on lit le body JSON
$body = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
    if (!$action) $action = $body['action'] ?? null;
}

switch ($action) {

    /* ── Charger tout (membres + paramètres) ── */
    case 'load':
        $membres = $pdo->query("SELECT * FROM membres ORDER BY created_at ASC")->fetchAll();
        // Convertir les clés snake_case → camelCase pour le JS
        $membres = array_map('rowToMember', $membres);

        $rows = $pdo->query("SELECT cle, valeur FROM parametres")->fetchAll();
        $params = [];
        foreach ($rows as $r) {
            $params[$r['cle']] = $r['valeur'];
        }
        // theme est un entier côté JS
        $params['theme'] = (int)($params['theme'] ?? 0);

        jsonOk(['members' => $membres, 'settings' => $params]);
        break;

    /* ── Ajouter un membre ── */
    case 'add':
        $data = $body['member'] ?? $body;
        validateMember($data);

        $id = $data['id'] ?? uniqid('m', false);

        $stmt = $pdo->prepare("
            INSERT INTO membres
                (id, firstname, lastname, gender, birth, birthplace, death, deathplace,
                 parent_id, spouse_id, notes, photo)
            VALUES
                (:id, :fn, :ln, :gd, :bi, :bp, :de, :dp, :pa, :sp, :no, :ph)
        ");
        $stmt->execute([
            ':id' => $id,
            ':fn' => trim($data['firstname']),
            ':ln' => trim($data['lastname']),
            ':gd' => $data['gender']     ?? 'M',
            ':bi' => $data['birth']      ?? null,
            ':bp' => $data['birthplace'] ?? null,
            ':de' => $data['death']      ?? null,
            ':dp' => $data['deathplace'] ?? null,
            ':pa' => $data['parentId']   ?? null,
            ':sp' => $data['spouseId']   ?? null,
            ':no' => $data['notes']      ?? null,
            ':ph' => $data['photo']      ?? null,
        ]);

        // Synchroniser le lien conjoint dans l'autre sens
        if (!empty($data['spouseId'])) {
            $pdo->prepare("UPDATE membres SET spouse_id = ?, updated_at = datetime('now') WHERE id = ?")
                ->execute([$id, $data['spouseId']]);
        }

        $nouveau = rowToMember(
            $pdo->query("SELECT * FROM membres WHERE id = '$id'")->fetch()
        );
        jsonOk(['member' => $nouveau, 'message' => 'Membre ajouté']);
        break;

    /* ── Modifier un membre ── */
    case 'update':
        $data = $body['member'] ?? $body;
        $id   = $data['id'] ?? null;
        if (!$id) jsonError('ID manquant', 400);
        validateMember($data);

        // Ancien spouseId avant modification (pour nettoyer l'ancien lien)
        $old = $pdo->prepare("SELECT spouse_id FROM membres WHERE id = ?");
        $old->execute([$id]);
        $oldRow = $old->fetch();
        $oldSpouseId = $oldRow['spouse_id'] ?? null;

        $stmt = $pdo->prepare("
            UPDATE membres SET
                firstname   = :fn,
                lastname    = :ln,
                gender      = :gd,
                birth       = :bi,
                birthplace  = :bp,
                death       = :de,
                deathplace  = :dp,
                parent_id   = :pa,
                spouse_id   = :sp,
                notes       = :no,
                photo       = :ph,
                updated_at  = datetime('now')
            WHERE id = :id
        ");
        $stmt->execute([
            ':fn' => trim($data['firstname']),
            ':ln' => trim($data['lastname']),
            ':gd' => $data['gender']     ?? 'M',
            ':bi' => $data['birth']      ?? null,
            ':bp' => $data['birthplace'] ?? null,
            ':de' => $data['death']      ?? null,
            ':dp' => $data['deathplace'] ?? null,
            ':pa' => $data['parentId']   ?? null,
            ':sp' => $data['spouseId']   ?? null,
            ':no' => $data['notes']      ?? null,
            ':ph' => $data['photo']      ?? null,
            ':id' => $id,
        ]);

        // Nettoyer l'ancien conjoint si changé
        $newSpouseId = $data['spouseId'] ?? null;
        if ($oldSpouseId && $oldSpouseId !== $newSpouseId) {
            $pdo->prepare("UPDATE membres SET spouse_id = NULL, updated_at = datetime('now') WHERE id = ?")
                ->execute([$oldSpouseId]);
        }
        // Synchroniser le nouveau conjoint
        if ($newSpouseId) {
            $pdo->prepare("UPDATE membres SET spouse_id = ?, updated_at = datetime('now') WHERE id = ?")
                ->execute([$id, $newSpouseId]);
        }

        $updated = rowToMember(
            $pdo->query("SELECT * FROM membres WHERE id = '$id'")->fetch()
        );
        jsonOk(['member' => $updated, 'message' => 'Membre modifié']);
        break;

    /* ── Supprimer un membre ── */
    case 'delete':
        $id = $body['id'] ?? $_GET['id'] ?? null;
        if (!$id) jsonError('ID manquant', 400);

        // Détacher les enfants (ils deviennent racines)
        $pdo->prepare("UPDATE membres SET parent_id = NULL, updated_at = datetime('now') WHERE parent_id = ?")
            ->execute([$id]);
        // Nettoyer le lien conjoint de l'autre côté
        $pdo->prepare("UPDATE membres SET spouse_id = NULL, updated_at = datetime('now') WHERE spouse_id = ?")
            ->execute([$id]);
        // Supprimer le membre
        $pdo->prepare("DELETE FROM membres WHERE id = ?")
            ->execute([$id]);

        jsonOk(['message' => 'Membre supprimé', 'deleted_id' => $id]);
        break;

    /* ── Sauvegarder les paramètres ── */
    case 'save_settings':
        $s = $body['settings'] ?? $body;
        $allowed = ['treeName', 'theme', 'orientation'];
        foreach ($allowed as $key) {
            if (isset($s[$key])) {
                $pdo->prepare("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)")
                    ->execute([$key, (string)$s[$key]]);
            }
        }
        jsonOk(['message' => 'Paramètres sauvegardés']);
        break;

    /* ── Tout effacer ── */
    case 'clear_all':
        $confirm = $body['confirm'] ?? false;
        if (!$confirm) jsonError('Confirmation requise', 400);
        $pdo->exec("DELETE FROM membres");
        $pdo->exec("UPDATE parametres SET valeur = 'Ma Famille' WHERE cle = 'treeName'");
        jsonOk(['message' => 'Données effacées']);
        break;

    /* ── Import JSON complet ── */
    case 'import':
        $members  = $body['members']  ?? [];
        $s        = $body['settings'] ?? null;
        if (!is_array($members)) jsonError('Format invalide', 400);

        $pdo->beginTransaction();
        try {
            $pdo->exec("DELETE FROM membres");

            $stmt = $pdo->prepare("
                INSERT INTO membres
                    (id, firstname, lastname, gender, birth, birthplace, death, deathplace,
                     parent_id, spouse_id, notes, photo)
                VALUES
                    (:id,:fn,:ln,:gd,:bi,:bp,:de,:dp,:pa,:sp,:no,:ph)
            ");
            foreach ($members as $m) {
                $stmt->execute([
                    ':id' => $m['id']         ?? uniqid('m', false),
                    ':fn' => $m['firstname']  ?? '',
                    ':ln' => $m['lastname']   ?? '',
                    ':gd' => $m['gender']     ?? 'M',
                    ':bi' => $m['birth']      ?? null,
                    ':bp' => $m['birthplace'] ?? null,
                    ':de' => $m['death']      ?? null,
                    ':dp' => $m['deathplace'] ?? null,
                    ':pa' => $m['parentId']   ?? null,
                    ':sp' => $m['spouseId']   ?? null,
                    ':no' => $m['notes']      ?? null,
                    ':ph' => $m['photo']      ?? null,
                ]);
            }

            if ($s) {
                foreach (['treeName','theme','orientation'] as $key) {
                    if (isset($s[$key])) {
                        $pdo->prepare("INSERT OR REPLACE INTO parametres (cle,valeur) VALUES (?,?)")
                            ->execute([$key, (string)$s[$key]]);
                    }
                }
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Erreur import : ' . $e->getMessage(), 500);
        }

        jsonOk(['message' => count($members) . ' membres importés', 'count' => count($members)]);
        break;

    /* ── Action inconnue ── */
    default:
        jsonError('Action inconnue : ' . ($action ?? '(vide)'), 400);
}

/* ═══════════════════════════════════════════════════
   FONCTIONS UTILITAIRES
   ═══════════════════════════════════════════════════ */

/** Convertit une ligne SQL (snake_case) en objet JS (camelCase) */
function rowToMember(array $row): array {
    return [
        'id'         => $row['id'],
        'firstname'  => $row['firstname'],
        'lastname'   => $row['lastname'],
        'gender'     => $row['gender']     ?? 'M',
        'birth'      => $row['birth']      ?? null,
        'birthplace' => $row['birthplace'] ?? null,
        'death'      => $row['death']      ?? null,
        'deathplace' => $row['deathplace'] ?? null,
        'parentId'   => $row['parent_id']  ?? null,
        'spouseId'   => $row['spouse_id']  ?? null,
        'notes'      => $row['notes']      ?? null,
        'photo'      => $row['photo']      ?? null,
    ];
}

/** Valide les champs obligatoires d'un membre */
function validateMember(array $data): void {
    if (empty(trim($data['firstname'] ?? ''))) jsonError('Le prénom est requis', 422);
    if (empty(trim($data['lastname']  ?? ''))) jsonError('Le nom est requis',    422);
}

/** Réponse JSON succès */
function jsonOk(array $data): void {
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Réponse JSON erreur */
function jsonError(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
