import { pgTable, serial, integer, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { departmentTable, universityTable } from './university';

export const employee = pgTable('employee', {
	id: serial('id').primaryKey(),
	email: text('email').notNull().unique(),
	fname: text('fname').notNull(),
	lname: text('lname').notNull()
});

export const employeeEntry = pgTable(
	'employee_entry',
	{
		employeeId: integer('employee_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		timestamp: timestamp('timestamp').defaultNow().notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.employeeId, table.timestamp] })
		};
	}
);

export const employeeExit = pgTable(
	'employee_exit',
	{
		employeeId: integer('employee_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		timestamp: timestamp('timestamp').defaultNow().notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.employeeId, table.timestamp] })
		};
	}
);

export const employeeUniversityDepartment = pgTable(
	'employee_university_department',
	{
		employeeId: integer('employee_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		universityId: integer('university_id')
			.notNull()
			.references(() => universityTable.id, { onDelete: 'cascade' }),
		departmentId: integer('department_id')
			.notNull()
			.references(() => departmentTable.id, { onDelete: 'cascade' })
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.employeeId, table.universityId, table.departmentId] })
		};
	}
);
