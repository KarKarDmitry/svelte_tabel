import sql from 'mssql';

const MSSQL_CONFIG: sql.config = {
	server: '192.168.1.42',
	database: 'OPP_R',
	user: 'Editor',
	password: '***REMOVED***',
	port: 1433,
	options: {
		encrypt: false,
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
