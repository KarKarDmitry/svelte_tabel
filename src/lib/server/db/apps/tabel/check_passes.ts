import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.ts';
import { eq, and, isNull } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

// Все пропуска с историей назначений
const allEP = await db
	.select({
		id: schema.employeePass.id,
		passId: schema.employeePass.passId,
		seria: schema.pass.seria,
		number: schema.pass.number,
		employeeId: schema.employeePass.employeeId,
		lastName: schema.employee.lastName,
		firstName: schema.employee.firstName,
		dateFrom: schema.employeePass.dateFrom,
		dateTo: schema.employeePass.dateTo
	})
	.from(schema.employeePass)
	.innerJoin(schema.pass, eq(schema.pass.id, schema.employeePass.passId))
	.innerJoin(schema.employee, eq(schema.employee.id, schema.employeePass.employeeId))
	.orderBy(schema.employeePass.passId, schema.employeePass.dateFrom);

console.log('=== Вся история назначений пропусков ===');
for (const r of allEP) {
	console.log(
		`${r.seria}${r.number} -> ${r.lastName} ${r.firstName} | ${r.dateFrom} - ${r.dateTo ?? 'текущий'}`
	);
}

console.log('\n=== Сейчас активны (dateTo IS NULL) ===');
const active = allEP.filter((r) => !r.dateTo);
for (const r of active) {
	console.log(`${r.seria}${r.number} -> ${r.lastName} ${r.firstName}`);
}

console.log('\n=== Свободны ===');
const allP = await db.select().from(schema.pass);
const activeIds = new Set(allEP.filter((r) => !r.dateTo).map((r) => r.passId));
for (const p of allP) {
	if (!activeIds.has(p.id)) console.log(`${p.seria}${p.number}`);
}

process.exit(0);
