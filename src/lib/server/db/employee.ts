import { or, desc, eq, sql } from 'drizzle-orm';
import { employee, employeeEntry, employeeExit } from './schema/employee';
import { StateInside, StateOutside, type State } from '$lib/types/state';
import { fuzzySearchFilters } from './fuzzysearch';
import { isInside } from '../isInside';
import { DB as db } from './connect';

// Gets all employees using optional filters
export async function getEmployees(searchQuery?: string): Promise<
	{
		id: number;
		fname: string;
		lname: string;
		state: State;
	}[]
> {
	// Assert searchQuery is not null nor empty, if it is provided
	if (searchQuery !== undefined && (searchQuery === null || searchQuery === '')) {
		throw new Error('Invalid search query');
	}

	const employees = await db
		.select({
			id: employee.id,
			fname: employee.fname,
			lname: employee.lname,
			entryTimestamp: sql<Date>`MAX(${employeeEntry.timestamp})`.as('entryTimestamp'),
			exitTimestamp: sql<Date | null>`MAX(${employeeExit.timestamp})`.as('exitTimestamp')
		})
		.from(employee)
		.leftJoin(employeeEntry, eq(employee.id, employeeEntry.employeeId))
		.leftJoin(employeeExit, eq(employee.id, employeeExit.employeeId))
		.where(
			or(
				...(searchQuery
					? [
							...fuzzySearchFilters(employee.fname, searchQuery),
							...fuzzySearchFilters(employee.lname, searchQuery)
						]
					: [])
			)
		)
		.groupBy(employee.id, employee.fname, employee.lname);

	return employees.map((s) => {
		return {
			id: s.id,
			fname: s.fname,
			lname: s.lname,
			state: isInside(s.entryTimestamp, s.exitTimestamp) ? StateInside : StateOutside
		};
	});
}

// Creates an employee and the entry timestamp
export async function createEmployee(
	fname: string,
	lname: string
): Promise<{
	id: number;
	fname: string;
	lname: string;
	state: State;
}> {
	// Assert fname, lname and personalId are valid
	if (
		fname === null ||
		fname === undefined ||
		fname === '' ||
		lname === null ||
		lname === undefined ||
		lname === ''
	) {
		throw new Error('Invalid employee data');
	}

	return await db.transaction(async (tx) => {
		// Create the employee
		const [{ id }] = await tx
			.insert(employee)
			.values({ fname, lname })
			.returning({ id: employee.id });

		// Create the employee entry
		await tx.insert(employeeEntry).values({ employeeId: id });

		return {
			id,
			fname,
			lname,
			state: StateInside // Because the employee was just created, he is inside
		};
	});
}

// Gets the state of an employee (either inside or outside)
export async function getEmployeeState(id: number): Promise<State> {
	// Assert id is valid
	if (id === null || id === undefined) {
		throw new Error('Invalid employee id');
	}

	return await db.transaction(async (tx) => {
		// Get the employee entry
		const [{ timestamp: entryTimestamp }] = await tx
			.select({
				timestamp: employeeEntry.timestamp
			})
			.from(employeeEntry)
			.where(eq(employeeEntry.employeeId, id))
			.orderBy(desc(employeeEntry.timestamp))
			.limit(1);

		// Get the employee exit
		const exits = await tx
			.select({
				timestamp: employeeExit.timestamp
			})
			.from(employeeExit)
			.where(eq(employeeExit.employeeId, id))
			.orderBy(desc(employeeExit.timestamp))
			.limit(1);
		let exitTimestamp: Date | null = null;
		if (exits.length > 0) {
			exitTimestamp = exits[0].timestamp;
		}

		return isInside(entryTimestamp, exitTimestamp) ? StateInside : StateOutside;
	});
}

// Toggles the state of an employee (inside to outside and vice versa)
export async function toggleEmployeeState(id: number): Promise<State> {
	// Assert id is valid
	if (id === null || id === undefined) {
		throw new Error('Invalid employee id');
	}

	return await db.transaction(async (tx) => {
		// Get the employee entry
		const [{ timestamp: entryTimestamp }] = await tx
			.select({
				timestamp: employeeEntry.timestamp
			})
			.from(employeeEntry)
			.where(eq(employeeEntry.employeeId, id))
			.orderBy(desc(employeeEntry.timestamp))
			.limit(1);

		// Get the employee exit
		const exits = await tx
			.select({
				timestamp: employeeExit.timestamp
			})
			.from(employeeExit)
			.where(eq(employeeExit.employeeId, id))
			.orderBy(desc(employeeExit.timestamp))
			.limit(1);
		let exitTimestamp: Date | null = null;
		if (exits.length > 0) {
			exitTimestamp = exits[0].timestamp;
		}

		// Toggle the employee state
		if (isInside(entryTimestamp, exitTimestamp)) {
			// Exit the employee
			await tx.insert(employeeExit).values({ employeeId: id });
			return StateOutside;
		} else {
			// Enter the employee
			await tx.insert(employeeEntry).values({ employeeId: id });
			return StateInside;
		}
	});
}
