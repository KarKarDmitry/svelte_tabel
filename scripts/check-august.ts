/** Проверка записанных данных за август (после переимпорта) */
import 'dotenv/config';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);
const sql = client;

const w =
	await sql`SELECT count(*)::int AS n FROM worktime_tracker WHERE date >= '2026-08-01' AND date <= '2026-08-31'`;
const e =
	await sql`SELECT count(*)::int AS n FROM turnstile_event_tracker WHERE datetime >= '2026-08-01'::timestamptz AND datetime < '2026-09-01'::timestamptz`;
console.log(`wtt за август: ${w[0].n}, событий: ${e[0].n}`);

console.log('\n=== Выборочные строки wtt ===');
const rows = await sql`
	SELECT e.number, e.last_name, w.date, w.day_mark_code, w.raw_work_time AS raw,
	       w.raw_night_work_time AS raw_n, w.report_work_time AS report, w.report_night_work_time AS report_n
	FROM worktime_tracker w
	JOIN employee e ON e.id = w.employee_id
	WHERE w.date >= '2026-08-01' AND w.date <= '2026-08-31'
	  AND (e.last_name IN ('Ершов', 'Фалеев', 'Шапеев', 'Кичигин', 'Кряжевских'))
	ORDER BY e.last_name, w.date
`;
console.table(
	rows.map((r: any) => ({
		number: r.number,
		fio: r.last_name,
		date: String(r.date).slice(0, 10),
		mark: r.day_mark_code,
		raw: r.raw,
		raw_n: r.raw_n,
		report: r.report,
		report_n: r.report_n
	}))
);

await client.end();
