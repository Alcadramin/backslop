<?php
$stmt = $pdo->prepare('SELECT id, total FROM orders WHERE status = ? ORDER BY id');
$stmt->execute(['open']);
