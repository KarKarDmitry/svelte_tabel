/** Документы сотрудников отдела 16 СОиБ (проверка периода работы в отделе) */
import 'dotenv/config';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);
const sql = client;

const deptId = 187;
const docs = await sql`
	SELECT e.id, e.number, e.last_name, e.first_name, h.type, h.date, d.name AS dept
	FROM hr_document h
	JOIN employee e ON e.id = h.employee_id
	JOIN department d ON d.id = h.department_id
	WHERE h.department_id = ${deptId}
	ORDER BY e.id, h.date, h.id
`;
console.table(
	docs.map((d: any) => ({
		id: d.id,
		number: d.number,
		fio: `${d.last_name} ${d.first_name}`,
		type: d.type,
		date: String(d.date).slice(0, 10),
		dept: d.dept
	}))
);

await client.end();
