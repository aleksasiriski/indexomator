import {
	pgTable,
	serial,
	integer,
	text,
	timestamp,
	primaryKey,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { building } from './building';
import { department } from './department';
import { userTable } from './user';

export const person = pgTable('person', {
	id: serial('id').primaryKey(),
	identifier: text('identifier').notNull().unique(),
	type: text('type').notNull(),
	fname: text('fname').notNull(),
	lname: text('lname').notNull(),
	department: text('department')
		.notNull()
		.references(() => department.name, { onDelete: 'restrict', onUpdate: 'cascade' }),
	guarantorId: integer('guarantor_id').references((): AnyPgColumn => person.id, {
		onDelete: 'restrict',
		onUpdate: 'cascade'
	})
});

export const personEntry = pgTable(
	'person_entry',
	{
		personId: integer('person_id')
			.notNull()
			.references(() => person.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		timestamp: timestamp('timestamp').defaultNow().notNull(),
		building: text('building')
			.notNull()
			.references(() => building.name, { onDelete: 'restrict', onUpdate: 'cascade' }),
		creator: text('creator')
			.notNull()
			.references(() => userTable.username, { onDelete: 'no action', onUpdate: 'cascade' })
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.personId, table.timestamp] })
		};
	}
);

export const personExit = pgTable(
	'person_exit',
	{
		personId: integer('person_id')
			.notNull()
			.references(() => person.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		timestamp: timestamp('timestamp').defaultNow().notNull(),
		building: text('building')
			.notNull()
			.references(() => building.name, { onDelete: 'restrict', onUpdate: 'cascade' }),
		creator: text('creator')
			.notNull()
			.references(() => userTable.username, { onDelete: 'no action', onUpdate: 'cascade' })
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.personId, table.timestamp] })
		};
	}
);
