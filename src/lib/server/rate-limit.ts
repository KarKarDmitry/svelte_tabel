// Простой in-memory rate-limit (фиксированное окно + лок-аут).
// Подходит для одноузлового внутреннего приложения; при горизонтальном
// масштабировании заменить на общий стор (Redis/БД).
type Entry = {
	count: number;
	windowStart: number;
	lockedUntil?: number;
};

const buckets = new Map<string, Entry>();

export type RateLimitResult = {
	allowed: boolean;
	retryAfterSec: number;
};

export function checkRateLimit(
	key: string,
	opts: { max: number; windowMs: number; lockMs: number }
): RateLimitResult {
	const now = Date.now();
	const entry = buckets.get(key);

	if (!entry) {
		buckets.set(key, { count: 1, windowStart: now });
		return { allowed: true, retryAfterSec: 0 };
	}

	// Окно истекло — новый отсчёт
	if (now - entry.windowStart >= opts.windowMs) {
		entry.count = 1;
		entry.windowStart = now;
		entry.lockedUntil = undefined;
		return { allowed: true, retryAfterSec: 0 };
	}

	// Лок-аут активен
	if (entry.lockedUntil && now < entry.lockedUntil) {
		return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
	}

	// Лок-аут истёк — сбрасываем счётчик
	if (entry.lockedUntil) {
		entry.count = 0;
		entry.lockedUntil = undefined;
	}

	// Лимит исчерпан — включаем лок-аут
	if (entry.count >= opts.max) {
		entry.lockedUntil = now + opts.lockMs;
		return { allowed: false, retryAfterSec: Math.ceil(opts.lockMs / 1000) };
	}

	entry.count++;
	return { allowed: true, retryAfterSec: 0 };
}

/** Сброс попыток при успешном входе */
export function clearRateLimit(key: string) {
	buckets.delete(key);
}

// Предохранитель от неограниченного роста Map при большом числе ключей
setInterval(() => {
	const cutoff = Date.now() - 60 * 60 * 1000;
	for (const [k, e] of buckets) {
		if (e.windowStart < cutoff && !(e.lockedUntil && e.lockedUntil > Date.now())) {
			buckets.delete(k);
		}
	}
}, 60 * 60 * 1000).unref();