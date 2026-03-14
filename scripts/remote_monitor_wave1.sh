#!/usr/bin/env bash
for i in $(seq 1 50); do
  S146=$(docker exec coolify php artisan tinker --execute='echo App\Models\ApplicationDeploymentQueue::find(146)?->status;' | tr -d '\r' | tail -n 1)
  S147=$(docker exec coolify php artisan tinker --execute='echo App\Models\ApplicationDeploymentQueue::find(147)?->status;' | tr -d '\r' | tail -n 1)
  echo "try=$i q146=$S146 q147=$S147"
  if [ "$S146" = "failed" ] || [ "$S146" = "error" ] || [ "$S147" = "failed" ] || [ "$S147" = "error" ]; then
    exit 2
  fi
  if [ "$S146" = "finished" ] && [ "$S147" = "finished" ]; then
    exit 0
  fi
  sleep 10
done
exit 1
