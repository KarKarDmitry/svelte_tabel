import { json } from '@sveltejs/kit';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { requireAdmin } from '$lib/server/permissions';

export const GET = async (event) => {
	requireAdmin(event.locals.user);
	const seriaSearch = event.url.searchParams.get('seria') || '';
	const numberSearch = event.url.searchParams.get('number') || '';
	let passes = await passService.listWithOwners();
	if (seriaSearch) {
		const q = seriaSearch.toLowerCase();
		passes = passes.filter((r: any) => r.pass.seria?.toLowerCase().includes(q));
	}
	if (numberSearch) {
		const q = numberSearch.toLowerCase();
		passes = passes.filter((r: any) => r.pass.number.toLowerCase().includes(q));
	}
	return json({ passes, seriaSearch, numberSearch });
};

export const POST = async (event) => {
	requireAdmin(event.locals.user);
	const f = await event.request.formData();
	const seria = f.get('seria')?.toString() || null;
	const number = f.get('number')?.toString();
	if (!number) return json({ error: 'Номер обязателен' }, { status: 400 });
	const p = await passService.create({ seria, number });
	return json({ success: true, pass: p });
};

export const PATCH = async (event) => {
	requireAdmin(event.locals.user);
	const f = await event.request.formData();
	const id = Number(f.get('id'));
	const seria = f.get('seria')?.toString() || null;
	const number = f.get('number')?.toString();
	if (!number) return json({ error: 'Номер обязателен' }, { status: 400 });
	const p = await passService.update(id, { seria, number });
	return json({ success: true, pass: p });
};

export const DELETE = async (event) => {
	requireAdmin(event.locals.user);
	const id = Number((await event.request.formData()).get('id'));
	await passService.remove(id);
	return json({ success: true });
};
