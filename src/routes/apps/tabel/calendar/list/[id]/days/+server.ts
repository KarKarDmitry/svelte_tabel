import { json } from '@sveltejs/kit';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';

export const GET = async (event) => {
	const calendarId = Number(event.params.id);
	const days = await calendarService.getDays(calendarId);
	return json({ days });
};

export const PATCH = async (event) => {
	const calendarId = Number(event.params.id);
	const f = await event.request.formData();
	const date = f.get('date')?.toString();
	if (!date) return json({ error: 'date required' }, { status: 400 });

	const dayType = f.get('dayType')?.toString() as any;
	const workTime = f.get('workTime') ? Number(f.get('workTime')) : null;
	const scheduleId = f.get('scheduleId') ? Number(f.get('scheduleId')) : null;
	const transferFrom = f.get('transferFrom')?.toString() || null;
	const autoTransfer = f.get('autoTransfer') === 'on';
	const preHoliday = f.get('preHoliday') === 'on';

	// Сохраняем основной день
	const day = await calendarService.upsertDay({
		calendarId,
		date,
		dayType,
		workTime,
		scheduleId,
		transferFrom
	});

	// Если это праздник с autoTransfer — создаём transferred_workday
	if (dayType === 'holiday' && autoTransfer) {
		const dt = new Date(date);
		const dow = dt.getDay();
		if (dow === 0 || dow === 6) {
			const cal = await calendarService.getCalendarById(calendarId);
			const allDays = await calendarService.getDays(calendarId);
			const year = cal?.year || dt.getFullYear();
			const month = dt.getMonth() + 1;
			const daysInMonth = new Date(year, month, 0).getDate();
			const dayNum = dt.getDate();

			for (let td = dayNum + 1; td <= daysInMonth; td++) {
				const tDate = `${year}-${String(month).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
				const existing = allDays.find((d: any) => d.date === tDate);
				if (!existing || existing.dayType === 'workday' || existing.dayType === 'weekend') {
					const tDow = new Date(year, month - 1, td).getDay();
					if (tDow !== 0 && tDow !== 6) {
						await calendarService.upsertDay({
							calendarId,
							date: tDate,
							dayType: 'transferred_workday',
							workTime: 480,
							transferFrom: date
						});
						break;
					}
				}
			}
		}
	}

	// Если предпраздничный — обновляем предыдущий день
	if (dayType === 'holiday' && preHoliday && scheduleId) {
		const dt = new Date(date);
		const prevDate = new Date(dt);
		prevDate.setDate(prevDate.getDate() - 1);
		const prevDateStr = prevDate.toISOString().split('T')[0];
		const prevDow = prevDate.getDay();
		if (prevDow !== 0 && prevDow !== 6) {
			const sched = await scheduleService.getById(scheduleId);
			await calendarService.upsertDay({
				calendarId,
				date: prevDateStr,
				dayType: 'preholiday',
				workTime: sched?.standardWorkTime ?? 480,
				scheduleId
			});
		}
	}

	return json({ success: true, day });
};
