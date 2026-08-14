import { toASCII } from 'punycode/punycode.es6.js';

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

/**
 * Приводит логин к email: `ivan` → `ivan@mettem.com`, `a@b.ru` → `a@b.ru`.
 * Локальная часть с не-ASCII (русский логин) кодируется в punycode:
 * better-auth валидирует email через zod и принимает только ASCII, поэтому
 * «админ» сохраняется как `xn--80aimpg@mettem.com`, а имя (user.name)
 * остаётся русским для отображения.
 */
export const toEmail = (login: string) => {
	const raw = login.includes('@') ? login : `${login}@${DEFAULT_EMAIL_DOMAIN}`;
	const at = raw.lastIndexOf('@');
	if (at <= 0) return raw;
	const local = raw.slice(0, at);
	const domain = raw.slice(at + 1);
	return /[^\x00-\x7F]/.test(local) ? `${toASCII(local)}@${domain}` : raw;
};
