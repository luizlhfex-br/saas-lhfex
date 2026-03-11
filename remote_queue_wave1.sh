#!/usr/bin/env bash
CODE=$(cat <<'PHP'
$commit = "30a0b13";
$appIds = [2, 3];
foreach ($appIds as $appId) {
  $app = App\Models\Application::find($appId);
  if (! $app) {
    echo "app:$appId:not-found\n";
    continue;
  }
  $serverId = $app->destination?->server?->id ?? 0;
  $serverName = $app->destination?->server?->name ?? "localhost";
  $destinationId = (string) ($app->destination_id ?? 0);
  $deployment = $app->deployment_queue()->create([
    "deployment_uuid" => (string) Illuminate\Support\Str::uuid(),
    "pull_request_id" => 0,
    "force_rebuild" => false,
    "commit" => $commit,
    "status" => "queued",
    "is_webhook" => false,
    "is_api" => false,
    "server_id" => $serverId,
    "destination_id" => $destinationId,
    "application_name" => $app->name,
    "server_name" => $serverName,
  ]);
  App\Jobs\ApplicationDeploymentJob::dispatch($deployment->id);
  echo "app:$appId:queue:{$deployment->id}\n";
}
PHP
)
docker exec coolify php artisan tinker --execute="$CODE"
