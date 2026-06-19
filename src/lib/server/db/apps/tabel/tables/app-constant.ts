import { pgTable, serial, text, boolean } from 'drizzle-orm/pg-core';

export const appConstant = pgTable('app_constant', {
	id: serial('id').primaryKey(),
	key: text('key').notNull().unique(),
	value: text('value').notNull(),
	isJson: boolean('is_json').default(false).notNull(),
	hint: text('hint')
});
