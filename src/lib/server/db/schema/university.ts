import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const universityTable = pgTable('university', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique()
});

export const departmentTable = pgTable('department', {
	id: serial('id').primaryKey(),
	universityId: serial('university_id')
		.notNull()
		.references(() => universityTable.id, { onDelete: 'cascade' }),
	name: text('name').notNull().unique()
});
