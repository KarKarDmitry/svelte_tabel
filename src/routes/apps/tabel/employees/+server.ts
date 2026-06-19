import { json } from '@sveltejs/kit';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';

const PAGE_SIZE = 100;

export const GET = async (event) => {
	const url = event.url;

	const [result, departments, positions] = await Promise.all([
		employeeService.searchWithFilters({
			search: url.searchParams.get('search') || '',
			department: url.searchParams.get('department') || '',
			position: url.searchParams.get('position') || '',
			status: url.searchParams.get('status') || '',
			sort: url.searchParams.get('sort') || 'lastName',
			order: url.searchParams.get('order') || 'asc',
			page: Math.max(1, Number(url.searchParams.get('page')) || 1),
			pageSize: PAGE_SIZE
		}),
		departmentService.list(),
		positionService.list()
	]);

	return json({
		...result,
		totalPages: Math.ceil(result.total / PAGE_SIZE),
		page: Math.max(1, Number(url.searchParams.get('page')) || 1),
		sort: url.searchParams.get('sort') || 'lastName',
		order: url.searchParams.get('order') || 'asc',
		departments,
		positions
	});
};
