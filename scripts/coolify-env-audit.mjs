const runtimeRequired = [
  'NODE_ENV',
  'DATABASE_URL',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'APP_URL',
];

const runtimeRecommended = [
  'REDIS_URL',
  'SENTRY_DSN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_ADMIN_USERS',
  'TELEGRAM_ALLOWED_USERS',
];

function present(key) {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0;
}

function printGroup(title, keys, strict) {
  console.log(`\n${title}`);
  for (const key of keys) {
    const ok = present(key);
    if (ok) {
      console.log(`  ✅ ${key}`);
    } else {
      console.log(`  ${strict ? '❌' : '⚠️'} ${key}`);
    }
  }
}

function main() {
  console.log('Coolify Runtime Env Audit');
  console.log('Expected profile: production runtime vars configured as Runtime Only in Coolify.');

  printGroup('Required (runtime)', runtimeRequired, true);
  printGroup('Recommended (runtime)', runtimeRecommended, false);

  let hasError = false;
  for (const key of runtimeRequired) {
    if (!present(key)) hasError = true;
  }

  if (present('NODE_ENV') && process.env.NODE_ENV !== 'production') {
    console.log(`\n⚠️ NODE_ENV está '${process.env.NODE_ENV}'. Em runtime de produção, o valor recomendado é 'production'.`);
  }

  console.log('\nBuild/Runtime rule: mantenha NODE_ENV=production apenas em Runtime Only no Coolify.');

  if (hasError) {
    console.log('\nResultado: FALHOU (faltam variáveis obrigatórias de runtime).');
    process.exit(1);
  }

  console.log('\nResultado: OK (runtime mínimo presente).');
}

main();
