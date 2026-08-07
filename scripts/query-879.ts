/** Временный скрипт: анализ сотрудника id=879 (события турникета + wtt за август 2026) */
import 'dotenv/config';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);
const sql = client;

const EMP_ID = 879;

const emp = await sql`
	SELECT e.id, e.number, e.last_name, e.first_name, e.middle_name,
	       h.type, h.date, d.name AS dept
	FROM employee e
	LEFT JOIN hr_document h ON h.employee_id = e.id
	LEFT JOIN department d ON d.id = h.department_id
	WHERE e.id = ${EMP_ID}
	ORDER BY h.date, h.id
`;
console.log('\n=== Сотрудник id=879 и документы ===');
console.table(emp);

const events = await sql`
	SELECT to_char(tet.datetime, 'YYYY-MM-DD HH24:MI:SS TZ') AS dt, te.name AS event
	FROM turnstile_event_tracker tet
	JOIN turnstile_event te ON te.id = tet.event_id
	WHERE tet.employee_id = ${EMP_ID}
	  AND tet.datetime >= '2026-08-01'::timestamptz
	  AND tet.datetime < '2026-09-01'::timestamptz
	ORDER BY tet.datetime
`;
console.log('\n=== События турникета за август ===');
console.table(events);

const wtt = await sql`
	SELECT w.date, w.day_mark_code, w.is_night_shift, w.raw_work_time AS raw,
	       w.raw_night_work_time AS raw_n, w.report_work_time AS report,
	       w.report_night_work_time AS report_n, w.schedule_id
	FROM worktime_tracker w
	WHERE w.employee_id = ${EMP_ID} AND w.date >= '2026-08-01' AND w.date <= '2026-08-31'
	ORDER BY w.date
`;
console.log('\n=== WTT за август ===');
console.table(wtt);

await client.end();
