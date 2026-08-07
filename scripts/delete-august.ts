/** Полное удаление wtt и событий турникета за август 2026 */
import 'dotenv/config';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);
const sql = client;

const beforeW = await sql`
	SELECT count(*)::int AS n FROM worktime_tracker
	WHERE date >= '2026-08-01' AND date <= '2026-08-31'
`;
const beforeE = await sql`
	SELECT count(*)::int AS n FROM turnstile_event_tracker
	WHERE datetime >= '2026-08-01'::timestamptz AND datetime < '2026-09-01'::timestamptz
`;
console.log(`До: wtt=${beforeW[0].n}, событий=${beforeE[0].n}`);

const delW = await sql`
	DELETE FROM worktime_tracker
	WHERE date >= '2026-08-01' AND date <= '2026-08-31'
	RETURNING id
`;
const delE = await sql`
	DELETE FROM turnstile_event_tracker
	WHERE datetime >= '2026-08-01'::timestamptz AND datetime < '2026-09-01'::timestamptz
	RETURNING id
`;
console.log(`Удалено: wtt=${delW.length}, событий=${delE.length}`);

const afterW = await sql`
	SELECT count(*)::int AS n FROM worktime_tracker
	WHERE date >= '2026-08-01' AND date <= '2026-08-31'
`;
const afterE = await sql`
	SELECT count(*)::int AS n FROM turnstile_event_tracker
	WHERE datetime >= '2026-08-01'::timestamptz AND datetime < '2026-09-01'::timestamptz
`;
console.log(`После: wtt=${afterW[0].n}, событий=${afterE[0].n}`);

await client.end();
