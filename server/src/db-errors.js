export function databaseFailure(error) {
  if (['28P01', '28000'].includes(error?.code)) return { code: 'DB_AUTH_FAILED', message: 'PostgreSQL відхилив облікові дані API. Перевірте користувача, пароль, хост і порт у server/.env та перезапустіть API.' };
  if (error?.code === '3D000') return { code: 'DB_NOT_FOUND', message: 'База даних API не існує. Перевірте PGDATABASE у server/.env і створіть цю базу в PostgreSQL.' };
  if (['42P01', '42703'].includes(error?.code)) return { code: 'DB_SCHEMA_MISSING', message: 'Схема бази даних API не готова. Виконайте npm --prefix server run setup.' };
  if (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03', '53300'].includes(error?.code)
      || /^08/.test(error?.code || '') || error?.message === 'Connection terminated due to connection timeout'
      || /SASL:.*password must be a string/.test(error?.message || '')) {
    return { code: 'DB_UNAVAILABLE', message: 'API не може підключитися до PostgreSQL. Перевірте, чи запущено БД, та налаштування server/.env.' };
  }
  return null;
}
