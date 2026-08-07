/** Дефолтный домен для логинов без явного email (better-auth требует email) */
export const DEFAULT_EMAIL_DOMAIN = 'mettem.com';

/** Роль пользователя */
export type AppRole = 'admin' | 'timekeeper' | 'user';

/** Список ролей для UI */
export const ROLES: { value: AppRole; label: string }[] = [
	{ value: 'user', label: 'Пользователь' },
	{ value: 'timekeeper', label: 'Табельщик' },
	{ value: 'admin', label: 'Администратор' }
];

/** Приводит логин к email: `ivan` → `ivan@mettem.com`, `a@b.ru` → `a@b.ru` */
export const toEmail = (login: string) =>
	login.includes('@') ? login : `${login}@${DEFAULT_EMAIL_DOMAIN}`;
