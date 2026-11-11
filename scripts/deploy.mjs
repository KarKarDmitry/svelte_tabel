#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.DEPLOY_HOST || 'mettem-srv@192.168.1.242';
const deployDir = process.env.DEPLOY_DIR || '/home/mettem-srv/builds/svelte_tabel';
const appImage = process.env.DEPLOY_IMAGE || 'svelte_tabel-app:latest';
const dbImage = process.env.DEPLOY_DB_IMAGE || 'tabel-db:latest';
const nginxImage = process.env.DEPLOY_NGINX_IMAGE || 'svelte_tabel-nginx:latest';
const composeProject = process.env.DEPLOY_COMPOSE_PROJECT || 'svelte_tabel';
const syncEnv = process.env.DEPLOY_SYNC_ENV === '1';
const skipCheck = process.env.DEPLOY_SKIP_CHECK === '1';

const sshOpts = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];
const id = `${Date.now()}-${process.pid}`;
const remoteArchive = `/tmp/svelte_tabel-deploy-${id}.tar.gz`;
const remoteScript = `/tmp/svelte_tabel-deploy-${id}.sh`;
const remoteEnv = `/tmp/svelte_tabel-deploy-${id}.env`;
const tmp = mkdtempSync(path.join(tmpdir(), 'svelte_tabel-deploy-'));

const excludes = [
	'node_modules',
	'.git',
	'.svelte-kit',
	'build',
	'logs',
	'.check-logs',
	'.tmp-t12',
	'.opencode',
	'.vscode',
	'client',
	'docs',
	'tasks',
	'certs',
	'pgdata',
	'pgbackups',
	'fired.csv',
	'mettem_dump.sql',
	'tsconfig.t12.json',
	'.env',
	'.env.*',
	'*.xls',
	'*.xlsx'
];

function run(cmd, args, options = {}) {
	const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${cmd} exited with code ${result.status}`);
}

function quote(value) {
	return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function parseServices(args) {
	const available = ['app', 'db', 'nginx'];
	const selected = new Set();

	for (const arg of args) {
		if (arg === '-h' || arg === '--help' || arg === 'help') {
			console.log('Usage: npm run deploy -- [app|db|nginx|all]...');
			console.log(
				'Default: app. Examples: npm run deploy -- db, npm run deploy -- nginx, npm run deploy -- all'
			);
			process.exit(0);
		}

		let name = arg;
		if (arg === 'all' || arg === '--all') {
			selected.add('db');
			selected.add('nginx');
			selected.add('app');
			continue;
		}
		if (arg.startsWith('--')) name = arg.slice(2);
		if (!available.includes(name)) throw new Error(`Unknown service or flag: ${arg}`);
		selected.add(name);
	}

	if (selected.size === 0) selected.add('app');
	return ['db', 'nginx', 'app'].filter((service) => selected.has(service));
}

const services = parseServices(process.argv.slice(2));

try {
	console.log(`Deploying to ${host}:${deployDir}`);
	console.log(`Services: ${services.join(', ')}`);
	console.log(`Compose project: ${composeProject}, env: ${syncEnv ? 'local upload' : 'remote'}`);

	run('ssh', [...sshOpts, host, 'true']);

	if (!skipCheck) {
		console.log('\n== Compile check ==');
		run(process.execPath, [path.join(root, 'scripts', 'compile-check.mjs')], { cwd: root });
	}

	if (syncEnv && !existsSync(path.join(root, '.env'))) {
		throw new Error('DEPLOY_SYNC_ENV=1 but local .env was not found');
	}

	const archive = path.join(tmp, 'source.tar.gz');
	console.log('\n== Pack source ==');
	run('tar', ['-czf', archive, ...excludes.map((item) => `--exclude=./${item}`), '-C', root, '.'], {
		cwd: root
	});
	console.log(`Archive: ${(statSync(archive).size / 1024 / 1024).toFixed(1)} MB`);

	const scriptLocal = path.join(tmp, 'deploy-remote.sh');
	writeFileSync(
		scriptLocal,
		readFileSync(path.join(root, 'scripts', 'deploy-remote.sh'), 'utf8').replace(/\r\n/g, '\n'),
		'utf8'
	);

	console.log('\n== Upload ==');
	run('scp', [...sshOpts, archive, `${host}:${remoteArchive}`]);
	run('scp', [...sshOpts, scriptLocal, `${host}:${remoteScript}`]);
	if (syncEnv) {
		run('scp', [...sshOpts, path.join(root, '.env'), `${host}:${remoteEnv}`]);
	}

	console.log('\n== Remote build and deploy ==');
	const envArg = syncEnv ? remoteEnv : '-';
	const command = [
		'bash',
		quote(remoteScript),
		quote(remoteArchive),
		quote(deployDir),
		quote(composeProject),
		quote(envArg),
		quote(services.join(' ')),
		quote(appImage),
		quote(dbImage),
		quote(nginxImage)
	].join(' ');
	run('ssh', [...sshOpts, host, command]);
} finally {
	rmSync(tmp, { recursive: true, force: true });
	try {
		run(
			'ssh',
			[
				...sshOpts,
				host,
				`rm -f ${quote(remoteArchive)} ${quote(remoteScript)} ${quote(remoteEnv)}`
			],
			{
				stdio: 'ignore'
			}
		);
	} catch {}
}
