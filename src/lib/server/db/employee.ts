import { or, eq, sql, and } from 'drizzle-orm';
import { employee, employeeEntry, employeeExit } from './schema/employee';
import { StateInside, StateOutside, type State } from '$lib/types/state';
import { fuzzySearchFilters } from './fuzzysearch';
import { isInside } from '../isInside';
import { DB as db } from './connect';
import { capitalizeString, sanitizeString } from '$lib/utils/sanitize';

// Gets all employees using optional filters
export async function getEmployees(
	limit: number,
	offset: number,
	searchQuery?: string
): Promise<
	{
		id: number;
		email: string;
		fname: string;
		lname: string;
		department: string;
		building: string | null;
		state: State;
	}[]
> {
	// Assert limit is valid
	if (limit === null || limit === undefined || limit <= 0) {
		throw new Error('Invalid limit');
	}

	// Don't search if the search query is empty when trimmed
	const sanitizedSearchQuery = searchQuery ? sanitizeString(searchQuery) : undefined;
	const nonEmptySearchQuery = sanitizedSearchQuery
		? sanitizedSearchQuery !== ''
			? sanitizedSearchQuery
			: undefined
		: undefined;

	try {
		const maxEntrySubquery = db
			.select({
				employeeId: employeeEntry.employeeId,
				maxEntryTimestamp: sql<Date>`MAX(${employeeEntry.timestamp})`.as('maxEntryTimestamp')
			})
			.from(employeeEntry)
			.groupBy(employeeEntry.employeeId)
			.as('max_entry');

		const employees = await db
			.select({
				id: employee.id,
				email: employee.email,
				fname: employee.fname,
				lname: employee.lname,
				department: employee.department,
				entryTimestamp: maxEntrySubquery.maxEntryTimestamp,
				entryBuilding: employeeEntry.building,
				exitTimestamp: sql<Date | null>`MAX(${employeeExit.timestamp})`.as('exitTimestamp')
			})
			.from(employee)
			.leftJoin(maxEntrySubquery, eq(maxEntrySubquery.employeeId, employee.id))
			.leftJoin(
				employeeEntry,
				and(
					eq(employeeEntry.employeeId, employee.id),
					eq(employeeEntry.timestamp, maxEntrySubquery.maxEntryTimestamp)
				)
			)
			.leftJoin(employeeExit, eq(employee.id, employeeExit.employeeId))
			.where(
				or(
					...(nonEmptySearchQuery
						? [
								...fuzzySearchFilters([employee.email], nonEmptySearchQuery, { substr: true }),
								...fuzzySearchFilters([employee.fname], nonEmptySearchQuery, { distance: 2 }),
								...fuzzySearchFilters([employee.lname], nonEmptySearchQuery, { distance: 2 }),
								...fuzzySearchFilters([employee.fname, employee.lname], nonEmptySearchQuery, { distance: 3 }),
								...fuzzySearchFilters([employee.lname, employee.fname], nonEmptySearchQuery, { distance: 3 })
							]
						: [])
				)
			)
			.groupBy(
				employee.id,
				employee.email,
				employee.fname,
				employee.lname,
				maxEntrySubquery.maxEntryTimestamp,
				employeeEntry.building
			)
			.limit(limit)
			.offset(offset);

		return employees.map((e) => {
			return {
				id: e.id,
				email: e.email,
				fname: e.fname,
				lname: e.lname,
				department: e.department,
				building: isInside(e.entryTimestamp, e.exitTimestamp) ? e.entryBuilding : null,
				state: isInside(e.entryTimestamp, e.exitTimestamp) ? StateInside : StateOutside
			};
		});
	} catch (err: unknown) {
		throw new Error(`Failed to get employees from database: ${(err as Error).message}}`);
	}
}

// Creates an employee and the entry timestamp
export async function createEmployee(
	emailD: string,
	fnameD: string,
	lnameD: string,
	department: string,
	building: string,
	creator: string
): Promise<{
	id: number;
	email: string;
	fname: string;
	lname: string;
	department: string;
	building: string;
	state: State;
}> {
	// Assert email, fname and lname are valid
	if (
		emailD === null ||
		emailD === undefined ||
		emailD === '' ||
		fnameD === null ||
		fnameD === undefined ||
		fnameD === '' ||
		lnameD === null ||
		lnameD === undefined ||
		lnameD === '' ||
		department === null ||
		department === undefined ||
		department === '' ||
		building === null ||
		building === undefined ||
		building === '' ||
		creator === null ||
		creator === undefined ||
		creator === ''
	) {
		throw new Error('Invalid employee data');
	}

	const email = sanitizeString(emailD);
	const fname = capitalizeString(sanitizeString(fnameD));
	const lname = capitalizeString(sanitizeString(lnameD));

	try {
		return await db.transaction(async (tx) => {
			// Create the employee
			const [{ id }] = await tx
				.insert(employee)
				.values({ email, fname, lname, department })
				.returning({ id: employee.id });

			// Create the employee entry
			await tx.insert(employeeEntry).values({
				employeeId: id,
				building,
				creator
			});

			return {
				id,
				email,
				fname,
				lname,
				department,
				building,
				state: StateInside // Because the employee was just created, they are inside
			};
		});
	} catch (err: unknown) {
		throw new Error(`Failed to create employee in database: ${(err as Error).message}`);
	}
}

// Toggles the state of an employee (inside to outside and vice versa)
export async function toggleEmployeeState(
	id: number,
	building: string,
	creator: string
): Promise<State> {
	// Assert id, building and creator are valid
	if (
		id === null ||
		id === undefined ||
		building === null ||
		building === undefined ||
		building === '' ||
		creator === null ||
		creator === undefined ||
		creator === ''
	) {
		throw new Error('Invalid employee data');
	}

	try {
		return await db.transaction(async (tx) => {
			// Get the employee entry and exit timestamps
			const [{ entryTimestamp, exitTimestamp }] = await tx
				.select({
					id: employee.id,
					entryTimestamp: sql<Date>`MAX(${employeeEntry.timestamp})`.as('entryTimestamp'),
					exitTimestamp: sql<Date | null>`MAX(${employeeExit.timestamp})`.as('exitTimestamp')
				})
				.from(employee)
				.leftJoin(employeeEntry, eq(employee.id, employeeEntry.employeeId))
				.leftJoin(employeeExit, eq(employee.id, employeeExit.employeeId))
				.where(eq(employee.id, id))
				.groupBy(employee.id);

			// Toggle the employee state
			if (isInside(entryTimestamp, exitTimestamp)) {
				// Exit the employee
				await tx.insert(employeeExit).values({
					employeeId: id,
					building,
					creator
				});
				return StateOutside;
			} else {
				// Enter the employee
				await tx.insert(employeeEntry).values({
					employeeId: id,
					building,
					creator
				});
				return StateInside;
			}
		});
	} catch (err: unknown) {
		throw new Error(`Failed to toggle employee state in database: ${(err as Error).message}`);
	}
}
