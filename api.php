<?php
/**
 * api.php — Arbre Généalogique
 * Backend PHP + SQLite (PDO)
 * Auth : bcrypt + sessions PHP sécurisées
 * Photos : upload fichier serveur + validation
 */

/* ─── Configuration ───────────────────────────────── */
define('DB_PATH',       __DIR__ . '/famille.db');
define('UPLOADS_DIR',   __DIR__ . '/uploads/');
define('UPLOADS_URL',   'uploads/');
define('ALLOWED_ORIGIN', '*');              // Mettre ton domaine en prod

/* ─── Photo autorisées ────────────────────────────── */
define('MAX_PHOTO_SIZE',  5 * 1024 * 1024); // 5 Mo côté serveur
define('ALLOWED_MIME', ['image/jpeg','image/png','image/gif','image/webp']);
define('ALLOWED_EXT',  ['jpg','jpeg','png','gif','webp']);

/* ─── Headers CORS + JSON ─────────────────────────── */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: '  . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

/* ─── Session sécurisée ───────────────────────────── */
ini_set('session.use_strict_mode',   '1');
ini_set('session.cookie_httponly',   '1');
ini_set('session.cookie_samesite',   'Lax');
// En production HTTPS, décommenter :
// ini_set('session.cookie_secure', '1');
session_start();

/* ─── Preflight OPTIONS ───────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ─── Dossier uploads ─────────────────────────────── */
if (!is_dir(UPLOADS_DIR)) {
    mkdir(UPLOADS_DIR, 0755, true);
    // Bloquer l'exécution de scripts dans uploads/
    file_put_contents(UPLOADS_DIR . '.htaccess',
        "Options -ExecCGI\nAddHandler cgi-script .php .php3 .php4 .php5 .pl .py .jsp .asp .sh .cgi\nphp_flag engine off\n"
    );
}

/* ─── Connexion PDO SQLite ────────────────────────── */
try {
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE,            PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON;');
    $pdo->exec('PRAGMA journal_mode = WAL;');
} catch (Exception $e) {
    jsonError('Impossible d\'ouvrir la base de données : ' . $e->getMessage(), 500);
}

