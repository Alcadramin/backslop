<?php
$stmt = $pdo->prepare('SELECT id, total FROM orders WHERE status = ? ORDER BY id LIMIT 500');
$stmt->execute(['open']);
