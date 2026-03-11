#!/usr/bin/env bash
CODE=$(cat <<'PHP'
$q = App\Models\ApplicationDeploymentQueue::find(146);
echo "status=" . ($q?->status ?? 'null') . "\n";
if ($q && $q->logs) {
  $logs = json_decode($q->logs, true);
  $slice = array_slice($logs, -12);
  foreach ($slice as $entry) {
    $out = $entry['output'] ?? '';
    $out = str_replace(["\r", "\n"], " ", $out);
    echo substr($out, 0, 320) . "\n";
  }
}
PHP
)
docker exec coolify php artisan tinker --execute="$CODE"
