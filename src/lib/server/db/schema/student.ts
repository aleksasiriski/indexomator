import { pgTable, serial, integer, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { departmentTable, universityTable } from './university';

export const student = pgTable('student', {
	id: serial('id').primaryKey(),
	index: text('index').notNull().unique(),
	fname: text('fname').notNull(),
	lname: text('lname').notNull()
});

export const studentEntry = pgTable(
	'student_entry',
	{
		studentId: integer('student_id')
			.notNull()
			.references(() => student.id, { onDelete: 'cascade' }),
		timestamp: timestamp('timestamp').defaultNow().notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.studentId, table.timestamp] })
		};
	}
);

export const studentExit = pgTable(
	'student_exit',
	{
		studentId: integer('student_id')
			.notNull()
			.references(() => student.id, { onDelete: 'cascade' }),
		timestamp: timestamp('timestamp').defaultNow().notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.studentId, table.timestamp] })
		};
	}
);

export const studentUniversityDepartment = pgTable(
	'student_university_department',
	{
		studentId: integer('student_id')
			.notNull()
			.references(() => student.id, { onDelete: 'cascade' }),
		universityId: integer('university_id')
			.notNull()
			.references(() => universityTable.id, { onDelete: 'cascade' }),
		departmentId: integer('department_id')
			.notNull()
			.references(() => departmentTable.id, { onDelete: 'cascade' })
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.studentId, table.universityId, table.departmentId] })
		};
	}
);
