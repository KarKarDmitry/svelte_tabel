/*
 * enc.c — UTF-8 -> CP1251 для строк из JSON (см. enc.h).
 * Конвертируем детерминированно в 1251 (не в CP_ACP), т.к. именно эту
 * кодовую страницу имеют выполняемые строки (-fexec-charset=CP1251).
 */
#include "enc.h"
#include <windows.h>
#include <string.h>

int enc_copy(char *dst, size_t cap, const char *utf8) {
	if (!dst || cap == 0) return -1;
	if (!utf8) { dst[0] = '\0'; return 0; }
	dst[0] = '\0';

	/* UTF-8 -> UTF-16 */
	int wlen = MultiByteToWideChar(CP_UTF8, 0, utf8, -1, NULL, 0);
	if (wlen <= 0) { strncpy(dst, utf8, cap - 1); dst[cap - 1] = '\0'; return -1; }

	wchar_t *w = (wchar_t *)malloc((size_t)wlen * sizeof(wchar_t));
	if (!w) { strncpy(dst, utf8, cap - 1); dst[cap - 1] = '\0'; return -1; }
	MultiByteToWideChar(CP_UTF8, 0, utf8, -1, w, wlen);

	/* UTF-16 -> CP1251 */
	int blen = WideCharToMultiByte(1251, 0, w, -1, NULL, 0, NULL, NULL);
	if (blen <= 0) {
		free(w);
		strncpy(dst, utf8, cap - 1); dst[cap - 1] = '\0';
		return -1;
	}
	char *b = (char *)malloc((size_t)blen);
	if (!b) {
		free(w);
		strncpy(dst, utf8, cap - 1); dst[cap - 1] = '\0';
		return -1;
	}
	WideCharToMultiByte(1251, 0, w, -1, b, blen, NULL, NULL);

	int rc = 0;
	if ((size_t)blen > cap) {
		memcpy(dst, b, cap - 1);
		dst[cap - 1] = '\0';
		rc = -1;
	} else {
		memcpy(dst, b, (size_t)blen);
	}

	free(b);
	free(w);
	return rc;
}

/* %XX-кодирование одного байта в dst (пишет 3 символа). */
static void pct(unsigned char c, char *dst) {
	static const char hex[] = "0123456789ABCDEF";
	dst[0] = '%';
	dst[1] = hex[c >> 4];
	dst[2] = hex[c & 0xF];
}

static int is_unreserved(unsigned char c) {
	if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))
		return 1;
	return c == '-' || c == '_' || c == '.' || c == '~';
}

int enc_urlencode(const char *cp1251, char *dst, size_t cap) {
	if (!cp1251) cp1251 = "";
	if (!dst || cap == 0) return -1;
	dst[0] = '\0';
	if (!*cp1251) return 0;

	/* CP1251 -> UTF-16 -> UTF-8 */
	int wlen = MultiByteToWideChar(1251, 0, cp1251, -1, NULL, 0);
	if (wlen <= 0) return -1;
	wchar_t *w = (wchar_t *)malloc((size_t)wlen * sizeof(wchar_t));
	if (!w) return -1;
	MultiByteToWideChar(1251, 0, cp1251, -1, w, wlen);

	int ulen = WideCharToMultiByte(CP_UTF8, 0, w, -1, NULL, 0, NULL, NULL);
	if (ulen <= 0) { free(w); return -1; }
	char *u = (char *)malloc((size_t)ulen);
	if (!u) { free(w); return -1; }
	WideCharToMultiByte(CP_UTF8, 0, w, -1, u, ulen, NULL, NULL);
	free(w);

	size_t o = 0;
	for (int i = 0; i < ulen - 1; i++) {
		unsigned char c = (unsigned char)u[i];
		if (is_unreserved(c)) {
			if (o + 1 >= cap) { free(u); return -1; }
			dst[o++] = (char)c;
		} else {
			if (o + 3 >= cap) { free(u); return -1; }
			pct(c, dst + o);
			o += 3;
		}
	}
	free(u);
	dst[o] = '\0';
	return 0;
}

