import { timestamp, text } from 'drizzle-orm/pg-core';

export const audit = {
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
	updatedBy: text('updated_by')
};
