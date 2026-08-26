/**
 * Простейший in-process кэш с TTL, тегами, single-flight и LRU-лимитом.
 *
 * Деплой одноузловой (один контейнер app) — Redis не требуется; инвалидация
 * живёт в мутирующих методах сервисов, поэтому мгновенна и не имеет гонок.
 *
 * Отключение: CACHE_ENABLED=0 в окружении (dev-отладка).
 * Внепроцессные записи в БД (мимо сервисов) устаревают по TTL — осознанно.
 */

type Entry = { value: unknown; expiresAt: number; tags: string[] };

const MAX_ENTRIES = 500;

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

let hits = 0;
let misses = 0;

function enabled(): boolean {
	return process.env.CACHE_ENABLED !== '0';
}

/** LRU: пере-вставка перемещает ключ в конец Map (хвост = недавно использованные) */
function touch(key: string): void {
	const e = entries.get(key);
	if (e) {
		entries.delete(key);
		entries.set(key, e);
	}
}

function evictOldest(): void {
	while (entries.size >= MAX_ENTRIES) {
		const oldest = entries.keys().next().value;
		if (oldest === undefined) break;
		entries.delete(oldest);
	}
}

/** Из кэша или выполнить loader; параллельные вызовы одного ключа ждут один промис */
export async function remember<T>(
	key: string,
	ttlSec: number,
	tags: string[],
	loader: () => Promise<T>
): Promise<T> {
	if (!enabled()) return loader();

	const now = Date.now();
	const hit = entries.get(key);
	if (hit && hit.expiresAt > now) {
		hits++;
		touch(key);
		return hit.value as T;
	}

	const running = inflight.get(key);
	if (running) return running as Promise<T>;

	misses++;

	const promise = (async () => {
		try {
			const value = await loader();
			evictOldest();
			entries.set(key, { value, expiresAt: Date.now() + ttlSec * 1000, tags });
			return value;
		} finally {
			inflight.delete(key);
		}
	})();
	inflight.set(key, promise);

	return promise;
}

/** Точечная правка закэшированного объекта по ссылке; нет ключа — no-op */
export function update<T>(key: string, mutator: (value: T) => T): void {
	const e = entries.get(key);
	if (!e) return;
	e.value = mutator(e.value as T);
	touch(key);
}

/** Сброс всех записей, содержащих любой из перечисленных тегов */
export function invalidate(...tags: string[]): void {
	for (const [key, e] of [...entries]) {
		if (e.tags.some((t) => tags.includes(t))) entries.delete(key);
	}
}

export function invalidateAll(): void {
	entries.clear();
}

export function stats(): { size: number; hits: number; misses: number } {
	return { size: entries.size, hits, misses };
}
