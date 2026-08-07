/** Поиск сотрудников 27 и 4 + их события/графики */
import 'dotenv/config';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);
const sql = client;

const emps = await sql`
	SELECT e.id, e.number, e.last_name, e.first_name, e.middle_name,
	       h.date AS doc_date, d.name AS dept, p.name AS pos
	FROM employee e
	LEFT JOIN LATERAL (
		SELECT h2.department_id, h2.position_id, h2.date, h2.type
		FROM hr_document h2 WHERE h2.employee_id = e.id
		ORDER BY h2.date DESC, h2.id DESC LIMIT 1
	) h ON true
	LEFT JOIN department d ON d.id = h.department_id
	LEFT JOIN position p ON p.id = h.position_id
	WHERE e.number IN ('27', '4') OR e.last_name ILIKE '%Кичигин%' OR e.last_name ILIKE '%Кряжевск%'
	ORDER BY e.number
`;
console.table(
	emps.map((e: any) => ({
		id: e.id,
		number: e.number,
		fio: `${e.last_name} ${e.first_name} ${e.middle_name ?? ''}`.trim(),
		doc: String(e.doc_date ?? '').slice(0, 10),
		dept: e.dept,
		pos: e.pos
	}))
);

const sched = await sql`
	SELECT e.number, e.last_name, es.schedule_id, es.date_from, es.date_to, s.name AS sched_name
	FROM employee_schedule es
	JOIN employee e ON e.id = es.employee_id
	LEFT JOIN schedule s ON s.id = es.schedule_id
	WHERE e.number IN ('27', '4') OR e.last_name ILIKE '%Кичигин%' OR e.last_name ILIKE '%Кряжевск%'
	ORDER BY e.number, es.schedule_id
`;
console.log('\n=== Графики ===');
console.table(
	sched.map((s: any) => ({
		number: s.number,
		fio: s.last_name,
		schedule_id: s.schedule_id,
		from: String(s.date_from ?? '').slice(0, 10),
		to: String(s.date_to ?? '').slice(0, 10),
		name: s.sched_name
	}))
);

await client.end();
