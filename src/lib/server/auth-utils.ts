/** Дефолтный домен для логинов без явного email (better-auth требует email) */
export const DEFAULT_EMAIL_DOMAIN = 'mettem.com';

/** Роль пользователя: администратор или обычный пользователь */
export type AppRole = 'admin' | 'user';

/** Приводит логин к email: `ivan` → `ivan@mettem.com`, `a@b.ru` → `a@b.ru` */
export const toEmail = (login: string) =>
	login.includes('@') ? login : `${login}@${DEFAULT_EMAIL_DOMAIN}`;
