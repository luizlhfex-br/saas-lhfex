#!/usr/bin/env bash
CODE=$(cat <<'PHP'
$q = App\Models\ApplicationDeploymentQueue::find(146);
if (! $q || ! $q->logs) { echo "no_logs\n"; return; }
$logs = json_decode($q->logs, true);
$slice = array_slice($logs, -40);
foreach ($slice as $idx => $entry) {
  $out = $entry['output'] ?? '';
  $out = str_replace(["\r"], "", $out);
  echo "---" . ($idx + 1) . "---\n";
  echo substr($out, 0, 900) . "\n";
}
PHP
)
docker exec coolify php artisan tinker --execute="$CODE"
