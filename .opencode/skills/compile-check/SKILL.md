---
name: compile-check
description: Быстрая проверка компиляции mettem (npm run check:compile / scripts/compile-check.mjs) — синтаксис .svelte и .ts за ~2 секунды вместо svelte-check. Use when проверяя, что правки компилируются, после изменения файлов, когда нужна быстрая проверка без типов, или для проверки одного файла через -f.
---

# Быстрая проверка компиляции

`check:compile` проверяет **синтаксис** (не типы): `.svelte` через `svelte/compiler`, `.ts` через `typescript` `transpileModule`. Работает ~2 сек вместо `svelte-check` (~минуты). Типы проверяются отдельно: `npm run check` (svelte-check).

## Запуск
- Весь проект: `npm run check:compile` (или `node scripts/compile-check.mjs`).
- Один файл: `npm run check:compile -- -f src/lib/server/db/apps/tabel/services/employee.service.ts` (или `node scripts/compile-check.mjs -f <path>`).
- Принимает абсолютный или относительный путь; `.d.ts` пропускаются; несуществующий файл — ошибка с exit 1.

## Трактовка результата
- `Проверено файлов: N, ошибок: 0, предупреждений: M` → ок. Exit 0 при 0 ошибок, exit 1 при ошибках.
- Предупреждения (warnings) — предсуществующие и benign (a11y-предупреждения, unused css-селекторы в native, `state_referenced_locally` и т.п.); чинить не обязательно, но не плодить новые.
- После каждой серии правок прогонять `check:compile`; если менялись типы/сигнатуры — дополнительно `npm run check`.

## Скрипт
- `scripts/compile-check.mjs`: обходит `src/` рекурсивно (`.svelte`/`.ts`, минус `.d.ts`), флаг `-f` ограничивает одним файлом (добавлен по запросу — не потерять при перезаписи скрипта).