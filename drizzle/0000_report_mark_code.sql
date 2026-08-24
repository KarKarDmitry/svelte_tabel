-- Разделение отметок: day_mark_code = факт ('Я'/'Н' из импорта турникета),
-- report_mark_code = ручная отметка табельщика.
-- Перенос существующих ручных меток: импорт пишет только 'Я'/'Н' и не заполняет
-- report_*; всё остальное — ручные правки или итоговые метки старой БД.
ALTER TABLE "worktime_tracker" ADD COLUMN IF NOT EXISTS "report_mark_code" text;

UPDATE worktime_tracker
SET report_mark_code = day_mark_code
WHERE day_mark_code IS NOT NULL
  AND (
    day_mark_code NOT IN ('Я', 'Н')
    OR report_work_time IS NOT NULL
    OR report_night_work_time IS NOT NULL
  );
-- Очистка факта от ручных/унаследованных меток (значение уже в report_mark_code):
-- day_mark_code должен содержать только факт импорта турникета ('Я'/'Н').
UPDATE worktime_tracker
SET day_mark_code = NULL
WHERE report_mark_code IS NOT NULL
  AND day_mark_code IS NOT NULL
  AND day_mark_code NOT IN ('Я', 'Н');