/* ─── Création des tables ─────────────────────────── */
$pdo->exec("
    CREATE TABLE IF NOT EXISTS utilisateurs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role        TEXT DEFAULT 'editor',   -- 'admin' | 'editor'
        created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS membres (
        id          TEXT PRIMARY KEY,
        firstname   TEXT NOT NULL,
        lastname    TEXT NOT NULL,
        gender      TEXT DEFAULT 'M',
        birth       TEXT,
        birthplace  TEXT,
        death       TEXT,
        deathplace  TEXT,
        parent_id   TEXT,
        spouse_id   TEXT,
        notes       TEXT,
        photo       TEXT,
        photo_file  TEXT,                    -- nom de fichier sur le serveur
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parametres (
        cle         TEXT PRIMARY KEY,
        valeur      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos_famille (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id   TEXT NOT NULL,             -- le parent \"chef de famille\" (doit avoir des enfants)
        photo_file  TEXT NOT NULL,              -- nom de fichier sur le serveur
        histoire    TEXT,                       -- courte histoire / légende
        annee       TEXT,                       -- année ou période (libre, ex. '1998' ou 'Noël 2005')
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES membres(id) ON DELETE CASCADE
    );
");

/* ─── Utilisateur admin par défaut (première exécution) ── */
$countUsers = (int)$pdo->query("SELECT COUNT(*) FROM utilisateurs")->fetchColumn();
if ($countUsers === 0) {
    // Remplacer ces valeurs lors du premier déploiement !
    $defaultHash = password_hash('password', PASSWORD_BCRYPT, ['cost' => 12]);
    $pdo->prepare("INSERT INTO utilisateurs (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)")
        ->execute(['wandji', $defaultHash, 'Wandji', 'admin']);
}

/* ─── Paramètres par défaut ───────────────────────── */
$pdo->exec("
    INSERT OR IGNORE INTO parametres (cle, valeur) VALUES
        ('treeName',    'Ma Famille'),
        ('theme',       '0'),
        ('orientation', 'top');
");

/* ─── Routeur ─────────────────────────────────────── */
$action = $_GET['action'] ?? null;
$body   = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (str_contains($contentType, 'multipart/form-data')) {
        // Upload photo — données en $_POST + $_FILES
        $body   = $_POST;
        $action = $action ?? ($body['action'] ?? null);
    } else {
        $raw    = file_get_contents('php://input');
        $body   = json_decode($raw, true) ?? [];
        $action = $action ?? ($body['action'] ?? null);
    }
}

switch ($action) {

    /* ══════════════════════════════════════════════
       AUTH
    ══════════════════════════════════════════════ */

    case 'login':
        $username = trim($body['username'] ?? '');
        $password = $body['password']      ?? '';

        if (!$username || !$password) {
            jsonError('Identifiants manquants', 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM utilisateurs WHERE username = ? COLLATE NOCASE LIMIT 1");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            // Pause anti-bruteforce (200 ms)
            usleep(200_000);
            jsonError('Nom d\'utilisateur ou mot de passe incorrect', 401);
        }

        // Régénérer l'ID de session après connexion
        session_regenerate_id(true);
        $_SESSION['logged_in']    = true;
        $_SESSION['user_id']      = $user['id'];
        $_SESSION['username']     = $user['username'];
        $_SESSION['display_name'] = $user['display_name'] ?: $user['username'];
        $_SESSION['role']         = $user['role'];

        jsonOk([
            'message'      => 'Connecté',
            'display_name' => $_SESSION['display_name'],
            'role'         => $_SESSION['role'],
        ]);
        break;

    case 'logout':
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $p['path'], $p['domain'], $p['secure'], $p['httponly']
            );
        }
        session_destroy();
        jsonOk(['message' => 'Déconnecté']);
        break;

    case 'me':
        // Retourne l'état d'authentification courant (utilisé au chargement)
        if (!empty($_SESSION['logged_in'])) {
            jsonOk([
                'logged_in'    => true,
                'display_name' => $_SESSION['display_name'] ?? '',
                'username'     => $_SESSION['username']     ?? '',
                'role'         => $_SESSION['role']         ?? 'editor',
            ]);
        }
        jsonOk(['logged_in' => false]);
        break;

    case 'change_password':
        requireAuth();
        $oldPw  = $body['old_password'] ?? '';
        $newPw  = $body['new_password'] ?? '';
        $userId = $_SESSION['user_id'];

        if (strlen($newPw) < 8) {
            jsonError('Le nouveau mot de passe doit comporter au moins 8 caractères', 422);
        }

        $stmt = $pdo->prepare("SELECT password_hash FROM utilisateurs WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($oldPw, $user['password_hash'])) {
            jsonError('Ancien mot de passe incorrect', 401);
        }

        $newHash = password_hash($newPw, PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare("UPDATE utilisateurs SET password_hash = ? WHERE id = ?")
            ->execute([$newHash, $userId]);

        jsonOk(['message' => 'Mot de passe modifié']);
        break;

    /* ══════════════════════════════════════════════
       DONNÉES
    ══════════════════════════════════════════════ */

    case 'load':
        $membres = $pdo->query("SELECT * FROM membres ORDER BY created_at ASC")->fetchAll();
        $membres = array_map('rowToMember', $membres);

        $rows   = $pdo->query("SELECT cle, valeur FROM parametres")->fetchAll();
        $params = [];
        foreach ($rows as $r) $params[$r['cle']] = $r['valeur'];
        $params['theme'] = (int)($params['theme'] ?? 0);
        

        $photosFamille = $pdo->query("SELECT * FROM photos_famille ORDER BY created_at ASC")->fetchAll();
        $photosFamille = array_map('rowToFamilyPhoto', $photosFamille);

        // Retourner aussi l'état de session courant
        $authInfo = ['logged_in' => false];
        if (!empty($_SESSION['logged_in'])) {
            $authInfo = [
                'logged_in'    => true,
                'display_name' => $_SESSION['display_name'] ?? '',
                'username'     => $_SESSION['username']     ?? '',
                'role'         => $_SESSION['role']         ?? 'editor',
            ];
        }

        jsonOk(['members' => $membres, 'settings' => $params, 'auth' => $authInfo, 'family_photos' => $photosFamille]);
        break;

    case 'add':
        requireAuth();
        $data = $body['member'] ?? $body;
        validateMember($data);

        $id = $data['id'] ?? uniqid('m', false);

        $stmt = $pdo->prepare("
            INSERT INTO membres
                (id, firstname, lastname, gender, birth, birthplace, death, deathplace,
                 parent_id, spouse_id, notes, photo, photo_file)
            VALUES
                (:id,:fn,:ln,:gd,:bi,:bp,:de,:dp,:pa,:sp,:no,:ph,:pf)
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
            ':pf' => $data['photoFile']  ?? null,
        ]);

        if (!empty($data['spouseId'])) {
            $pdo->prepare("UPDATE membres SET spouse_id = ?, updated_at = datetime('now') WHERE id = ?")
                ->execute([$id, $data['spouseId']]);
        }

        $nouveau = rowToMember($pdo->prepare("SELECT * FROM membres WHERE id = ?")->execute([$id]) ? $pdo->query("SELECT * FROM membres WHERE id = '$id'")->fetch() : []);
        jsonOk(['member' => $nouveau, 'message' => 'Membre ajouté']);
        break;

    case 'update':
        requireAuth();
        $data = $body['member'] ?? $body;
        $id   = $data['id'] ?? null;
        if (!$id) jsonError('ID manquant', 400);
        validateMember($data);

        $old = $pdo->prepare("SELECT spouse_id FROM membres WHERE id = ?");
        $old->execute([$id]);
        $oldRow      = $old->fetch();
        $oldSpouseId = $oldRow['spouse_id'] ?? null;

        $stmt = $pdo->prepare("
            UPDATE membres SET
                firstname   = :fn, lastname   = :ln, gender      = :gd,
                birth       = :bi, birthplace = :bp, death       = :de,
                deathplace  = :dp, parent_id  = :pa, spouse_id   = :sp,
                notes       = :no, photo      = :ph, photo_file  = :pf,
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
            ':pf' => $data['photoFile']  ?? null,
            ':id' => $id,
        ]);

        $newSpouseId = $data['spouseId'] ?? null;
        if ($oldSpouseId && $oldSpouseId !== $newSpouseId) {
            $pdo->prepare("UPDATE membres SET spouse_id = NULL, updated_at = datetime('now') WHERE id = ?")
                ->execute([$oldSpouseId]);
        }
        if ($newSpouseId) {
            $pdo->prepare("UPDATE membres SET spouse_id = ?, updated_at = datetime('now') WHERE id = ?")
                ->execute([$id, $newSpouseId]);
        }

        $updated = rowToMember($pdo->query("SELECT * FROM membres WHERE id = '$id'")->fetch());
        jsonOk(['member' => $updated, 'message' => 'Membre modifié']);
        break;

    case 'delete':
        requireAuth();
        $id = $body['id'] ?? $_GET['id'] ?? null;
        if (!$id) jsonError('ID manquant', 400);

        // Supprimer le fichier photo associé
        $row = $pdo->prepare("SELECT photo_file FROM membres WHERE id = ?");
        $row->execute([$id]);
        $rowData = $row->fetch();
        if ($rowData && $rowData['photo_file']) {
            deletePhotoFile($rowData['photo_file']);
        }

        $pdo->prepare("UPDATE membres SET parent_id = NULL, updated_at = datetime('now') WHERE parent_id = ?")
            ->execute([$id]);
        $pdo->prepare("UPDATE membres SET spouse_id = NULL, updated_at = datetime('now') WHERE spouse_id = ?")
            ->execute([$id]);
        $pdo->prepare("DELETE FROM membres WHERE id = ?")
            ->execute([$id]);

        // Supprimer les photos de famille rattachées à ce membre (chef de famille)
        $fpRows = $pdo->prepare("SELECT photo_file FROM photos_famille WHERE member_id = ?");
        $fpRows->execute([$id]);
        foreach ($fpRows->fetchAll() as $fp) deletePhotoFile($fp['photo_file']);
        $pdo->prepare("DELETE FROM photos_famille WHERE member_id = ?")->execute([$id]);

        $pdo->prepare("DELETE FROM membres WHERE id = ?")
            ->execute([$id]);

        jsonOk(['message' => 'Membre supprimé', 'deleted_id' => $id]);
        break;

    /* ══════════════════════════════════════════════
       UPLOAD PHOTO
    ══════════════════════════════════════════════ */

    case 'upload_photo':
        requireAuth();

        if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            $errCode = $_FILES['photo']['error'] ?? -1;
            $errMsg  = uploadErrorMessage($errCode);
            jsonError('Erreur upload : ' . $errMsg, 400);
        }

        $file     = $_FILES['photo'];
        $tmpPath  = $file['tmp_name'];
        $origName = $file['name'];
        $fileSize = $file['size'];

        // ── Taille ──
        if ($fileSize > MAX_PHOTO_SIZE) {
            jsonError('Photo trop volumineuse (max 5 Mo côté serveur)', 413);
        }

        // ── MIME réel (finfo, pas la déclaration client) ──
        $finfo    = new finfo(FILEINFO_MIME_TYPE);
        $realMime = $finfo->file($tmpPath);
        if (!in_array($realMime, ALLOWED_MIME, true)) {
            jsonError('Format non autorisé. Utilisez JPG, PNG, GIF ou WebP.', 415);
        }

        // ── Extension ──
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_EXT, true)) {
            // Déduire l'extension depuis le MIME réel
            $mimeToExt = ['image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','image/webp'=>'webp'];
            $ext = $mimeToExt[$realMime] ?? 'jpg';
        }

        // ── Vérification que c'est bien une image (GD) ──
        $imageInfo = @getimagesize($tmpPath);
        if (!$imageInfo) {
            jsonError('Le fichier n\'est pas une image valide', 415);
        }

        // ── Nom de fichier aléatoire (pas de données utilisateur dans le nom) ──
        $newName = bin2hex(random_bytes(16)) . '.' . $ext;
        $destPath = UPLOADS_DIR . $newName;

        if (!move_uploaded_file($tmpPath, $destPath)) {
            jsonError('Impossible de déplacer le fichier uploadé', 500);
        }

        // Permissions restrictives
        chmod($destPath, 0644);

        // ── Supprimer l'ancien fichier si remplacement ──
        $oldFile = $body['replace_file'] ?? null;
        if ($oldFile) deletePhotoFile($oldFile);

        jsonOk([
            'file'    => $newName,
            'url'     => UPLOADS_URL . $newName,
            'message' => 'Photo uploadée',
        ]);
        break;

    case 'delete_photo':
        requireAuth();
        $filename = $body['file'] ?? null;
        if (!$filename) jsonError('Nom de fichier manquant', 400);
        deletePhotoFile($filename);
        jsonOk(['message' => 'Photo supprimée']);
        break;
    
    /* ══════════════════════════════════════════════
       PHOTOS DE FAMILLE (groupe : parent + enfants)
    ══════════════════════════════════════════════ */

    case 'upload_family_photo':
        requireAuth();

        if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            $errCode = $_FILES['photo']['error'] ?? -1;
            jsonError('Erreur upload : ' . uploadErrorMessage($errCode), 400);
        }

        $file    = $_FILES['photo'];
        $tmpPath = $file['tmp_name'];

        if ($file['size'] > MAX_PHOTO_SIZE) {
            jsonError('Photo trop volumineuse (max 5 Mo côté serveur)', 413);
        }

        $finfo    = new finfo(FILEINFO_MIME_TYPE);
        $realMime = $finfo->file($tmpPath);
        if (!in_array($realMime, ALLOWED_MIME, true)) {
            jsonError('Format non autorisé. Utilisez JPG, PNG, GIF ou WebP.', 415);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_EXT, true)) {
            $mimeToExt = ['image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','image/webp'=>'webp'];
            $ext = $mimeToExt[$realMime] ?? 'jpg';
        }

        if (!@getimagesize($tmpPath)) {
            jsonError('Le fichier n\'est pas une image valide', 415);
        }

        $newName  = bin2hex(random_bytes(16)) . '.' . $ext;
        $destPath = UPLOADS_DIR . $newName;

        if (!move_uploaded_file($tmpPath, $destPath)) {
            jsonError('Impossible de déplacer le fichier uploadé', 500);
        }
        chmod($destPath, 0644);

        $oldFile = $body['replace_file'] ?? null;
        if ($oldFile) deletePhotoFile($oldFile);

        jsonOk(['file' => $newName, 'url' => UPLOADS_URL . $newName, 'message' => 'Photo uploadée']);
        break;

    case 'add_family_photo':
        requireAuth();
        $memberId = $body['memberId']  ?? null;
        $photoFile = $body['photoFile'] ?? null;
        $histoire  = trim($body['histoire'] ?? '');
        $annee     = trim($body['annee']    ?? '');

        if (!$memberId)  jsonError('Le membre (chef de famille) est requis', 422);
        if (!$photoFile) jsonError('La photo est requise', 422);

        $chk = $pdo->prepare("SELECT id FROM membres WHERE id = ?");
        $chk->execute([$memberId]);
        if (!$chk->fetch()) jsonError('Membre introuvable', 404);

        // Vérifier que ce membre a bien au moins un enfant
        $hasChild = $pdo->prepare("SELECT COUNT(*) FROM membres WHERE parent_id = ?");
        $hasChild->execute([$memberId]);
        if ((int)$hasChild->fetchColumn() === 0) {
            jsonError('Ce membre n\'a pas d\'enfants enregistrés : impossible d\'ajouter une photo de famille', 422);
        }

        $stmt = $pdo->prepare("
            INSERT INTO photos_famille (member_id, photo_file, histoire, annee)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$memberId, $photoFile, $histoire ?: null, $annee ?: null]);
        $newId = $pdo->lastInsertId();

        $row = $pdo->prepare("SELECT * FROM photos_famille WHERE id = ?");
        $row->execute([$newId]);
        jsonOk(['photo' => rowToFamilyPhoto($row->fetch()), 'message' => 'Photo de famille ajoutée']);
        break;

    case 'update_family_photo':
        requireAuth();
        $id = $body['id'] ?? null;
        if (!$id) jsonError('ID manquant', 400);

        $row = $pdo->prepare("SELECT * FROM photos_famille WHERE id = ?");
        $row->execute([$id]);
        $existing = $row->fetch();
        if (!$existing) jsonError('Photo de famille introuvable', 404);

        $photoFile = $body['photoFile'] ?? $existing['photo_file'];
        $histoire  = array_key_exists('histoire', $body) ? trim($body['histoire']) : $existing['histoire'];
        $annee     = array_key_exists('annee', $body)    ? trim($body['annee'])    : $existing['annee'];

        // Si le fichier a changé, supprimer l'ancien
        if ($photoFile !== $existing['photo_file']) {
            deletePhotoFile($existing['photo_file']);
        }

        $pdo->prepare("
            UPDATE photos_famille SET photo_file = ?, histoire = ?, annee = ?, updated_at = datetime('now')
            WHERE id = ?
        ")->execute([$photoFile, $histoire ?: null, $annee ?: null, $id]);

        $row->execute([$id]);
        jsonOk(['photo' => rowToFamilyPhoto($row->fetch()), 'message' => 'Photo de famille modifiée']);
        break;

    case 'delete_family_photo':
        requireAuth();
        $id = $body['id'] ?? $_GET['id'] ?? null;
        if (!$id) jsonError('ID manquant', 400);

        $row = $pdo->prepare("SELECT photo_file FROM photos_famille WHERE id = ?");
        $row->execute([$id]);
        $existing = $row->fetch();
        if ($existing) {
            deletePhotoFile($existing['photo_file']);
            $pdo->prepare("DELETE FROM photos_famille WHERE id = ?")->execute([$id]);
        }
        jsonOk(['message' => 'Photo de famille supprimée', 'deleted_id' => $id]);
        break;


    /* ══════════════════════════════════════════════
       PARAMÈTRES
    ══════════════════════════════════════════════ */

    case 'save_settings':
        $s       = $body['settings'] ?? $body;
        $allowed = ['treeName', 'theme', 'orientation'];
        foreach ($allowed as $key) {
            if (isset($s[$key])) {
                $pdo->prepare("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)")
                    ->execute([$key, (string)$s[$key]]);
            }
        }
        jsonOk(['message' => 'Paramètres sauvegardés']);
        break;

    case 'clear_all':
        requireAuth();
        $confirm = $body['confirm'] ?? false;
        if (!$confirm) jsonError('Confirmation requise', 400);

        // Supprimer toutes les photos
        $rows = $pdo->query("SELECT photo_file FROM membres WHERE photo_file IS NOT NULL")->fetchAll();
        foreach ($rows as $r) deletePhotoFile($r['photo_file']);
        $fpRows = $pdo->query("SELECT photo_file FROM photos_famille")->fetchAll();
        foreach ($fpRows as $r) deletePhotoFile($r['photo_file']);

        $pdo->exec("DELETE FROM membres");
        $pdo->exec("DELETE FROM photos_famille");
        $pdo->exec("UPDATE parametres SET valeur = 'Ma Famille' WHERE cle = 'treeName'");
        jsonOk(['message' => 'Données effacées']);
        break;

    case 'import':
        requireAuth();
        $members  = $body['members']  ?? [];
        $s        = $body['settings'] ?? null;
        if (!is_array($members)) jsonError('Format invalide', 400);

        $pdo->beginTransaction();
        try {
            // Supprimer les photos des membres qui vont être écrasés
            $rows = $pdo->query("SELECT photo_file FROM membres WHERE photo_file IS NOT NULL")->fetchAll();
            foreach ($rows as $r) deletePhotoFile($r['photo_file']);

            $pdo->exec("DELETE FROM membres");
            $stmt = $pdo->prepare("
                INSERT INTO membres
                    (id, firstname, lastname, gender, birth, birthplace, death, deathplace,
                     parent_id, spouse_id, notes, photo, photo_file)
                VALUES (:id,:fn,:ln,:gd,:bi,:bp,:de,:dp,:pa,:sp,:no,:ph,:pf)
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
                    ':pf' => $m['photoFile']  ?? null,
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

    default:
        jsonError('Action inconnue : ' . ($action ?? '(vide)'), 400);
}

/* ═══════════════════════════════════════════════════
   FONCTIONS UTILITAIRES
═══════════════════════════════════════════════════ */

function rowToMember(array $row): array {
    // Construire l'URL de la photo
    $photoUrl = null;
    if (!empty($row['photo_file'])) {
        $photoUrl = UPLOADS_URL . $row['photo_file'];
    } elseif (!empty($row['photo'])) {
        $photoUrl = $row['photo'];
    }

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
        'photo'      => $photoUrl,
        'photoFile'  => $row['photo_file'] ?? null,
    ];
}

function rowToFamilyPhoto(array $row): array {
    return [
        'id'        => (int)$row['id'],
        'memberId'  => $row['member_id'],
        'photoFile' => $row['photo_file'],
        'photo'     => UPLOADS_URL . $row['photo_file'],
        'histoire'  => $row['histoire']  ?? null,
        'annee'     => $row['annee']     ?? null,
        'createdAt' => $row['created_at'] ?? null,
    ];
}

function validateMember(array $data): void {
    if (empty(trim($data['firstname'] ?? ''))) jsonError('Le prénom est requis', 422);
    if (empty(trim($data['lastname']  ?? ''))) jsonError('Le nom est requis',    422);
}

function requireAuth(): void {
    if (empty($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        jsonError('Authentification requise', 401);
    }
}

function deletePhotoFile(string $filename): void {
    // Sécurité : n'autoriser que des noms de fichiers simples (hex + extension)
    if (!preg_match('/^[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp)$/i', $filename)) return;
    $path = UPLOADS_DIR . $filename;
    if (file_exists($path)) @unlink($path);
}

function uploadErrorMessage(int $code): string {
    return match($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Fichier trop volumineux',
        UPLOAD_ERR_PARTIAL  => 'Upload incomplet',
        UPLOAD_ERR_NO_FILE  => 'Aucun fichier reçu',
        UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire manquant',
        UPLOAD_ERR_CANT_WRITE => 'Impossible d\'écrire sur le disque',
        UPLOAD_ERR_EXTENSION  => 'Extension PHP bloquée',
        default => 'Erreur inconnue (code ' . $code . ')',
    };
}

function jsonOk(array $data): void {
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}