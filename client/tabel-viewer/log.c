/*
 * log.c — логгер в logs.txt (в директории exe).
 * Реализация: побайтовая запись с единственным буфером, append.
 * Потокобезопасность не требуется (один поток UI/сетевой вьювер).
 */
#include <stdio.h>
#include <stdarg.h>
#include <string.h>
#include <windows.h>

static char g_log_path[MAX_PATH];

void log_init(const char *exe_dir) {
	if (!exe_dir) {
		g_log_path[0] = '\0';
		return;
	}
	_snprintf(g_log_path, sizeof(g_log_path), "%s\\logs.txt", exe_dir);
}

void log_msg(const char *fmt, ...) {
	if (!g_log_path[0]) return;
	/* открыть в append; если не открылось — молча игнорируем */
	FILE *f = fopen(g_log_path, "a");
	if (!f) return;

	SYSTEMTIME st;
	GetLocalTime(&st);
	fprintf(f, "[%04d-%02d-%02d %02d:%02d:%02d.%03d] ",
			(int)st.wYear, (int)st.wMonth, (int)st.wDay,
			(int)st.wHour, (int)st.wMinute, (int)st.wSecond, (int)st.wMilliseconds);

	va_list ap;
	va_start(ap, fmt);
	vfprintf(f, fmt, ap);
	va_end(ap);
	fprintf(f, "\n");
	fclose(f);
}