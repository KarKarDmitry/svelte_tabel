/** Удаление wtt и событий турникета за август 2026 для сотрудников отдела 16 СОиБ (id=187) */
import 'dotenv/config';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);
const sql = client;

const deptId = 187;

const emps = await sql`
	SELECT DISTINCT ON (e.id) e.id, e.number, e.last_name
	FROM employee e
	JOIN hr_document h ON h.employee_id = e.id
	WHERE h.department_id = ${deptId}
	ORDER BY e.id, h.date DESC, h.id DESC
`;
const ids = emps.map((e: any) => e.id);
console.log('Сотрудники отдела:', ids.join(', '), `(${ids.length})`);

const beforeW = await sql`
	SELECT count(*)::int AS n FROM worktime_tracker
	WHERE employee_id = ANY(${ids}) AND date >= '2026-08-01' AND date <= '2026-08-31'
`;
const beforeE = await sql`
	SELECT count(*)::int AS n FROM turnstile_event_tracker
	WHERE employee_id = ANY(${ids})
	  AND datetime >= '2026-08-01'::timestamptz AND datetime < '2026-09-01'::timestamptz
`;
console.log(`До: wtt=${beforeW[0].n}, событий=${beforeE[0].n}`);

const delW = await sql`
	DELETE FROM worktime_tracker
	WHERE employee_id = ANY(${ids}) AND date >= '2026-08-01' AND date <= '2026-08-31'
	RETURNING id
`;
const delE = await sql`
	DELETE FROM turnstile_event_tracker
	WHERE employee_id = ANY(${ids})
	  AND datetime >= '2026-08-01'::timestamptz AND datetime < '2026-09-01'::timestamptz
	RETURNING id
`;
console.log(`Удалено: wtt=${delW.length}, событий=${delE.length}`);

await client.end();
