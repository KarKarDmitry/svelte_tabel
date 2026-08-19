import 'dotenv/config';
import sql from 'mssql';

const missing = ['MSSQL_SERVER', 'MSSQL_DATABASE', 'MSSQL_USER', 'MSSQL_PASSWORD'].filter(
	(k) => !process.env[k]
);
if (missing.length > 0) {
	throw new Error(
		`Отсутствуют переменные окружения: ${missing.join(', ')}. Задайте их в .env (см. .env.example).`
	);
}

const MSSQL_CONFIG: sql.config = {
	server: process.env.MSSQL_SERVER!,
	database: process.env.MSSQL_DATABASE!,
	user: process.env.MSSQL_USER!,
	password: process.env.MSSQL_PASSWORD!,
	port: Number(process.env.MSSQL_PORT) || 1433,
	options: {
		encrypt: process.env.MSSQL_ENCRYPT === 'true',
		trustServerCertificate: true
	},
	pool: {
		max: 1,
		min: 0,
		idleTimeoutMillis: 5000
	}
};

let pool: sql.ConnectionPool | null = null;

export async function getMssqlPool(): Promise<sql.ConnectionPool> {
	if (!pool) {
		pool = await sql.connect(MSSQL_CONFIG);
	}
	return pool;
}

export async function closeMssql(): Promise<void> {
	if (pool) {
		await pool.close();
		pool = null;
	}
}