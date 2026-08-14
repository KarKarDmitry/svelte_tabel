<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		CardDescription
	} from '$lib/components/ui/card';
</script>

<div class="mx-auto max-w-4xl p-6">
	<h1 class="mb-6 text-2xl font-bold text-foreground">Приложения</h1>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<a href="/apps/tabel" class="block transition-transform hover:-translate-y-0.5">
			<Card>
				<CardHeader>
					<CardTitle>Табельный учёт</CardTitle>
				</CardHeader>
				<CardContent>
					<CardDescription>
						Учёт рабочего времени сотрудников, импорт событий турникетов, расчёт отработанных часов.
					</CardDescription>
				</CardContent>
			</Card>
		</a>
	</div>
</div>
